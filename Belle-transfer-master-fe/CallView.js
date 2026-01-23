import React, { useState, useEffect, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { activityAPI } from './src/services/api';

// Try to import RTCView - will fail in Expo Go
let RTCView = null;
try {
  RTCView = require('react-native-webrtc').RTCView;
} catch (error) {
  console.warn('RTCView not available (expected in Expo Go)');
}

// Web video components for rendering streams on web platform
const WebVideo = ({ stream, style, mirror, muted = false }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      // Ensure video plays on iOS
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.setAttribute('webkit-playsinline', 'true');
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  if (Platform.OS !== 'web') return null;

  return React.createElement('video', {
    ref: videoRef,
    autoPlay: true,
    playsInline: true,
    webkitPlaysinline: true, // iOS Safari compatibility
    muted: muted,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transform: mirror ? 'scaleX(-1)' : 'none',
      ...StyleSheet.flatten(style)
    }
  });
};

const RemoteWebVideo = ({ stream, style }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      // Ensure video plays on iOS
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.setAttribute('webkit-playsinline', 'true');
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  if (Platform.OS !== 'web') return null;

  return React.createElement('video', {
    ref: videoRef,
    autoPlay: true,
    playsInline: true,
    webkitPlaysinline: true, // iOS Safari compatibility
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      ...StyleSheet.flatten(style)
    }
  });
};

// Import call service with fallbacks
let requestVideo = () => {};
let acceptVideo = () => {};
let rejectVideo = () => {};
let requestHeartMatch = async () => false;
let acceptHeartMatch = async () => false;
let unmatchHeart = async () => false;
let skipToNextMatch = async () => false;
let requestVideoUpgrade = async () => false;
let acceptVideoUpgrade = async () => false;
let declineVideoUpgrade = async () => false;
let endCall = () => {};
let onCallEvent = () => () => {};

try {
  const callService = require('./src/services/callService');
  requestVideo = callService.requestVideo || (() => {});
  acceptVideo = callService.acceptVideo || (() => {});
  rejectVideo = callService.rejectVideo || (() => {});
  requestHeartMatch = callService.requestHeartMatch || (async () => false);
  acceptHeartMatch = callService.acceptHeartMatch || (async () => false);
  unmatchHeart = callService.unmatchHeart || (async () => false);
  skipToNextMatch = callService.skipToNextMatch || (async () => false);
  requestVideoUpgrade = callService.requestVideoUpgrade || (async () => false);
  acceptVideoUpgrade = callService.acceptVideoUpgrade || (async () => false);
  declineVideoUpgrade = callService.declineVideoUpgrade || (async () => false);
  endCall = callService.endCall || (() => {});
  onCallEvent = callService.onCallEvent || (() => () => {});
} catch (error) {
  console.warn('Call service not available');
}

// Import WebRTC service with fallbacks
let initializeWebRTC = () => () => {};
let getLocalStream = async () => null;
let createPeerConnection = async () => null;
let toggleVideo = async () => false;
let toggleAudio = () => false;
let switchCamera = async () => {};
let closePeerConnection = () => {};
let setCallbacks = () => {};
let clearCallbacks = () => {};
let getStreams = () => ({ local: null, remote: null });
let checkWebRTCAvailable = () => false;

try {
  const webrtcService = require('./src/services/webrtcService');
  initializeWebRTC = webrtcService.initializeWebRTC || (() => () => {});
  getLocalStream = webrtcService.getLocalStream || (async () => null);
  createPeerConnection = webrtcService.createPeerConnection || (async () => null);
  toggleVideo = webrtcService.toggleVideo || (async () => false);
  toggleAudio = webrtcService.toggleAudio || (() => false);
  switchCamera = webrtcService.switchCamera || (async () => {});
  closePeerConnection = webrtcService.closePeerConnection || (() => {});
  setCallbacks = webrtcService.setCallbacks || (() => {});
  clearCallbacks = webrtcService.clearCallbacks || (() => {});
  getStreams = webrtcService.getStreams || (() => ({ local: null, remote: null }));
  checkWebRTCAvailable = webrtcService.checkWebRTCAvailable || (() => false);
} catch (error) {
  console.warn('WebRTC service not available');
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CallView({
  callDuration,
  onEndCall,
  onNext,
  onSkipped, // Callback when user is skipped by partner - should restart matching
  formatCallTime,
  onCallStarted,
  partnerProfile,
  currentUserId,
  currentUserGender,
  partnerId,
  sessionId,
  roomId, // Add roomId prop - this is what we use to join the call room
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [videoRequestPending, setVideoRequestPending] = useState(false);
  const [videoRequestReceived, setVideoRequestReceived] = useState(false);
  const [videoRequestedBy, setVideoRequestedBy] = useState(null);
  const [localStreamURL, setLocalStreamURL] = useState(null);
  const [remoteStreamURL, setRemoteStreamURL] = useState(null);
  const [localStream, setLocalStream] = useState(null); // Store actual stream object for web
  const [remoteStream, setRemoteStream] = useState(null); // Store actual stream object for web
  const [connectionState, setConnectionState] = useState('new');
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  // Animated values for heart and video icons
  const heartAnim = useRef(new Animated.Value(1)).current;
  const videoAnim = useRef(new Animated.Value(1)).current;
  const [heartStatus, setHeartStatus] = useState('idle'); // idle, requested, incoming, matched

  // Animate heart icon when match interest is active
  useEffect(() => {
    if (heartStatus === 'incoming') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(heartAnim, { toValue: 1.3, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(heartAnim, { toValue: 1, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ]),
      ).start();
    } else {
      heartAnim.setValue(1);
    }
  }, [heartStatus]);

  // Animate video icon flicker when video request is received
  useEffect(() => {
    if (videoRequestReceived) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(videoAnim, { toValue: 0.3, duration: 200, useNativeDriver: true }),
          Animated.timing(videoAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      videoAnim.setValue(1);
    }
  }, [videoRequestReceived]);

  const webrtcInitialized = useRef(false);
  const callStartedOnce = useRef(false);
  const eventListenersSetup = useRef(false);

  // Initialize WebRTC when component mounts
  useEffect(() => {
    let unsubscribeWebRTC = null;

    const setupWebRTC = async () => {
      if (webrtcInitialized.current) return;
      webrtcInitialized.current = true;

      // Set up callbacks for WebRTC events
      setCallbacks({
        onLocalStream: (stream) => {
          console.log('Local stream received');
          // Handle stream URL - use toURL() for React Native WebRTC
          // On web, streams don't have toURL(), so we'll handle it differently
          try {
            if (stream && typeof stream.toURL === 'function') {
              // React Native WebRTC (native mobile)
              setLocalStreamURL(stream.toURL());
              setLocalStream(null); // Clear web stream
            } else if (stream) {
              // Web or other platforms - store stream object directly for video element
              console.log('Web platform detected - storing stream object directly');
              setLocalStream(stream); // Store actual stream for web
              setLocalStreamURL('web-stream'); // Placeholder for condition checks
            }
          } catch (error) {
            console.error('Error handling local stream:', error);
            // Don't fail completely, just log the error
          }
        },
        onRemoteStream: (stream) => {
          console.log('Remote stream received');
          // Handle stream URL - use toURL() for React Native WebRTC
          // On web, streams don't have toURL(), so we'll handle it differently
          try {
            if (stream && typeof stream.toURL === 'function') {
              // React Native WebRTC (native mobile)
              setRemoteStreamURL(stream.toURL());
              setRemoteStream(null); // Clear web stream
            } else if (stream) {
              // Web or other platforms - store stream object directly for video element
              console.log('Web platform detected - storing stream object directly');
              setRemoteStream(stream); // Store actual stream for web
              setRemoteStreamURL('web-stream'); // Placeholder for condition checks
            }
          } catch (error) {
            console.error('Error handling remote stream:', error);
            // Don't fail completely, just log the error
          }
        },
        onConnectionStateChange: (state) => {
          console.log('Connection state changed:', state);
          setConnectionState(state);
        },
        onError: (error) => {
          console.error('WebRTC error:', error);
          Alert.alert('Connection Error', error.message);
        },
      });

      // Initialize call socket and join room (required for WebRTC signaling)
      try {
        const callService = require('./src/services/callService');
        const { initializeCallSocket, joinCallRoom } = callService;
        
        // Initialize call socket with user gender
        await initializeCallSocket(currentUserGender || 'male');
        
        // Join the call room using roomId (preferred) or sessionId as fallback
        const roomToJoin = roomId || sessionId;
        if (roomToJoin) {
          joinCallRoom(roomToJoin);
          console.log('[CallView] Joined call room:', roomToJoin);
        } else {
          console.warn('[CallView] No roomId or sessionId provided, cannot join call room');
        }
      } catch (error) {
        console.error('[CallView] Failed to initialize call socket:', error);
      }

      // Initialize WebRTC signaling listener
      unsubscribeWebRTC = initializeWebRTC();

      // Get audio stream for voice call
      try {
        await getLocalStream(false); // Start with audio only
        // currentUserId is already passed as a prop
        await createPeerConnection(partnerId, currentUserId);
      } catch (error) {
        console.error('Failed to initialize WebRTC:', error);
      }
    };

    setupWebRTC();

    return () => {
      if (unsubscribeWebRTC) unsubscribeWebRTC();
      closePeerConnection();
      clearCallbacks();
      webrtcInitialized.current = false;
      callStartedOnce.current = false;
    };
  }, [partnerId, sessionId, roomId, currentUserGender]);

  // Subscribe to call events
  useEffect(() => {
    // Prevent duplicate listener setups
    if (eventListenersSetup.current) {
      return;
    }
    eventListenersSetup.current = true;
    console.log('[CallView] Setting up call event listeners');

    const unsubscribeHeartIncoming = onCallEvent('call:heart:incoming', () => {
      setHeartStatus('incoming');
    });

    const unsubscribeHeartPending = onCallEvent('call:heart:pending', () => {
      setHeartStatus('requested');
    });

    const unsubscribeHeartAccepted = onCallEvent('call:heart:accepted', () => {
      setHeartStatus('matched');
    });

    const unsubscribeHeartExpired = onCallEvent('call:heart:expired', () => {
      setHeartStatus('idle');
    });

    // Listen for unmatch events (when either user unmatches)
    const unsubscribeUnmatched = onCallEvent('match:unmatched', () => {
      setHeartStatus('idle');
    });

    // Listen for skip events (when the other user presses next/skip)
    const unsubscribeSkipped = onCallEvent('match:skipped', async (data) => {
      console.log('[CallView] Received match:skipped event:', data);
      
      // End the call and cleanup WebRTC
      closePeerConnection();
      
      // Re-queue this user (the one who was skipped) by calling skipMatch API
      // This ensures both users are re-queued when one clicks next
      if (sessionId) {
        try {
          const queueAPI = require('./src/services/api').queueAPI;
          await queueAPI.skipMatch(sessionId);
          console.log('[CallView] Re-queued user after being skipped by partner');
        } catch (err) {
          console.error('[CallView] Error re-queuing after skip:', err);
        }
      }
      
      // End the call via callback - this handles cleanup
      if (typeof onEndCall === 'function') {
        onEndCall();
      }
      
      // Call onSkipped callback to restart matching (if provided)
      // This ensures the skipped user also restarts matching, just like when they click next
      if (typeof onSkipped === 'function') {
        try {
          await onSkipped();
          console.log('[CallView] Restarted matching after being skipped');
        } catch (err) {
          console.error('[CallView] Error restarting matching after skip:', err);
        }
      }
      
      // Show alert
      Alert.alert('Match Ended', 'Your match has moved to the next person.');
    });

    const unsubscribeVideoIncoming = onCallEvent('call:video:incoming', (data) => {
      console.log('[CallView] Received call:video:incoming event:', data);
      setVideoRequestReceived(true);
      setVideoRequestedBy(data.fromUserId || data.userId);
      setVideoRequestPending(false);
    });

    const unsubscribeVideoPending = onCallEvent('call:video:pending', (data) => {
      console.log('[CallView] Received call:video:pending event:', data);
      setVideoRequestPending(true);
    });

    const unsubscribeVideoAccepted = onCallEvent('call:video:accepted', async (data) => {
      console.log('[CallView] Received call:video:accepted event:', data);
      setIsVideoEnabled(true);
      setVideoRequestPending(false);
      setVideoRequestReceived(false);

      try {
        // Add a small delay to ensure peer connection is ready
        await new Promise(resolve => setTimeout(resolve, 500));
        await toggleVideo(true);
        console.log('[CallView] Video enabled successfully');
      } catch (error) {
        console.error('[CallView] Failed to enable video:', error);
        // Don't show alert on timeout - just log it
        if (error.message && error.message.includes('Timeout')) {
          console.warn('[CallView] Video timeout - camera may be in use or permissions not granted');
        }
      }
    });

    const unsubscribeVideoDeclined = onCallEvent('call:video:declined', (data) => {
      console.log('[CallView] Received call:video:declined event:', data);
      setVideoRequestPending(false);
      setVideoRequestReceived(false);
      Alert.alert('Video Request', 'Your video request was declined.');
    });

    // Also listen to interaction-service video events (fallback)
    const unsubscribeVideoRequestedRtc = onCallEvent('video-requested', (data) => {
      setVideoRequestReceived(true);
      setVideoRequestedBy(data.userId || data.fromUserId);
      setVideoRequestPending(false);
    });

    const unsubscribeVideoSentRtc = onCallEvent('video-request-sent', () => {
      setVideoRequestPending(true);
    });

    const unsubscribeVideoEnabledRtc = onCallEvent('video-enabled', async () => {
      setIsVideoEnabled(true);
      setVideoRequestPending(false);
      setVideoRequestReceived(false);
      try {
        // Add a small delay to ensure peer connection is ready
        await new Promise(resolve => setTimeout(resolve, 500));
        await toggleVideo(true);
        console.log('[CallView] Video enabled successfully (RTC)');
      } catch (error) {
        console.error('[CallView] Failed to enable video (RTC):', error);
      }
    });

    const unsubscribeVideoRejectedRtc = onCallEvent('video-rejected', () => {
      setVideoRequestPending(false);
      setVideoRequestReceived(false);
      Alert.alert('Video Request', 'Your video request was declined.');
    });

    const unsubscribeCallStarted = onCallEvent('call-started', () => {
      if (!callStartedOnce.current && typeof onCallStarted === 'function') {
        callStartedOnce.current = true;
        onCallStarted();
      }
    });

    const unsubscribeJoinedRoom = onCallEvent('joined-room', () => {
      if (!callStartedOnce.current && typeof onCallStarted === 'function') {
        callStartedOnce.current = true;
        onCallStarted();
      }
    });

    // Listen for call-ended event (when other user ends the call)
    const unsubscribeCallEnded = onCallEvent('call-ended', async (data) => {
      closePeerConnection();
      activityAPI.logActivity({
        type: 'CALL_ENDED',
        title: 'Call ended',
        description: 'The audio call ended.',
        metadata: {
          partnerId,
          roomId: roomId || sessionId,
          sessionId,
        },
      }).catch((error) => {
        // Silently fail activity logging
      });
      
      // End the call locally
      if (typeof onEndCall === 'function') {
        onEndCall();
      }
      
      // If this was triggered by next button (not just end call), restart matching
      // Check if onSkipped callback exists - if so, this means we should restart matching
      if (typeof onSkipped === 'function') {
        try {
          await onSkipped();
        } catch (err) {
          console.error('[CallView] Error restarting matching after call ended:', err);
        }
      }
    });

    return () => {
      console.log('[CallView] Cleaning up call event listeners');
      eventListenersSetup.current = false;
      unsubscribeHeartIncoming();
      unsubscribeHeartPending();
      unsubscribeHeartAccepted();
      unsubscribeHeartExpired();
      unsubscribeVideoIncoming();
      unsubscribeVideoPending();
      unsubscribeVideoAccepted();
      unsubscribeVideoDeclined();
      if (unsubscribeVideoRequestedRtc) unsubscribeVideoRequestedRtc();
      if (unsubscribeVideoSentRtc) unsubscribeVideoSentRtc();
      if (unsubscribeVideoEnabledRtc) unsubscribeVideoEnabledRtc();
      if (unsubscribeVideoRejectedRtc) unsubscribeVideoRejectedRtc();
      if (unsubscribeUnmatched) unsubscribeUnmatched();
      if (unsubscribeSkipped) unsubscribeSkipped();
      if (unsubscribeCallEnded) unsubscribeCallEnded();
      if (unsubscribeCallStarted) unsubscribeCallStarted();
      if (unsubscribeJoinedRoom) unsubscribeJoinedRoom();
    };
  }, []);

  const handleToggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    toggleAudio(!newMutedState); // toggleAudio takes 'enabled' param
  };

  const handleVideoToggle = async () => {
    console.log('[CallView] handleVideoToggle called', {
      isVideoEnabled,
      videoRequestReceived,
      videoRequestPending,
      partnerId,
      currentUserId,
      roomId,
      sessionId,
    });

    if (isVideoEnabled) {
      // Video already enabled - toggle camera on/off
      console.log('[CallView] Video already enabled, toggling camera');
      try {
        const videoTracks = getStreams().local?.getVideoTracks();
        if (videoTracks && videoTracks.length > 0) {
          const newEnabled = !videoTracks[0].enabled;
          await toggleVideo(newEnabled);
          if (!newEnabled) {
            setLocalStreamURL(null);
          }
        }
      } catch (error) {
        console.error('Failed to toggle video:', error);
      }
      return;
    }

    if (videoRequestReceived) {
      console.log('[CallView] Video request already received, ignoring');
      return;
    }

    if (videoRequestPending) {
      console.log('[CallView] Video request already pending');
      return;
    }

    // Automatically request video without confirmation
    console.log('[CallView] Automatically requesting video upgrade');
    const roomToUse = roomId || sessionId;
    
    if (!roomToUse || !partnerId || !currentUserId) {
      console.error('[CallView] Missing required information:', {
        hasRoomToUse: !!roomToUse,
        hasPartnerId: !!partnerId,
        hasCurrentUserId: !!currentUserId,
      });
      return;
    }

    const ok = await requestVideoUpgrade({
      toUserId: partnerId,
      fromUserId: currentUserId,
      roomId: roomToUse,
      sessionId,
    });
    
    console.log('[CallView] requestVideoUpgrade result:', ok);
    
    if (ok) {
      setVideoRequestPending(true);
      console.log('[CallView] Video request sent, waiting for response...');
    } else {
      console.warn('[CallView] requestVideoUpgrade failed, trying fallback');
      // Fallback to interaction-service video request
      const rtcOk = requestVideo(currentUserId);
      if (rtcOk) {
        setVideoRequestPending(true);
      }
    }
  };

  const handleSwitchCamera = async () => {
    try {
      await switchCamera();
      setIsFrontCamera(!isFrontCamera);
    } catch (error) {
      console.error('Failed to switch camera:', error);
    }
  };

  const handleAcceptVideoRequest = async () => {
    const roomToUse = roomId || sessionId;
    const ok = await acceptVideoUpgrade({
      fromUserId: partnerId,
      toUserId: currentUserId,
      roomId: roomToUse,
      sessionId,
    });
    if (!ok) {
      acceptVideo(currentUserId);
    }
    setVideoRequestReceived(false);
    setIsVideoEnabled(true);

    // Enable video after accepting
    try {
      // Add a small delay to ensure peer connection is ready
      await new Promise(resolve => setTimeout(resolve, 500));
      await toggleVideo(true);
      console.log('[CallView] Video enabled after accepting request');
    } catch (error) {
      console.error('[CallView] Failed to enable video after accepting:', error);
      // Don't show alert, video might still work
    }
  };

  const handleRejectVideoRequest = () => {
    const roomToUse = roomId || sessionId;
    const ok = declineVideoUpgrade({
      fromUserId: partnerId,
      toUserId: currentUserId,
      roomId: roomToUse,
      sessionId,
    });
    if (!ok) {
      rejectVideo(currentUserId);
    }
    setVideoRequestReceived(false);
  };

  const handleHeartPress = async () => {
    const roomToUse = roomId || sessionId;
    if (!roomToUse || !partnerId) return;

    // If already matched (green heart), unmatch
    if (heartStatus === 'matched') {
      Alert.alert(
        'Unmatch',
        'Are you sure you want to unmatch?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unmatch',
            style: 'destructive',
            onPress: async () => {
              await unmatchHeart({
                toUserId: partnerId,
                roomId: roomToUse,
                sessionId,
              });
              setHeartStatus('idle');
            },
          },
        ]
      );
      return;
    }

    if (heartStatus === 'incoming') {
      await acceptHeartMatch({
        fromUserId: partnerId,
        toUserId: currentUserId,
        roomId: roomToUse,
        sessionId,
      });
      return;
    }

    if (heartStatus === 'idle') {
      await requestHeartMatch({
        toUserId: partnerId,
        roomId: roomToUse,
        sessionId,
      });
      setHeartStatus('requested');
    }
  };

  const heartColor = heartStatus === 'matched'
    ? '#4CAF50'
    : heartStatus === 'requested' || heartStatus === 'incoming'
      ? '#ff3b30'
      : '#FFD700';

  const isEndingCall = useRef(false);
  
  const handleEndCall = () => {
    // Prevent multiple calls to endCall
    if (isEndingCall.current) {
      return;
    }
    
    isEndingCall.current = true;
    
    // Notify backend that call is ending (this will notify the other user)
    if (roomId || sessionId) {
      try {
        const callService = require('./src/services/callService');
        callService.endCall(roomId || sessionId);
      } catch (error) {
        console.error('[CallView] Failed to notify backend of call end:', error);
      }
    }
    closePeerConnection();
    activityAPI.logActivity({
      type: 'CALL_ENDED',
      title: 'Call ended',
      description: 'You ended the audio call.',
      metadata: {
        partnerId,
        roomId: roomId || sessionId,
        sessionId,
      },
    }).catch((error) => {
      // Silently fail activity logging
    });
    onEndCall();
    
    // Reset flag after a short delay to allow cleanup
    setTimeout(() => {
      isEndingCall.current = false;
    }, 1000);
  };

  const handleNext = async () => {
    // Prevent multiple calls
    if (isEndingCall.current) {
      return;
    }
    
    isEndingCall.current = true;
    
    try {
      // End the call for both users (same logic as handleEndCall/red button)
      // This emits 'end-call' to backend, which disconnects both users
      if (roomId || sessionId) {
        try {
          const callService = require('./src/services/callService');
          callService.endCall(roomId || sessionId);
        } catch (error) {
          console.error('[CallView] Failed to notify backend of call end:', error);
        }
      }
      closePeerConnection();
      
      // Log activity
      activityAPI.logActivity({
        type: 'CALL_ENDED',
        title: 'Skipped to next',
        description: 'You skipped to the next match.',
        metadata: {
          partnerId,
          roomId: roomId || sessionId,
          sessionId,
        },
      }).catch(() => {});
      
      // End call locally (this sets isInCall = false, hides CallView)
      if (typeof onEndCall === 'function') {
        onEndCall();
      }
      
      // Then restart matching (onNext will call skipMatch API + startMatching)
      if (typeof onNext === 'function') {
        setTimeout(async () => {
          await onNext();
        }, 300);
      }
    } catch (error) {
      console.error('[CallView] Error in handleNext:', error);
    } finally {
      // Reset flag after a short delay to allow cleanup
      setTimeout(() => {
        isEndingCall.current = false;
      }, 1000);
    }
  };

  // Use partner profile data if available, otherwise show placeholder
  const profile = partnerProfile || {
    name: 'Your Match',
    age: null,
    title: '',
    location: '',
    bio: 'Getting to know each other...',
    lookingFor: '',
    interests: [],
    isVerified: false,
  };

  const formatPreferenceValue = (value) => {
    if (Array.isArray(value)) {
      return value.filter(Boolean).join(', ');
    }
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    if (value === null || value === undefined || value === '') return '';
    return String(value);
  };

  const aboutMeItems = [
    { key: 'education', label: 'Education', value: profile.educationLevel, icon: 'school' },
    { key: 'religion', label: 'Religion', value: profile.religion, icon: 'ribbon' },
    { key: 'familyPlans', label: 'Family Plans', value: profile.familyPlans, icon: 'people' },
    { key: 'hasKids', label: 'Have Kids', value: profile.hasKids, icon: 'heart' },
    { key: 'ethnicity', label: 'Ethnicity', value: profile.ethnicity, icon: 'globe' },
    { key: 'politicalViews', label: 'Political Views', value: profile.politicalViews, icon: 'flag' },
    { key: 'exercise', label: 'Exercise', value: profile.exercise, icon: 'fitness' },
    { key: 'smoking', label: 'Smoking', value: profile.smoking, icon: 'ban' },
    { key: 'drinking', label: 'Drinking', value: profile.drinking, icon: 'wine' },
    { key: 'languages', label: 'Languages', value: profile.languages, icon: 'chatbubbles' },
  ];
  const visibleAboutMeItems = aboutMeItems.filter((item) => formatPreferenceValue(item.value));

  console.log('[CallView]', {
    file: 'CallView.js',
    aboutMeItems: visibleAboutMeItems.map((item) => ({
      key: item.key,
      value: item.value,
    })),
  });

  return (
    <View style={styles.callContainer}>
      <View style={styles.callTopBar}>
        <View style={styles.callDuration}>
          <Ionicons name="call" size={12} color="#ffffff" />
          <Text style={styles.callDurationText}>{formatCallTime(callDuration)}</Text>
        </View>
        <View style={styles.callTopIcons}>
          {videoRequestReceived && (
            <View style={styles.videoResponseButtons}>
              <TouchableOpacity style={styles.videoResponseButton} onPress={handleRejectVideoRequest}>
                <Ionicons name="close-circle" size={20} color="#ff3b30" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.videoResponseButton} onPress={handleAcceptVideoRequest}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            style={[styles.topIconButton, isVideoEnabled && styles.activeTopIcon]}
            onPress={() => {
              console.log('[CallView] Video icon button pressed');
              handleVideoToggle();
            }}
            activeOpacity={0.7}
          >
            <Animated.View style={{ opacity: videoAnim }}>
              <Ionicons
                name="videocam"
                size={20}
                color={
                  isVideoEnabled || videoRequestPending || videoRequestReceived
                    ? '#4CAF50'
                    : '#999999'
                }
              />
            </Animated.View>
            {videoRequestPending && (
              <View style={styles.pendingDot} />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.topIconButton} onPress={handleHeartPress}>
            <Animated.View style={{ transform: [{ scale: heartAnim }] }}>
              <Ionicons name="heart" size={20} color={heartColor} />
            </Animated.View>
            {heartStatus === 'incoming' && (
              <View style={styles.heartSparkle}>
                <Ionicons name="sparkles" size={10} color="#ff3b30" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Full-screen video mode when video is enabled */}
      {isVideoEnabled && (remoteStreamURL || localStreamURL || remoteStream || localStream) && (RTCView || Platform.OS === 'web') ? (
        <View style={styles.videoContainer}>
          {/* Remote video (full screen) */}
          {Platform.OS === 'web' ? (
            // Web platform - use HTML video element
            remoteStream ? (
              <RemoteWebVideo
                stream={remoteStream}
                style={styles.remoteVideo}
              />
            ) : (
              <View style={styles.waitingForVideo}>
                <Ionicons name="videocam" size={60} color="#ffffff" />
                <Text style={styles.waitingText}>Waiting for partner's video...</Text>
              </View>
            )
          ) : (
            // Native platform - use RTCView
            remoteStreamURL ? (
              <RTCView
                streamURL={remoteStreamURL}
                style={styles.remoteVideo}
                objectFit="cover"
                mirror={false}
              />
            ) : (
              <View style={styles.waitingForVideo}>
                <Ionicons name="videocam" size={60} color="#ffffff" />
                <Text style={styles.waitingText}>Waiting for partner's video...</Text>
              </View>
            )
          )}

          {/* Local video (picture-in-picture) */}
          {(localStreamURL || localStream) && (
            <View style={styles.localVideoContainer}>
              {Platform.OS === 'web' ? (
                // Web platform - use HTML video element
                localStream ? (
                  <WebVideo
                    stream={localStream}
                    style={styles.localVideo}
                    mirror={isFrontCamera}
                    muted={true}
                  />
                ) : null
              ) : (
                // Native platform - use RTCView
                localStreamURL ? (
                  <RTCView
                    streamURL={localStreamURL}
                    style={styles.localVideo}
                    objectFit="cover"
                    mirror={isFrontCamera}
                    zOrder={1}
                  />
                ) : null
              )}
              <TouchableOpacity
                style={styles.switchCameraButton}
                onPress={handleSwitchCamera}
              >
                <Ionicons name="camera-reverse" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          )}

          {/* Connection state indicator */}
          {connectionState !== 'connected' && (
            <View style={styles.connectionStateOverlay}>
              <Text style={styles.connectionStateText}>
                {connectionState === 'connecting' ? 'Connecting...' :
                 connectionState === 'disconnected' ? 'Reconnecting...' :
                 connectionState === 'failed' ? 'Connection failed' : ''}
              </Text>
            </View>
          )}

          {/* Partner info overlay */}
          <View style={styles.videoInfoOverlay}>
            <Text style={styles.videoPartnerName}>
              {profile.name}{profile.age ? `, ${profile.age}` : ''}
            </Text>
          </View>
        </View>
      ) : (
        /* Audio-only mode - show profile */
        <ScrollView style={styles.profileDetails} showsVerticalScrollIndicator={false}>
          <View style={styles.profileImageContainer}>
            {profile.profilePicture ? (
              <Image 
                source={{ uri: profile.profilePicture }} 
                style={styles.profileImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.profileImage}>
                <Ionicons name="person" size={100} color="#cccccc" />
              </View>
            )}

            <LinearGradient
              colors={['transparent', 'rgba(0, 0, 0, 0.7)']}
              locations={[0.3, 1]}
              style={styles.imageOverlay}
            />

            <View style={styles.profileInfoOverlay}>
              {profile.isPhotoVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#4CAF50" />
                  <Text style={styles.verifiedText}>Photo Verified</Text>
                </View>
              )}
              <Text style={styles.profileName}>
                {profile.name}{profile.age ? `, ${profile.age}` : ''}
              </Text>
              {profile.location ? (
                <Text style={styles.profileLocation}>{profile.location.toUpperCase()}</Text>
              ) : null}
            </View>
          </View>

        {profile.bio ? (
          <View style={styles.bioSection}>
            <Text style={styles.bioTitle}>Bio</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        ) : null}

        {/* About Me Section (Preferences) - Carousel */}
        <View style={styles.preferencesSection}>
          <Text style={styles.sectionTitle}>About Me</Text>
          {visibleAboutMeItems.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.preferencesCarousel}
              contentContainerStyle={styles.preferencesCarouselContent}
            >
              {visibleAboutMeItems.map((item) => (
                <View key={item.key} style={styles.preferenceCard}>
                  <Ionicons name={item.icon} size={24} color="#666666" />
                  <Text style={styles.preferenceCardTitle}>{item.label}</Text>
                  <Text style={styles.preferenceCardValue} numberOfLines={2}>
                    {formatPreferenceValue(item.value)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.aboutMeEmpty}>No preferences added yet.</Text>
          )}
        </View>

        {profile.interests && profile.interests.length > 0 ? (
          <View style={styles.interestsSection}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.interestsContainer}>
              {profile.interests.map((interest, index) => (
                <View key={index} style={styles.interestTag}>
                  <Text style={styles.interestTagText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Additional Photos - Single Column */}
        {profile.photos && profile.photos.length > 0 ? (
          <View style={styles.photosSection}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <View style={styles.photosContainer}>
              {profile.photos.map((photo, index) => {
                // Handle both string URLs and objects with url property
                const photoUrl = typeof photo === 'string' ? photo : (photo.url || photo.uri || photo);
                return (
                  <Image
                    key={index}
                    source={{ uri: photoUrl }}
                    style={styles.photoThumbnail}
                    resizeMode="cover"
                  />
                );
              })}
            </View>
          </View>
        ) : null}
        </ScrollView>
      )}

      <View style={styles.callControls}>
        <View style={styles.controlButtonsGroup}>
          {/* Mute/Unmute button */}
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.mutedButton]}
            onPress={handleToggleMute}
          >
            <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color={isMuted ? '#ff4444' : '#000000'} />
          </TouchableOpacity>

          {/* End Call button - Center */}
          <TouchableOpacity style={[styles.controlButton, styles.endCallButton]} onPress={handleEndCall}>
            <Ionicons name="call" size={24} color="#ffffff" />
          </TouchableOpacity>

          {/* Next button */}
          {onNext ? (
            <TouchableOpacity
              style={[styles.controlButton, styles.nextButton]}
              onPress={handleNext}
            >
              <Ionicons name="arrow-forward" size={24} color="#000000" />
            </TouchableOpacity>
          ) : (
            <View style={styles.controlButton} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  callContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 50,
  },
  videoRequestModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  videoRequestContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginHorizontal: 40,
    width: '80%',
  },
  videoRequestTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  videoRequestText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  videoRequestButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  videoRequestButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 100,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButtonText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  callTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  callDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    width: 80,
    justifyContent: 'center',
  },
  callDurationText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  callTopIcons: {
    flexDirection: 'row',
    gap: 16,
  },
  videoResponseButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
  },
  videoResponseButton: {
    padding: 8,
  },
  topIconButton: {
    padding: 8,
    position: 'relative',
  },
  activeTopIcon: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 20,
  },
  pendingDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFA500',
  },
  heartSparkle: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  profileImageContainer: {
    height: 400,
    position: 'relative',
    marginHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 20,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholderText: {
    marginTop: 12,
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '500',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 6,
    gap: 3,
  },
  verifiedText: {
    color: '#4CAF50',
    fontSize: 10,
    fontWeight: '600',
  },
  profileInfoOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
  },
  profileName: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  profileTitle: {
    color: '#ffffff',
    fontSize: 18,
    marginBottom: 2,
  },
  profileLocation: {
    color: '#ffffff',
    fontSize: 16,
  },
  profileDetails: {
    flex: 1,
    paddingBottom: 180,
  },
  bioSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  bioTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
  },
  lookingForSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  lookingForTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  lookingForText: {
    fontSize: 16,
    color: '#000000',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
  },
  interestsSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  interestTagText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  photosSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  photosContainer: {
    flexDirection: 'column',
  },
  photoThumbnail: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
  },
  preferencesSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  preferencesCarousel: {
    marginTop: 12,
  },
  preferencesCarouselContent: {
    paddingRight: 20,
  },
  preferenceCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    width: 160,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  preferenceCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  preferenceCardValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    textAlign: 'center',
  },
  aboutMeEmpty: {
    fontSize: 13,
    color: '#888888',
    marginTop: 8,
  },
  callControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  controlButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  mutedButton: {
    backgroundColor: '#ffeeee',
    borderColor: '#ffcccc',
  },
  endCallButton: {
    backgroundColor: '#ff4444',
    borderColor: '#ff4444',
  },
  videoOnButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderColor: '#4CAF50',
  },
  videoOffButton: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
  },
  nextButton: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
  },
  callControlsVideo: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderTopWidth: 0,
  },
  // Video container styles
  videoContainer: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  waitingForVideo: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ffffff',
  },
  localVideoContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#333333',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },
  switchCameraButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectionStateOverlay: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  connectionStateText: {
    color: '#ffffff',
    fontSize: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  videoInfoOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
  },
  videoPartnerName: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
