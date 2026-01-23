/**
 * WebRTC Service
 * Handles peer connections, media streams, and ICE negotiation
 * Works with callService.js for signaling
 *
 * NOTE: This service requires react-native-webrtc which needs a development build.
 * It will gracefully fail in Expo Go.
 */

// Try to import WebRTC - will fail in Expo Go
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
  console.log('WebRTC module loaded successfully');
} catch (error) {
  console.warn('WebRTC not available (expected in Expo Go):', error.message);
  isWebRTCAvailable = false;
}

// Import call service (this should work in Expo Go)
let sendWebRTCSignal = () => {};
let onCallEvent = () => () => {};

try {
  const callService = require('./callService');
  sendWebRTCSignal = callService.sendWebRTCSignal || (() => {});
  onCallEvent = callService.onCallEvent || (() => () => {});
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

const VIDEO_CONSTRAINTS = {
  facingMode: 'user',
  width: { ideal: 1280, max: 1920 },
  height: { ideal: 720, max: 1080 },
  frameRate: { ideal: 30, max: 30 },
};

// State
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let pendingIceCandidates = [];
let isNegotiating = false;

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
    return () => {};
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
    const constraints = {
      audio: AUDIO_CONSTRAINTS,
      video: enableVideo ? VIDEO_CONSTRAINTS : false,
    };

    localStream = await mediaDevices.getUserMedia(constraints);

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
export const createPeerConnection = async (userId) => {
  if (!isWebRTCAvailable) {
    console.warn('WebRTC not available - cannot create peer connection');
    return null;
  }

  try {
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
          userId,
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
    peerConnection.onnegotiationneeded = async () => {
      if (isNegotiating) return;

      try {
        isNegotiating = true;
        await createAndSendOffer(userId);
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
    return null;
  }

  try {
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await peerConnection.setLocalDescription(offer);

    sendWebRTCSignal({
      type: 'offer',
      sdp: offer.sdp,
      userId,
    });

    console.log('Offer sent');
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
    if (!localStream) {
      if (enabled) {
        // Get new stream with video
        await getLocalStream(true);

        // Add video track to peer connection
        if (peerConnection && localStream) {
          const videoTrack = localStream.getVideoTracks()[0];
          if (videoTrack) {
            const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(videoTrack);
            } else {
              peerConnection.addTrack(videoTrack, localStream);
            }
          }
        }
      }
      return;
    }

    const videoTracks = localStream.getVideoTracks();
    videoTracks.forEach((track) => {
      track.enabled = enabled;
    });

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
