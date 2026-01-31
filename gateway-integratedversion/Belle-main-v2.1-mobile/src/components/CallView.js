import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSocket } from '../context/SocketContext';
import {
  initializeCallSocket,
  joinCallRoom,
  requestVideo as requestVideoService,
  acceptVideo as acceptVideoService,
  rejectVideo as rejectVideoService,
  onCallEvent as onCallEventService,
} from '../services/callService';

// Try to import RTCView - will fail in Expo Go
let RTCView = null;
try {
  RTCView = require('react-native-webrtc').RTCView;
} catch (error) {
  console.warn('RTCView not available (expected in Expo Go)');
}

// Use imported call service functions with fallbacks
const requestVideo = requestVideoService || (() => { console.warn('requestVideo not available'); });
const acceptVideo = acceptVideoService || (() => { console.warn('acceptVideo not available'); });
const rejectVideo = rejectVideoService || (() => { console.warn('rejectVideo not available'); });
const onCallEvent = onCallEventService || (() => () => {});

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
  const webrtcService = require('../services/webrtcService');
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
  formatCallTime,
  partnerProfile,
  currentUserId,
  currentUserGender,
  partnerId,
  roomId,
  sessionId,
  onNext,
}) {
  const {
    sendHeartRequest,
    sendHeartAccept,
    sendHeartUnmatch,
    onHeartIncoming,
    onHeartPending,
    onHeartAccepted,
    onHeartUnmatched,
  } = useSocket();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [videoRequestPending, setVideoRequestPending] = useState(false);
  const [videoRequestReceived, setVideoRequestReceived] = useState(false);
  const [videoRequestedBy, setVideoRequestedBy] = useState(null);
  const [localStreamURL, setLocalStreamURL] = useState(null);
  const [remoteStreamURL, setRemoteStreamURL] = useState(null);
  const [connectionState, setConnectionState] = useState('new');
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isMatched, setIsMatched] = useState(false);
  const [heartPending, setHeartPending] = useState(false);
  const [incomingHeart, setIncomingHeart] = useState(false);
  const [incomingFromUserId, setIncomingFromUserId] = useState(null);
  const [callReady, setCallReady] = useState(false);

  const webrtcInitialized = useRef(false);

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
          setLocalStreamURL(stream.toURL());
        },
        onRemoteStream: (stream) => {
          console.log('Remote stream received');
          setRemoteStreamURL(stream.toURL());
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

      // Initialize WebRTC signaling listener
      unsubscribeWebRTC = initializeWebRTC();

      // Get audio stream for voice call
      try {
        await getLocalStream(false); // Start with audio only
        await createPeerConnection(partnerId);
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
    };
  }, [partnerId]);

  // Subscribe to call events
  useEffect(() => {
    const unsubscribeVideoRequested = onCallEvent('video-requested', (data) => {
      setVideoRequestReceived(true);
      setVideoRequestedBy(data.requestedBy);
    });

    const unsubscribeVideoRequestSent = onCallEvent('video-request-sent', () => {
      setVideoRequestPending(true);
    });

    const unsubscribeVideoEnabled = onCallEvent('video-enabled', async () => {
      setIsVideoEnabled(true);
      setVideoRequestPending(false);
      setVideoRequestReceived(false);

      // Enable video when accepted
      try {
        await toggleVideo(true);
      } catch (error) {
        console.error('Failed to enable video:', error);
      }
    });

    const unsubscribeVideoRejected = onCallEvent('video-rejected', () => {
      setVideoRequestPending(false);
      Alert.alert('Video Request', 'Your video request was declined.');
    });

    return () => {
      unsubscribeVideoRequested();
      unsubscribeVideoRequestSent();
      unsubscribeVideoEnabled();
      unsubscribeVideoRejected();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    initializeCallSocket(currentUserGender || 'male')
      .then(() => {
        if (!mounted) return;
        setCallReady(true);
        if (sessionId) {
          joinCallRoom(sessionId);
        }
      })
      .catch((err) => console.warn('Call socket init failed:', err));

    return () => {
      mounted = false;
    };
  }, [sessionId, currentUserGender]);

  useEffect(() => {
    const unsubRequested = onCallEvent('video-requested', () => {
      setVideoRequestPending(true);
    });
    const unsubSent = onCallEvent('video-request-sent', () => {
      setVideoRequestPending(true);
    });
    const unsubEnabled = onCallEvent('video-enabled', () => {
      setIsVideoEnabled(true);
      setVideoRequestPending(false);
    });
    const unsubRejected = onCallEvent('video-rejected', () => {
      setVideoRequestPending(false);
    });

    return () => {
      unsubRequested && unsubRequested();
      unsubSent && unsubSent();
      unsubEnabled && unsubEnabled();
      unsubRejected && unsubRejected();
    };
  }, []);

  useEffect(() => {
    const unsubscribeIncoming = onHeartIncoming((data) => {
      if (!partnerId || data?.fromUserId !== partnerId) return;
      setIncomingHeart(true);
      setIncomingFromUserId(data.fromUserId);
      setHeartPending(false);
    });

    const unsubscribePending = onHeartPending((data) => {
      if (!partnerId || data?.toUserId !== partnerId) return;
      setHeartPending(true);
    });

    const unsubscribeAccepted = onHeartAccepted((data) => {
      if (!partnerId) return;
      if (data?.fromUserId === partnerId || data?.toUserId === partnerId) {
        setIsMatched(true);
        setIncomingHeart(false);
        setIncomingFromUserId(null);
        setHeartPending(false);
      }
    });

    const unsubscribeUnmatched = onHeartUnmatched((data) => {
      if (!partnerId) return;
      if (data?.fromUserId === partnerId || data?.toUserId === partnerId) {
        setIsMatched(false);
        setIncomingHeart(false);
        setIncomingFromUserId(null);
        setHeartPending(false);
      }
    });

    return () => {
      unsubscribeIncoming();
      unsubscribePending();
      unsubscribeAccepted();
      unsubscribeUnmatched();
    };
  }, [partnerId, onHeartIncoming, onHeartPending, onHeartAccepted, onHeartUnmatched]);

  // Reset heart state when partner changes (new call), but don't auto-set matched
  useEffect(() => {
    if (partnerId) {
      // Reset to unmatched state for new call - hearts start grey
      setIsMatched(false);
      setHeartPending(false);
      setIncomingHeart(false);
      setIncomingFromUserId(null);
    }
  }, [partnerId]);

  const handleToggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    toggleAudio(!newMutedState); // toggleAudio takes 'enabled' param
  };

  const handleVideoToggle = async () => {
    if (isVideoEnabled) {
      // Video already enabled - toggle camera on/off
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

    if (videoRequestPending) {
      Alert.alert('Video Request', 'Your video request is pending.');
      return;
    }

    requestVideo(currentUserId);
    setVideoRequestPending(true);
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
    acceptVideo(currentUserId);
    setVideoRequestReceived(false);
    setIsVideoEnabled(true);

    // Enable video after accepting
    try {
      await toggleVideo(true);
    } catch (error) {
      console.error('Failed to enable video after accepting:', error);
    }
  };

  const handleRejectVideoRequest = () => {
    rejectVideo(currentUserId);
    setVideoRequestReceived(false);
  };

  const handleEndCall = () => {
    closePeerConnection();
    onEndCall();
  };

  const handleHeartPress = () => {
    if (!partnerId) return;

    if (isMatched) {
      sendHeartUnmatch({ toUserId: partnerId, roomId, sessionId });
      setIsMatched(false);
      setHeartPending(false);
      setIncomingHeart(false);
      setIncomingFromUserId(null);
      return;
    }

    if (incomingHeart && incomingFromUserId) {
      sendHeartAccept({
        fromUserId: incomingFromUserId,
        toUserId: currentUserId,
        roomId,
        sessionId,
      });
      setIsMatched(true);
      setIncomingHeart(false);
      setIncomingFromUserId(null);
      setHeartPending(false);
      return;
    }

    sendHeartRequest({ toUserId: partnerId, roomId, sessionId });
    setHeartPending(true);
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

  return (
    <View style={styles.callContainer}>
      {/* Video Request Modal for Female Users */}
      {videoRequestReceived && currentUserGender === 'female' && (
        <View style={styles.videoRequestModal}>
          <View style={styles.videoRequestContent}>
            <Ionicons name="videocam" size={40} color="#000000" />
            <Text style={styles.videoRequestTitle}>Video Request</Text>
            <Text style={styles.videoRequestText}>
              Your match would like to turn on video. You have control.
            </Text>
            <View style={styles.videoRequestButtons}>
              <TouchableOpacity
                style={[styles.videoRequestButton, styles.rejectButton]}
                onPress={handleRejectVideoRequest}
              >
                <Text style={styles.rejectButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.videoRequestButton, styles.acceptButton]}
                onPress={handleAcceptVideoRequest}
              >
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <View style={styles.callTopBar}>
        <View style={styles.callDuration}>
          <Ionicons name="call" size={12} color="#ffffff" />
          <Text style={styles.callDurationText}>{formatCallTime(callDuration)}</Text>
        </View>
        <View style={styles.callTopIcons}>
          <TouchableOpacity
            style={[styles.topIconButton, isVideoEnabled && styles.activeTopIcon]}
            onPress={handleVideoToggle}
          >
            <Ionicons
              name={isVideoEnabled ? 'videocam' : 'videocam-outline'}
              size={20}
              color={isVideoEnabled ? '#4CAF50' : '#000000'}
            />
            {videoRequestPending && (
              <View style={styles.pendingDot} />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.topIconButton} onPress={handleHeartPress}>
            <Ionicons
              name={isMatched ? 'heart' : 'heart-outline'}
              size={20}
              color={isMatched ? '#4CAF50' : '#000000'}
            />
            {(heartPending || incomingHeart) && <View style={styles.pendingDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Full-screen video mode when video is enabled */}
      {isVideoEnabled && (remoteStreamURL || localStreamURL) && RTCView ? (
        <View style={styles.videoContainer}>
          {/* Remote video (full screen) */}
          {remoteStreamURL ? (
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
          )}

          {/* Local video (picture-in-picture) */}
          {localStreamURL && (
            <View style={styles.localVideoContainer}>
              <RTCView
                streamURL={localStreamURL}
                style={styles.localVideo}
                objectFit="cover"
                mirror={isFrontCamera}
                zOrder={1}
              />
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
            <View style={styles.profileImage}>
              <Ionicons name="person" size={100} color="#cccccc" />
            </View>

            <LinearGradient
              colors={['transparent', 'rgba(0, 0, 0, 0.7)']}
              locations={[0.3, 1]}
              style={styles.imageOverlay}
            />

            <View style={styles.profileInfoOverlay}>
              {profile.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#4CAF50" />
                  <Text style={styles.verifiedText}>Photo Verified</Text>
                </View>
              )}
              <Text style={styles.profileName}>
                {profile.name}{profile.age ? `, ${profile.age}` : ''}
              </Text>
              {profile.title ? (
                <Text style={styles.profileTitle}>{profile.title}</Text>
              ) : null}
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

        {profile.lookingFor ? (
          <View style={styles.lookingForSection}>
            <Text style={styles.lookingForTitle}>Looking For</Text>
            <Text style={styles.lookingForText}>{profile.lookingFor}</Text>
          </View>
        ) : null}

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
        </ScrollView>
      )}

      <View style={[styles.callControls, isVideoEnabled && styles.callControlsVideo]}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.mutedButton]}
          onPress={handleToggleMute}
        >
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color={isMuted ? '#ff4444' : '#000000'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isVideoEnabled ? styles.videoOnButton : styles.videoOffButton]}
          onPress={handleVideoToggle}
        >
          <Ionicons
            name={isVideoEnabled ? 'videocam' : 'videocam-off'}
            size={24}
            color={isVideoEnabled ? '#4CAF50' : '#666666'}
          />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.controlButton, styles.endCallButton]} onPress={handleEndCall}>
          <Ionicons name="call" size={24} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={onNext}>
          <Ionicons name="arrow-forward" size={24} color="#000000" />
        </TouchableOpacity>

        {isVideoEnabled && (
          <TouchableOpacity style={styles.controlButton} onPress={handleSwitchCamera}>
            <Ionicons name="camera-reverse" size={24} color="#000000" />
          </TouchableOpacity>
        )}
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
  topIconButton: {
    padding: 8,
    position: 'relative',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#000000',
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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  profileTitle: {
    color: '#ffffff',
    fontSize: 13,
    marginBottom: 2,
  },
  profileLocation: {
    color: '#ffffff',
    fontSize: 12,
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
  callControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
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
