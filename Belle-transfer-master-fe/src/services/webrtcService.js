/**
 * WebRTC Service
 * Handles peer connections, media streams, and ICE negotiation
 * Works with callService.js for signaling
 *
 * NOTE: This service requires react-native-webrtc which needs a development build.
 * It will gracefully fail in Expo Go.
 */

// Import Platform for iOS detection
let Platform = null;
try {
  Platform = require('react-native').Platform;
} catch (error) {
  // Fallback for web
  Platform = {
    OS: typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'ios' : 'web'
  };
}

// Try to import WebRTC - will fail in Expo Go but work in builds
// For Web, we can fallback to global window object
let RTCPeerConnection = null;
let RTCSessionDescription = null;
let RTCIceCandidate = null;
let mediaDevices = null;
let isWebRTCAvailable = false;

try {
  const webrtc = require('react-native-webrtc');
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  mediaDevices = webrtc.mediaDevices;
  isWebRTCAvailable = true;
  console.log('WebRTC module loaded successfully (Native)');
} catch (error) {
  // Check for global WebRTC (Web / Expo Web)
  if (typeof window !== 'undefined' && window.RTCPeerConnection) {
    console.log('Using standard Web API for WebRTC');
    RTCPeerConnection = window.RTCPeerConnection;
    RTCSessionDescription = window.RTCSessionDescription;
    RTCIceCandidate = window.RTCIceCandidate;
    mediaDevices = navigator.mediaDevices;
    isWebRTCAvailable = true;
  } else {
    console.warn('WebRTC not available (expected in Expo Go without Development Build):', error.message);
    isWebRTCAvailable = false;
  }
}

// Import call service (this should work in Expo Go)
let sendWebRTCSignal = () => { };
let onCallEvent = () => () => { };

try {
  const callService = require('./callService');
  sendWebRTCSignal = callService.sendWebRTCSignal || (() => { });
  onCallEvent = callService.onCallEvent || (() => () => { });
} catch (error) {
  console.warn('Call service not available:', error.message);
}

// ICE servers configuration (STUN/TURN)
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // TURN servers should be added from backend config in production
  ],
};

// Media constraints
const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

// iOS-compatible video constraints
const VIDEO_CONSTRAINTS = {
  facingMode: 'user',
  width: { ideal: 640, max: 1280 },
  height: { ideal: 480, max: 720 },
  frameRate: { ideal: 24, max: 30 },
  // iOS-specific constraints
  aspectRatio: { ideal: 4 / 3 },
};

// State
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let pendingIceCandidates = [];
let isNegotiating = false;
let currentUserId = null; // Store current user ID to determine offerer

// Callbacks
let onLocalStreamCallback = null;
let onRemoteStreamCallback = null;
let onConnectionStateChangeCallback = null;
let onErrorCallback = null;

/**
 * Check if WebRTC is available
 */
export const checkWebRTCAvailable = () => isWebRTCAvailable;

/**
 * Initialize WebRTC and setup signaling listeners
 */
export const initializeWebRTC = () => {
  if (!isWebRTCAvailable) {
    console.warn('WebRTC not available - video calls disabled');
    return () => { };
  }

  // Listen for incoming WebRTC signals
  const unsubscribe = onCallEvent('webrtc-signal', handleIncomingSignal);
  return unsubscribe;
};

/**
 * Request camera and microphone permissions and get local stream
 */
export const getLocalStream = async (enableVideo = false) => {
  if (!isWebRTCAvailable) {
    console.warn('WebRTC not available - cannot get local stream');
    return null;
  }

  try {
    // Build constraints with iOS compatibility
    const constraints = {
      audio: AUDIO_CONSTRAINTS,
      video: enableVideo ? VIDEO_CONSTRAINTS : false,
    };

    // For iOS Safari, ensure we request proper constraints
    if (enableVideo && Platform.OS === 'web' && typeof navigator !== 'undefined') {
      // Check if iOS device
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      if (isIOS) {
        // iOS-specific video constraints
        constraints.video = {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        };
      }
    }

    // Add timeout for getUserMedia (15 seconds - reduced from 30)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Timeout starting video source'));
      }, 15000);
    });

    const streamPromise = mediaDevices.getUserMedia(constraints);
    localStream = await Promise.race([streamPromise, timeoutPromise]);

    if (onLocalStreamCallback) {
      onLocalStreamCallback(localStream);
    }

    return localStream;
  } catch (error) {
    console.error('Error getting local stream:', error);
    if (onErrorCallback) {
      onErrorCallback({ type: 'media', message: 'Failed to access camera/microphone', error });
    }
    throw error;
  }
};

/**
 * Create peer connection and setup handlers
 */
export const createPeerConnection = async (partnerId, userId = null) => {
  if (!isWebRTCAvailable) {
    console.warn('WebRTC not available - cannot create peer connection');
    return null;
  }

  try {
    // Store current user ID for offerer determination
    currentUserId = userId;

    // Close existing connection if any
    if (peerConnection) {
      closePeerConnection();
    }

    peerConnection = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks to connection
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendWebRTCSignal({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
          userId: partnerId, // Send to partner
        });
      }
    };

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', peerConnection.iceConnectionState);

      if (onConnectionStateChangeCallback) {
        onConnectionStateChangeCallback(peerConnection.iceConnectionState);
      }

      if (peerConnection.iceConnectionState === 'failed') {
        // Attempt ICE restart
        peerConnection.restartIce();
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', peerConnection.connectionState);

      if (onConnectionStateChangeCallback) {
        onConnectionStateChangeCallback(peerConnection.connectionState);
      }
    };

    // Handle negotiation needed
    // Only create offer if this user should be the offerer (determined by user ID comparison)
    // This prevents both peers from creating offers simultaneously
    peerConnection.onnegotiationneeded = async () => {
      if (isNegotiating) return;

      // Determine if this user should be the offerer (user with lower ID alphabetically)
      const shouldBeOfferer = currentUserId && partnerId && currentUserId < partnerId;

      if (!shouldBeOfferer) {
        console.log('Waiting for offer from partner (this user is answerer)');
        return; // Wait for the other peer's offer
      }

      try {
        isNegotiating = true;
        await createAndSendOffer(partnerId);
      } catch (error) {
        console.error('Error during negotiation:', error);
      } finally {
        isNegotiating = false;
      }
    };

    // Handle remote tracks
    peerConnection.ontrack = (event) => {
      console.log('Remote track received:', event.track.kind);

      if (event.streams && event.streams[0]) {
        remoteStream = event.streams[0];

        if (onRemoteStreamCallback) {
          onRemoteStreamCallback(remoteStream);
        }
      }
    };

    // Process any pending ICE candidates
    for (const candidate of pendingIceCandidates) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
    pendingIceCandidates = [];

    return peerConnection;
  } catch (error) {
    console.error('Error creating peer connection:', error);
    if (onErrorCallback) {
      onErrorCallback({ type: 'connection', message: 'Failed to create connection', error });
    }
    throw error;
  }
};

/**
 * Create and send an offer (caller side)
 */
export const createAndSendOffer = async (userId) => {
  if (!isWebRTCAvailable || !peerConnection) {
    console.warn('WebRTC not available or peer connection not initialized');
    throw new Error('Peer connection not initialized');
  }

  try {
    // Check if we're already in a signaling state that allows creating an offer
    if (peerConnection.signalingState !== 'stable' && peerConnection.signalingState !== 'have-local-offer') {
      console.warn('Peer connection signaling state is not stable:', peerConnection.signalingState);
      // If we're in 'have-remote-offer', we should create an answer instead
      if (peerConnection.signalingState === 'have-remote-offer') {
        console.log('Already have remote offer, skipping offer creation');
        return null;
      }
    }

    console.log('Creating offer for user:', userId, 'Signaling state:', peerConnection.signalingState);
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await peerConnection.setLocalDescription(offer);
    console.log('Local description set, signaling state:', peerConnection.signalingState);

    sendWebRTCSignal({
      type: 'offer',
      sdp: offer.sdp,
      userId,
    });

    console.log('Offer created and sent to:', userId);
    return offer;
  } catch (error) {
    console.error('Error creating offer:', error);
    throw error;
  }
};

/**
 * Handle incoming WebRTC signal from signaling server
 */
const handleIncomingSignal = async (signal) => {
  if (!isWebRTCAvailable) return;

  try {
    console.log('Received WebRTC signal:', signal.type);

    switch (signal.type) {
      case 'offer':
        await handleOffer(signal);
        break;
      case 'answer':
        await handleAnswer(signal);
        break;
      case 'ice-candidate':
        await handleIceCandidate(signal);
        break;
      default:
        console.warn('Unknown signal type:', signal.type);
    }
  } catch (error) {
    console.error('Error handling signal:', error);
    if (onErrorCallback) {
      onErrorCallback({ type: 'signaling', message: 'Failed to process signal', error });
    }
  }
};

/**
 * Handle incoming offer (callee side)
 */
const handleOffer = async (signal) => {
  if (!isWebRTCAvailable) return;

  try {
    if (!peerConnection) {
      // Create peer connection if not exists
      await createPeerConnection(signal.userId);
    }

    const remoteDesc = new RTCSessionDescription({
      type: 'offer',
      sdp: signal.sdp,
    });

    await peerConnection.setRemoteDescription(remoteDesc);

    // Create and send answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    sendWebRTCSignal({
      type: 'answer',
      sdp: answer.sdp,
      userId: signal.userId,
    });

    console.log('Answer sent');
  } catch (error) {
    console.error('Error handling offer:', error);
    throw error;
  }
};

/**
 * Handle incoming answer
 */
const handleAnswer = async (signal) => {
  if (!isWebRTCAvailable) return;

  try {
    if (!peerConnection) {
      console.warn('No peer connection for answer');
      return;
    }

    const remoteDesc = new RTCSessionDescription({
      type: 'answer',
      sdp: signal.sdp,
    });

    await peerConnection.setRemoteDescription(remoteDesc);
    console.log('Remote description set');
  } catch (error) {
    console.error('Error handling answer:', error);
    throw error;
  }
};

/**
 * Handle incoming ICE candidate
 */
const handleIceCandidate = async (signal) => {
  if (!isWebRTCAvailable) return;

  try {
    const candidate = new RTCIceCandidate(signal.candidate);

    if (peerConnection && peerConnection.remoteDescription) {
      await peerConnection.addIceCandidate(candidate);
      console.log('ICE candidate added');
    } else {
      // Queue candidate if remote description not set yet
      pendingIceCandidates.push(signal.candidate);
      console.log('ICE candidate queued');
    }
  } catch (error) {
    console.error('Error handling ICE candidate:', error);
  }
};

/**
 * Enable/disable video
 */
export const toggleVideo = async (enabled) => {
  if (!isWebRTCAvailable) {
    console.warn('WebRTC not available - cannot toggle video');
    return false;
  }

  try {
    if (enabled) {
      // If we don't have a stream, get one with video
      if (!localStream) {
        try {
          await getLocalStream(true);
        } catch (error) {
          console.warn('[webrtcService] Failed to get stream with video, trying simpler constraints:', error);
          // Retry with simpler constraints
          try {
            const simpleConstraints = {
              audio: AUDIO_CONSTRAINTS,
              video: { facingMode: 'user' }, // Minimal constraints
            };
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Timeout starting video source')), 15000);
            });
            localStream = await Promise.race([
              mediaDevices.getUserMedia(simpleConstraints),
              timeoutPromise
            ]);
            if (onLocalStreamCallback) {
              onLocalStreamCallback(localStream);
            }
          } catch (retryError) {
            console.error('[webrtcService] Failed to get video stream even with simple constraints:', retryError);
            throw retryError;
          }
        }
      } else {
        // If we have an audio-only stream, add video to it
        const existingVideoTracks = localStream.getVideoTracks();
        if (existingVideoTracks.length === 0) {
          try {
            // Get video track and add it to existing stream
            // iOS-compatible constraints
            const simpleVideoConstraints = { 
              video: { 
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 },
              } 
            };
            
            // iOS detection for web
            if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
              const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
              if (isIOS) {
                simpleVideoConstraints.video = {
                  facingMode: 'user',
                  width: { ideal: 640 },
                  height: { ideal: 480 },
                };
              }
            }
            
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Timeout starting video source')), 15000);
            });
            const videoStream = await Promise.race([
              mediaDevices.getUserMedia(simpleVideoConstraints),
              timeoutPromise
            ]);
            const videoTrack = videoStream.getVideoTracks()[0];
            if (videoTrack) {
              localStream.addTrack(videoTrack);
              
              // Add video track to peer connection
              if (peerConnection) {
                const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                  sender.replaceTrack(videoTrack);
                } else {
                  peerConnection.addTrack(videoTrack, localStream);
                }
              }
              
              // Stop the temporary video stream (we only needed the track)
              videoStream.getTracks().forEach(track => {
                if (track !== videoTrack) track.stop();
              });
            }
          } catch (error) {
            console.error('[webrtcService] Failed to add video track to existing stream:', error);
            throw error;
          }
        } else {
          // Video track exists, just enable it
          existingVideoTracks.forEach((track) => {
            track.enabled = true;
          });
        }
      }

      // Notify callback
      if (onLocalStreamCallback && localStream) {
        onLocalStreamCallback(localStream);
      }
    } else {
      // Disable video
      if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        videoTracks.forEach((track) => {
          track.enabled = false;
        });
      }
    }

    return enabled;
  } catch (error) {
    console.error('Error toggling video:', error);
    throw error;
  }
};

/**
 * Enable/disable audio (mute)
 */
export const toggleAudio = (enabled) => {
  if (!isWebRTCAvailable || !localStream) return false;

  const audioTracks = localStream.getAudioTracks();
  audioTracks.forEach((track) => {
    track.enabled = enabled;
  });

  return enabled;
};

/**
 * Switch camera (front/back)
 */
export const switchCamera = async () => {
  if (!isWebRTCAvailable) {
    console.warn('WebRTC not available - cannot switch camera');
    return;
  }

  try {
    if (!localStream) return;

    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      await videoTrack._switchCamera();
    }
  } catch (error) {
    console.error('Error switching camera:', error);
    throw error;
  }
};

/**
 * Close peer connection and cleanup
 */
export const closePeerConnection = () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  remoteStream = null;
  pendingIceCandidates = [];
  isNegotiating = false;

  console.log('Peer connection closed');
};

/**
 * Get current streams
 */
export const getStreams = () => ({
  local: localStream,
  remote: remoteStream,
});

/**
 * Get connection state
 */
export const getConnectionState = () => {
  if (!peerConnection) return 'closed';
  return peerConnection.connectionState;
};

/**
 * Set callbacks
 */
export const setCallbacks = ({
  onLocalStream,
  onRemoteStream,
  onConnectionStateChange,
  onError,
}) => {
  if (onLocalStream) onLocalStreamCallback = onLocalStream;
  if (onRemoteStream) onRemoteStreamCallback = onRemoteStream;
  if (onConnectionStateChange) onConnectionStateChangeCallback = onConnectionStateChange;
  if (onError) onErrorCallback = onError;
};

/**
 * Clear callbacks
 */
export const clearCallbacks = () => {
  onLocalStreamCallback = null;
  onRemoteStreamCallback = null;
  onConnectionStateChangeCallback = null;
  onErrorCallback = null;
};

export default {
  checkWebRTCAvailable,
  initializeWebRTC,
  getLocalStream,
  createPeerConnection,
  createAndSendOffer,
  toggleVideo,
  toggleAudio,
  switchCamera,
  closePeerConnection,
  getStreams,
  getConnectionState,
  setCallbacks,
  clearCallbacks,
};
