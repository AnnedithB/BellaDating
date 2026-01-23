import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { useNavigation, CommonActions, useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { chatAPI, sessionAPI, userAPI, matchAPI, connectionAPI, activityAPI, tokenStorage, config } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import CallView from '../components/CallView';
import webrtcService from '../services/webrtcService';
import callService from '../services/callService';

// Safe import for RTCView
let RTCView = View;
try {
  const webrtc = require('react-native-webrtc');
  RTCView = webrtc.RTCView;
} catch (e) {
  console.log('RTCView not available (likely in Expo Go)');
}

// Helper component for Web Video
const WebVideo = ({ stream, style, mirror }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (Platform.OS !== 'web') return null;

  return React.createElement('video', {
    ref: videoRef,
    autoPlay: true,
    playsInline: true,
    muted: true, // Mute local video to prevent echo
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
    }
  }, [stream]);

  if (Platform.OS !== 'web') return null;

  return React.createElement('video', {
    ref: videoRef,
    autoPlay: true,
    playsInline: true,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      ...StyleSheet.flatten(style)
    }
  });
};

// Animated Typing Indicator Component
const TypingIndicator = () => {
  const dot1 = useRef(new Animated.Value(0.4)).current;
  const dot2 = useRef(new Animated.Value(0.4)).current;
  const dot3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animateDot = (dot, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.4,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animations = [
      animateDot(dot1, 0),
      animateDot(dot2, 200),
      animateDot(dot3, 400),
    ];

    animations.forEach((anim) => anim.start());

    return () => {
      animations.forEach((anim) => anim.stop());
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.typingIndicator}>
      <Animated.View style={[styles.typingDot, { opacity: dot1 }]} />
      <Animated.View style={[styles.typingDot, { opacity: dot2 }]} />
      <Animated.View style={[styles.typingDot, { opacity: dot3 }]} />
    </View>
  );
};

const ChatConversationScreen = ({ route }) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const {
    joinConversation,
    leaveConversation,
    subscribeToMessages,
    sendMessageSocket,
    sendTypingStart,
    sendTypingStop,
    isUserOnline,
    getTypingUsersInConversation,
    typingUsers,
    connected: socketConnected,
    subscribeToCallResponses,
    subscribeToCallRequests,
    emitCallRequest,
    emitCallResponse,
  } = useSocket();
  const {
    chatId,
    roomId: initialRoomId,
    chatName,
    isOnline: initialIsOnline,
    profilePicture,
    otherUserId,
    partnerId, // Support partnerId from DiscoveryScreen navigation
    partnerName, // Support partnerName from DiscoveryScreen navigation
    partnerProfilePicture, // Support partnerProfilePicture from DiscoveryScreen navigation
    sessionId, // Retrieve sessionId from route
    autoJoinCall, // Check for auto-join flag
  } = route.params || {};
  
  // Use partnerId if otherUserId is not provided (for calls from DiscoveryScreen)
  const actualOtherUserId = otherUserId || partnerId;
  const actualChatName = chatName || partnerName;
  const actualProfilePicture = profilePicture || partnerProfilePicture;

  // State
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isOnline, setIsOnline] = useState(initialIsOnline);
  
  // Update chatName and profilePicture if partner data is provided
  const displayChatName = actualChatName || chatName;
  const displayProfilePicture = actualProfilePicture || profilePicture;
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callSession, setCallSession] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState('idle'); // 'idle', 'calling', 'ringing', 'connected'

  // WebRTC State
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isCameraFront, setIsCameraFront] = useState(true);

  // Voice note playback state
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // Refs
  const recordingRef = useRef(null);
  const timerRef = useRef(null);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const soundRef = useRef(null);

  // Voice note recording functions
  const startRecording = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = async (shouldSend = false) => {
    if (!recordingRef.current) return;

    try {
      setIsRecording(false);
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      
      const uri = recordingRef.current.getURI();
      const status = await recordingRef.current.getStatusAsync();
      const duration = status.durationMillis / 1000; // Convert to seconds
      
      recordingRef.current = null;
      setRecordingTime(0);

      if (shouldSend && uri && chatId) {
        // TODO: Send voice note via socket/API
        console.log('Sending voice note:', { uri, duration });
        // You can implement voice note sending here
        // sendMessageSocket(chatId, '', 'VOICE', { voiceUrl: uri, duration });
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      Alert.alert('Error', 'Failed to stop recording.');
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      await stopRecording(false); // Cancel recording
    } else {
      await startRecording();
    }
  };

  // Format time for voice notes
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Load messages
  const loadMessages = async (showLoading = true, retryCount = 0) => {
    if (!activeConversationId) return;

    const normalizeMessages = (data) => {
      const formattedMessages = (data || []).map((msg) => {
        const sentAt = msg.sentAt || msg.timestamp || msg.createdAt;
        return {
          id: msg.id || msg.messageId,
          text: msg.content,
          time: formatMessageTime(sentAt),
          isMe: msg.senderId === user?.id,
          isVoiceNote: msg.messageType === 'VOICE' || msg.type === 'VOICE',
          voiceUrl: msg.voiceUrl,
          duration: msg.voiceDuration || msg.duration,
          isDelivered: msg.isDelivered,
          isRead: msg.isRead,
          sentAt: sentAt, // Keep sentAt for sorting
        };
      });

      // Sort by time, oldest first
      formattedMessages.sort((a, b) => {
        const timeA = new Date(a.sentAt || 0);
        const timeB = new Date(b.sentAt || 0);
        return timeA - timeB;
      });

      return formattedMessages;
    };

    try {
      if (showLoading) setIsLoading(true);

      const data = shouldUseRoomMessages
        ? await chatAPI.getConversationMessages(activeConversationId, 50, 0)
        : await chatAPI.getSessionMessages(chatId, 50, 0);

      const formattedMessages = normalizeMessages(data);

      setMessages(formattedMessages);

      // Log if no messages found (might indicate an issue)
      if (formattedMessages.length === 0 && retryCount === 0) {
        console.log('[ChatConversationScreen] No messages found for conversation:', activeConversationId);
      }
    } catch (err) {
      console.error('Error loading messages:', err);

      // If conversation API is forbidden, fallback to session messages
      if (
        shouldUseRoomMessages &&
        chatId &&
        (err.message?.includes('403') || err.message?.includes('Access denied'))
      ) {
        try {
          console.warn('[ChatConversationScreen] Conversation access denied, falling back to session messages');
          const fallbackData = await chatAPI.getSessionMessages(chatId, 50, 0);
          const fallbackMessages = normalizeMessages(fallbackData);
          setMessages(fallbackMessages);
          return;
        } catch (fallbackErr) {
          console.error('[ChatConversationScreen] Failed to load session messages fallback:', fallbackErr);
        }
      }

      // Retry once if it's a network error or 500 error
      if (retryCount < 1 && (err.message?.includes('Network') || err.message?.includes('500'))) {
        console.log('[ChatConversationScreen] Retrying message load...');
        setTimeout(() => {
          loadMessages(showLoading, retryCount + 1);
        }, 1000);
        return;
      }

      // On error, keep existing messages (don't clear them)
      if (messages.length === 0) {
        console.warn('[ChatConversationScreen] Failed to load messages after retry');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Format message time
  const formatMessageTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Handle text input change
  const handleTextChange = (text) => {
    setMessage(text);
    // Send typing indicator
    if (text.trim().length > 0 && activeConversationId) {
      sendTypingStart(activeConversationId, chatId || null);
      // Clear typing indicator after 3 seconds of no typing
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingStop(activeConversationId, chatId || null);
      }, 3000);
    } else if (activeConversationId) {
      sendTypingStop(activeConversationId, chatId || null);
    }
  };

  // Handle send message
  const handleSend = async () => {
    if (!message.trim() || isSending || !activeConversationId) return;

    const messageText = message.trim();
    setIsSending(true);
    setMessage(''); // Clear input immediately for better UX
    sendTypingStop(activeConversationId, chatId || null); // Stop typing indicator

    try {
      // Optimistically add message to UI
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        text: messageText,
        time: formatMessageTime(new Date().toISOString()),
        isMe: true,
        isDelivered: false,
        isRead: false,
        sentAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticMessage]);

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Send message via API to persist to database
      try {
        if (shouldUseRoomMessages) {
          await chatAPI.sendConversationMessage({
            roomId: activeConversationId,
            content: messageText,
            type: 'TEXT',
            metadata: sessionId ? { sessionId } : undefined,
          });
        } else {
          await chatAPI.sendMessage({
            sessionId: chatId, // Use chatId as sessionId for session-based chats
            content: messageText,
            messageType: 'TEXT', // Changed from 'type' to 'messageType'
          });
        }
        console.log('[ChatConversationScreen] Message persisted to database');
      } catch (apiError) {
        console.error('[ChatConversationScreen] Error persisting message via API:', apiError);
        // Continue - message was sent via socket for real-time delivery
      }

      // Also send via socket for real-time delivery
      const socketMetadata = chatId ? { sessionId: chatId } : null;
      sendMessageSocket(activeConversationId, messageText, 'TEXT', socketMetadata);
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore message on error
      setMessage(messageText);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Handle Start Voice Call
  const handleStartVoiceCall = async (isIncoming = false, incomingCallData = null) => {
    const currentSessionId = sessionId || chatId;
    const conversationId = activeConversationId || roomId || chatId;
    
    console.log('[ChatConversationScreen] handleStartVoiceCall called:', {
      isIncoming,
      currentSessionId,
      conversationId,
      activeConversationId,
      roomId,
      chatId,
      actualOtherUserId,
      socketConnected,
    });

    // Ensure isIncoming is a boolean (handle case where event object is passed)
    const isIncomingCall = typeof isIncoming === 'boolean' ? isIncoming : false;
    
    if (!isIncomingCall && !actualOtherUserId) {
      Alert.alert('Error', 'Unable to start voice call. User information is missing.');
      return;
    }

    try {
      let session = { id: currentSessionId };

      if (!isIncomingCall) {
        // Start a voice call session if outgoing
        const newSession = await sessionAPI.startSession(actualOtherUserId, 'VOICE');
        if (newSession && newSession.id) {
          session = newSession;
        } else {
          throw new Error('Failed to create call session');
        }
      } else if (incomingCallData && incomingCallData.sessionId) {
        // Use the session ID from the incoming call request
        session = { id: incomingCallData.sessionId };
      }

      // Emit call request to notify the other user (only for outgoing calls)
      if (!isIncomingCall) {
        console.log('[ChatConversationScreen] Preparing to emit call request:', {
          emitCallRequest: !!emitCallRequest,
          actualOtherUserId,
          conversationId,
          sessionId: session.id,
          socketConnected: socketConnected,
        });
        
        if (emitCallRequest && actualOtherUserId && conversationId && socketConnected) {
          console.log('[ChatConversationScreen] Emitting call request to:', actualOtherUserId, 'with data:', {
            callId: session.id,
            sessionId: session.id,
            conversationId: conversationId,
            callerId: user?.id,
            callType: 'VOICE',
            callerName: displayChatName || user?.name || 'User',
          });
          const result = emitCallRequest(actualOtherUserId, {
            callId: session.id,
            sessionId: session.id,
            conversationId: conversationId,
            callerId: user?.id,
            callType: 'VOICE',
            callerName: displayChatName || user?.name || 'User',
            callerProfile: displayProfilePicture || user?.profilePicture,
          });
          console.log('[ChatConversationScreen] emitCallRequest result:', result);
        } else {
          console.warn('[ChatConversationScreen] Cannot emit call request:', {
            emitCallRequest: !!emitCallRequest,
            actualOtherUserId: !!actualOtherUserId,
            conversationId: !!conversationId,
            socketConnected,
          });
        }
      }

      setCallSession({
        id: session.id,
        partnerId: actualOtherUserId,
        partnerName: displayChatName,
        partnerProfile: displayProfilePicture,
        callType: 'VOICE',
      });

      setIsInCall(true);
      setCallDuration(0);
      setCallStatus('calling'); // Set status to calling

      // Initialize WebRTC for voice (false for isVideo = audio only)
      await initializeVideoCall(session, false);

    } catch (error) {
      console.error('Error starting voice call:', error);
      Alert.alert('Error', error.message || 'Failed to start voice call. Please try again.');
      setIsInCall(false);
    }
  };

  // Resolve sessionId to roomId for socket connections
  const [roomId, setRoomId] = useState(initialRoomId || chatId); // Prefer explicit roomId when provided
  const activeConversationId = roomId || chatId;
  const shouldUseRoomMessages =
    !sessionId && !!activeConversationId && String(activeConversationId).startsWith('room_');

  // Resolve chatId (sessionId) to roomId by sending a test message or checking session
  useEffect(() => {
    const resolveRoomId = async () => {
      if (!chatId) return;

      try {
        // If we already have a roomId from navigation, keep it
        if (initialRoomId && initialRoomId !== chatId) {
          console.log('[ChatConversationScreen] Using roomId from navigation:', initialRoomId);
          setRoomId(initialRoomId);
          return;
        }

        // First, try to get the session to find roomId
        try {
          const session = await sessionAPI.getSession(chatId);
          if (session?.metadata?.roomId) {
            const resolvedRoomId = session.metadata.roomId;
            console.log('[ChatConversationScreen] Resolved roomId from session metadata:', resolvedRoomId);
            setRoomId(resolvedRoomId);
            return;
          }
        } catch (err) {
          console.log('[ChatConversationScreen] Could not get session, trying alternative method');
        }

        console.log('[ChatConversationScreen] Using chatId as roomId (may be sessionId):', chatId);
        setRoomId(chatId);
      } catch (err) {
        console.error('[ChatConversationScreen] Error resolving roomId:', err);
        setRoomId(chatId);
      }
    };

    resolveRoomId();
  }, [chatId, initialRoomId]);

  // Load on mount and set up Socket.IO
  useEffect(() => {
    loadMessages();

    // Mark session as read (session-based chats only)
    if (chatId && !shouldUseRoomMessages) {
      chatAPI.markSessionAsRead(chatId).catch(console.error);
    }

    // Join the conversation room(s) via Socket.IO using roomId and sessionId
    const socketRoomId = activeConversationId;
    if (socketConnected) {
      if (socketRoomId) {
        console.log('[ChatConversationScreen] Joining socket room:', socketRoomId);
        joinConversation(socketRoomId);
      }
      if (chatId && chatId !== socketRoomId) {
        console.log('[ChatConversationScreen] Joining socket session room:', chatId);
        joinConversation(chatId);
      }
    }

    // Subscribe to real-time messages using roomId
    let unsubscribe = () => { };
    let unsubscribeChatId = () => { };

    if (socketRoomId) {
      // Subscribe with roomId
      unsubscribe = subscribeToMessages(socketRoomId, (data) => {
        // Only add message if it's from the other user
        if (data.senderId !== user?.id) {
          const newMessage = {
            id: data.id || data.messageId || `socket-${Date.now()}`,
            text: data.content,
            time: formatMessageTime(data.sentAt || data.timestamp || new Date().toISOString()),
            isMe: false,
            isVoiceNote: data.type === 'VOICE' || data.messageType === 'VOICE',
            voiceUrl: data.voiceUrl,
            duration: data.voiceDuration || data.duration,
            isDelivered: true,
            isRead: false,
            sentAt: data.sentAt || data.timestamp,
          };
          setMessages((prev) => {
            const isDuplicate = prev.some((m) =>
              m.id === newMessage.id ||
              (m.text === newMessage.text &&
                Math.abs(new Date(m.sentAt || 0).getTime() - new Date(newMessage.sentAt || 0).getTime()) < 1000)
            );
            if (isDuplicate) return prev;
            return [...prev, newMessage];
          });
        }
      });

      // Also subscribe with chatId if different
      if (chatId && chatId !== socketRoomId) {
        unsubscribeChatId = subscribeToMessages(chatId, (data) => {
          if (data.senderId !== user?.id) {
            const newMessage = {
              id: data.id || data.messageId || `socket-${Date.now()}`,
              text: data.content,
              time: formatMessageTime(data.sentAt || data.timestamp || new Date().toISOString()),
              isMe: false,
              isVoiceNote: data.type === 'VOICE' || data.messageType === 'VOICE',
              voiceUrl: data.voiceUrl,
              duration: data.voiceDuration || data.duration,
              isDelivered: true,
              isRead: false,
              sentAt: data.sentAt || data.timestamp,
            };
            setMessages((prev) => {
              const isDuplicate = prev.some((m) =>
                m.id === newMessage.id ||
                (m.text === newMessage.text &&
                  Math.abs(new Date(m.sentAt || 0).getTime() - new Date(newMessage.sentAt || 0).getTime()) < 1000)
              );
              if (isDuplicate) return prev;
              return [...prev, newMessage];
            });
          }
        });
      }
    }

    return () => {
      if (socketConnected) {
        if (socketRoomId) {
          leaveConversation(socketRoomId);
        }
        if (chatId && chatId !== socketRoomId) {
          leaveConversation(chatId);
        }
      }
      unsubscribe();
      unsubscribeChatId();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [chatId, roomId, activeConversationId, socketConnected, user?.id]);

  // Separate effect to ensure join happens when socket connects
  useEffect(() => {
    const socketRoomId = activeConversationId;
    if (socketConnected && (socketRoomId || chatId)) {
      const timeoutId = setTimeout(() => {
        if (socketRoomId) {
          joinConversation(socketRoomId);
        }
        if (chatId && chatId !== socketRoomId) {
          joinConversation(chatId);
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [socketConnected, roomId, chatId, activeConversationId]);

  // Update typing indicator state based on socket typing users
  useEffect(() => {
    if (!actualOtherUserId) {
      setIsTyping(false);
      return;
    }

    const possibleIds = [
      activeConversationId,
      roomId,
      chatId,
    ].filter(Boolean);

    let otherUserTyping = false;
    if (typingUsers) {
      typingUsers.forEach((data, key) => {
        const [convId, userId] = key.split(':');
        if (userId === actualOtherUserId && possibleIds.includes(convId)) {
          otherUserTyping = true;
        }
      });
    }

    setIsTyping(otherUserTyping);
  }, [activeConversationId, roomId, chatId, actualOtherUserId, typingUsers]);

  // State for incoming call request
  const [incomingCallRequest, setIncomingCallRequest] = useState(null);

  // Listen for incoming call requests in chat
  useEffect(() => {
    if (!socketConnected) {
      console.log('[ChatConversationScreen] Socket not connected, skipping call request listener');
      return;
    }

    console.log('[ChatConversationScreen] Setting up call request listener');
    const unsubscribe = subscribeToCallRequests((data) => {
      console.log('[ChatConversationScreen] Incoming call request received:', data);
      console.log('[ChatConversationScreen] Current conversation context:', {
        activeConversationId,
        roomId,
        chatId,
        sessionId,
        actualOtherUserId,
      });
      
      // Check if this call request is for this conversation
      // Match by conversationId, sessionId, or if callerId matches otherUserId
      const isForThisConversation = 
        data.conversationId === activeConversationId ||
        data.conversationId === roomId ||
        data.conversationId === chatId ||
        data.sessionId === chatId ||
        data.sessionId === sessionId ||
        (data.callerId === actualOtherUserId && data.callType === 'VOICE');

      // Check if it's a voice call
      const isVoiceCall = data.callType === 'VOICE' || data.type === 'VOICE';

      console.log('[ChatConversationScreen] Call request check:', {
        isForThisConversation,
        isVoiceCall,
        dataCallType: data.callType,
        dataType: data.type,
      });

      if (isForThisConversation && isVoiceCall) {
        console.log('[ChatConversationScreen] Setting incoming call request state');
        // Set state to show accept/decline buttons instead of alert
        setIncomingCallRequest(data);
      } else {
        console.log('[ChatConversationScreen] Call request ignored - not for this conversation or not voice call');
      }
    });

    return () => {
      console.log('[ChatConversationScreen] Cleaning up call request listener');
      unsubscribe();
    };
  }, [socketConnected, activeConversationId, roomId, chatId, sessionId, actualOtherUserId, subscribeToCallRequests]);

  // Handle accept call
  const handleAcceptCall = () => {
    if (!incomingCallRequest) return;
    
    console.log('[ChatConversationScreen] Call accepted');
    if (emitCallResponse && incomingCallRequest.callId) {
      emitCallResponse(incomingCallRequest.callId, 'accept');
    }
    // Start the call as incoming
    handleStartVoiceCall(true, incomingCallRequest);
    // Clear the incoming call request
    setIncomingCallRequest(null);
  };

  // Handle decline call
  const handleDeclineCall = () => {
    if (!incomingCallRequest) return;
    
    console.log('[ChatConversationScreen] Call declined');
    if (emitCallResponse && incomingCallRequest.callId) {
      emitCallResponse(incomingCallRequest.callId, 'decline');
    }
    // Clear the incoming call request
    setIncomingCallRequest(null);
  };

  // Auto-join call if requested
  useEffect(() => {
    if (autoJoinCall && sessionId) {
      console.log('[ChatConversationScreen] Auto-joining call session:', sessionId);
      handleStartVideoCall(true); // true = automatic join without creating new session
    }
  }, [autoJoinCall, sessionId]);

  // Timeout ref for call response
  const callResponseTimeoutRef = useRef(null);

  // Listen for call responses (accept/decline/ignore)
  useEffect(() => {
    const unsubscribe = subscribeToCallResponses(async (data) => {
      console.log('[ChatConversationScreen] Call response received:', data);
      console.log('[ChatConversationScreen] Current call session:', {
        callSessionId: callSession?.id,
        callSessionPartnerId: callSession?.partnerId,
        currentUserId: user?.id,
        toUserId: data.toUserId,
        fromUserId: data.fromUserId,
        callerId: data.callerId,
        isInCall,
        sessionId,
        chatId,
      });

      // Clear timeout if we got a response
      if (callResponseTimeoutRef.current) {
        clearTimeout(callResponseTimeoutRef.current);
        callResponseTimeoutRef.current = null;
      }

      // Check if this response belongs to our current active call request/session
      // Match by: sessionId, callId matching sessionId, or if we are the caller and the fromUserId matches our partner
      const isActiveSession = (callSession || isInCall) && (
        // Match by session ID
        (callSession && data.sessionId === callSession.id) ||
        (callSession && data.callId === callSession.id) ||
        (data.sessionId && data.sessionId === (sessionId || chatId)) ||
        // Match if we are the caller (toUserId matches our userId) and fromUserId matches our partner or actualOtherUserId
        (data.toUserId === user?.id && (
          (callSession && callSession.partnerId === data.fromUserId) ||
          actualOtherUserId === data.fromUserId
        )) ||
        // Match if callerId matches our userId and fromUserId matches our partner
        (data.callerId === user?.id && (
          (callSession && callSession.partnerId === data.fromUserId) ||
          actualOtherUserId === data.fromUserId
        ))
      );

      console.log('[ChatConversationScreen] isActiveSession check:', {
        isActiveSession,
        hasCallSession: !!callSession,
        isInCall,
        sessionIdMatch: callSession && data.sessionId === callSession.id,
        callIdMatch: callSession && data.callId === callSession.id,
        toUserIdMatch: data.toUserId === user?.id && (
          (callSession && callSession.partnerId === data.fromUserId) ||
          actualOtherUserId === data.fromUserId
        ),
        callerIdMatch: data.callerId === user?.id && (
          (callSession && callSession.partnerId === data.fromUserId) ||
          actualOtherUserId === data.fromUserId
        ),
      });

      if (isActiveSession) {
        if (data.response === 'accept') {
          console.log('[ChatConversationScreen] User accepted call, starting WebRTC handshake');
          console.log('[ChatConversationScreen] Accept response details:', {
            callId: data.callId,
            sessionId: data.sessionId,
            callerId: data.callerId,
            fromUserId: data.fromUserId,
            currentUserId: user?.id,
            callSessionId: callSession?.id,
            isCaller: data.callerId === user?.id,
          });

          // CRITICAL: The caller (the one who receives the accept response) initiates the offer
          // The caller is the one whose userId matches toUserId in the accept response
          const isCaller = data.toUserId === user?.id || data.callerId === user?.id || (callSession && !callSession.isIncoming);
          const targetId = callSession?.partnerId || actualOtherUserId || data.fromUserId;
          
          console.log('[ChatConversationScreen] Determining caller status:', {
            toUserId: data.toUserId,
            callerId: data.callerId,
            currentUserId: user?.id,
            isCallerByToUserId: data.toUserId === user?.id,
            isCallerByCallerId: data.callerId === user?.id,
            callSessionIsIncoming: callSession?.isIncoming,
            finalIsCaller: isCaller,
            targetId,
          });

          console.log('[ChatConversationScreen] Caller check:', {
            isCaller,
            targetId,
            callSessionPartnerId: callSession?.partnerId,
            actualOtherUserId,
            fromUserId: data.fromUserId,
          });

          if (isCaller && targetId) {
            console.log('[ChatConversationScreen] We are the caller, creating offer for:', targetId);
            try {
              // Create and send offer (peer connection should already exist from initializeVideoCall)
              // If it doesn't exist, createAndSendOffer will handle it gracefully
              await webrtcService.createAndSendOffer(targetId);
              console.log('[ChatConversationScreen] Offer created and sent successfully');
              // Update status to connected after offer is sent
              setCallStatus('connected');
            } catch (err) {
              console.error('[ChatConversationScreen] Error creating offer:', err);
              // If peer connection doesn't exist, try creating it first
              if (err.message && err.message.includes('peer connection')) {
                console.log('[ChatConversationScreen] Peer connection missing, creating it now');
                await webrtcService.createPeerConnection(targetId);
                await webrtcService.createAndSendOffer(targetId);
              } else {
                Alert.alert('Error', 'Failed to create call offer. Please try again.');
              }
            }
          } else {
            console.warn('[ChatConversationScreen] Not creating offer - isCaller:', isCaller, 'targetId:', targetId);
          }
        } else if (data.response === 'decline' || data.response === 'ignore') {
          // For voice calls from chat, don't navigate away
          // For video calls from matching, navigate back to Discovery
          console.log('[ChatConversationScreen] Call was', data.response === 'decline' ? 'declined' : 'ignored');
          const isVoiceCallFromChat = callSession?.callType === 'VOICE' && chatId;
          cleanupVideoCall(!isVoiceCallFromChat); // Only navigate if not voice call from chat
        }
      }
    });

    return () => {
      unsubscribe();
      if (callResponseTimeoutRef.current) {
        clearTimeout(callResponseTimeoutRef.current);
        callResponseTimeoutRef.current = null;
      }
    };
  }, [subscribeToCallResponses, callSession?.id]);

  // Set timeout for caller if no response received (sync with receiver's 7 second auto-dismiss)
  useEffect(() => {
      // Set timeout when we're in calling/ringing state (waiting for response)
      // This applies to the caller who is waiting for the callee to respond
      if (isInCall && callSession && (callStatus === 'calling' || callStatus === 'ringing')) {
        console.log('[ChatConversationScreen] Setting timeout for call response (7 seconds)');
        callResponseTimeoutRef.current = setTimeout(() => {
          console.log('[ChatConversationScreen] No response received after 7 seconds, auto-cleaning up call');
          const isVoiceCallFromChat = callSession?.callType === 'VOICE' && chatId;
          cleanupVideoCall(!isVoiceCallFromChat); // Only navigate if not voice call from chat
        }, 7000); // Match receiver's 7 second timeout

      return () => {
        if (callResponseTimeoutRef.current) {
          clearTimeout(callResponseTimeoutRef.current);
          callResponseTimeoutRef.current = null;
        }
      };
    } else {
      // Clear timeout if we're not in calling/ringing state
      if (callResponseTimeoutRef.current) {
        clearTimeout(callResponseTimeoutRef.current);
        callResponseTimeoutRef.current = null;
      }
    }
  }, [isInCall, callSession?.id, callStatus]);

  // Listen for call-ended events (when the other party ends the call)
  useEffect(() => {
    if (!isInCall || !callSession) return;

    const unsubscribe = callService.onCallEvent('call-ended', (data) => {
      console.log('[ChatConversationScreen] Call ended by other party:', data);
      Alert.alert('Call Ended', 'The other party ended the call.');
      const isVoiceCallFromChat = callSession?.callType === 'VOICE' && chatId;
      cleanupVideoCall(!isVoiceCallFromChat); // Only navigate if not voice call from chat
    });

    return () => {
      unsubscribe();
    };
  }, [isInCall, callSession?.id]);

  // Handle Video/Voice Call Initialization
  const initializeVideoCall = async (session, isVideo = true) => {
    if (!session?.id) return;

    try {
      console.log('[ChatConversationScreen] Initializing WebRTC for session:', session.id);

      // 1. Initialize Call Socket
      await callService.initializeCallSocket(user?.gender || 'male');

      // 2. Join the call room (using session ID as room ID)
      callService.joinCallRoom(session.id);

      // 3. Initialize WebRTC Service
      webrtcService.initializeWebRTC();

      // 4. Set callbacks
      webrtcService.setCallbacks({
        onLocalStream: (stream) => {
          console.log('[ChatConversationScreen] Got local stream');
          setLocalStream(stream);
        },
        onRemoteStream: (stream) => {
          console.log('[ChatConversationScreen] Got remote stream');
          setRemoteStream(stream);
          // Update call status to connected when remote stream is received
          setCallStatus((prevStatus) => {
            if (prevStatus !== 'connected') {
              console.log('[ChatConversationScreen] Remote stream received, updating status to connected');
              return 'connected';
            }
            return prevStatus;
          });
        },
        onConnectionStateChange: (state) => {
          console.log('[ChatConversationScreen] WebRTC Connection State:', state);
          // Update call status based on connection state
          setCallStatus((prevStatus) => {
            if (state === 'connected' && prevStatus !== 'connected') {
              return 'connected';
            } else if (state === 'failed' || state === 'disconnected') {
              return 'calling'; // Fallback to calling state
            }
            return prevStatus;
          });
        },
        onError: (err) => {
          console.error('[ChatConversationScreen] WebRTC Error:', err);
        }
      });

      // 5. Get Local Stream (enables camera/mic)
      await webrtcService.getLocalStream(isVideo);

      // 6. Create Peer Connection (now that we have local stream)
      // Get targetId from session, callSession, or route params
      const targetId = session.partnerId || callSession?.partnerId || actualOtherUserId;
      if (targetId) {
        console.log('[ChatConversationScreen] Creating peer connection for:', targetId);
        await webrtcService.createPeerConnection(targetId);
      } else {
        console.warn('[ChatConversationScreen] Cannot create peer connection: targetId missing', {
          sessionPartnerId: session.partnerId,
          callSessionPartnerId: callSession?.partnerId,
          actualOtherUserId,
          partnerId,
          otherUserId,
        });
      }

    } catch (error) {
      console.error('[ChatConversationScreen] Failed to initialize video call:', error);
      Alert.alert('Error', 'Failed to access camera or microphone');
    }
  };

  // Clean up WebRTC on unmount or end call
  const cleanupVideoCall = (shouldNavigateToDiscovery = false) => {
    console.log('[ChatConversationScreen] Cleaning up video call');
    webrtcService.closePeerConnection();
    webrtcService.clearCallbacks();
    
    // End call via call service (notifies other party if not already ended)
    if (callSession?.id) {
      callService.endCall(callSession.id);
    }
    
    // Don't disconnect socket fully if we want to reuse it, but here we can
    // callService.disconnectCallSocket(); 

    setLocalStream(null);
    setRemoteStream(null);
    setCallSession(null);
    setIsInCall(false);
    setCallDuration(0);
    setCallStatus('idle');

    // Navigate back to Discovery and auto-start matching if requested
    if (shouldNavigateToDiscovery) {
      console.log('[ChatConversationScreen] Navigating back to Discovery to restart matching');
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: 'Main',
              state: {
                routes: [
                  {
                    name: 'Discovery',
                    params: { autoStartMatching: true },
                  },
                ],
                index: 0,
              },
            },
          ],
        })
      );
    }
  };

  // Handle Start Video Call
  const handleStartVideoCall = async (isIncoming = false) => {
    // If incoming, we already have a session ID from route params or autoJoin logic
    // If outgoing, we need to create one if haven't already
    const currentSessionId = sessionId || chatId;

    if (!isIncoming && !actualOtherUserId) {
      Alert.alert('Error', 'Unable to start video call. User information is missing.');
      return;
    }

    try {
      let session = { 
        id: currentSessionId,
        partnerId: actualOtherUserId, // Include partnerId for auto-join scenarios
      };

      if (!isIncoming) {
        // Start a video call session if outgoing
        const newSession = await sessionAPI.startSession(actualOtherUserId, 'VIDEO');
        if (newSession && newSession.id) {
          session = { ...newSession, partnerId: actualOtherUserId };
        } else {
          throw new Error('Failed to create call session');
        }
      }

      // Ensure we have profile picture from route params (especially for incoming calls)
      const profilePic = displayProfilePicture || partnerProfilePicture || profilePicture;
      const partnerDisplayName = displayChatName || partnerName || chatName || 'User';

      console.log('[ChatConversationScreen] Setting callSession with profile:', {
        partnerId: actualOtherUserId,
        partnerName: partnerDisplayName,
        partnerProfile: profilePic,
        isIncoming
      });

      setCallSession({
        id: session.id,
        partnerId: actualOtherUserId,
        partnerName: partnerDisplayName,
        partnerProfile: profilePic,
        callType: 'VIDEO',
      });

      setIsInCall(true);
      setCallDuration(0);
      setCallStatus('calling'); // Set status to calling

      // Initialize WebRTC
      await initializeVideoCall(session, true);

    } catch (error) {
      console.error('Error starting video call:', error);
      Alert.alert('Error', error.message || 'Failed to start video call. Please try again.');
      setIsInCall(false);
    }
  };

  const handleEndCall = async () => {
    try {
      console.log('[ChatConversationScreen] Ending call, notifying other party...');
      
      // End the session via API
      if (callSession?.id) {
        try {
          await sessionAPI.endSession(callSession.id);
        } catch (error) {
          console.error('Error ending session:', error);
        }
      }
    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      // For voice calls from chat, don't navigate away - just go back to chat
      // For video calls from matching, navigate back to Discovery
      const isVoiceCallFromChat = callSession?.callType === 'VOICE' && chatId;
      cleanupVideoCall(!isVoiceCallFromChat); // Only navigate if not voice call from chat
    }
  };

  const handleToggleCamera = async () => {
    try {
      await webrtcService.switchCamera();
      setIsCameraFront(!isCameraFront);
    } catch (err) {
      console.error('Error switching camera:', err);
    }
  };

  // ... (Rest of existing render logic details like formatCallTime, timer, Menu handlers)
  // Re-implementing just the CallView Render part to include RTCView

  const formatCallTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Call duration timer
  useEffect(() => {
    let interval = null;
    if (isInCall) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isInCall]);

  const handleMenuPress = () => setShowMenu(true);

  // Existing Handlers (handleUnmatch, handleReport, handleClearChat, renderMessage, renderHeader, etc.)
  // We need to keep them. Since I am replacing the *entire* file content logic if I use replace_file_content with full replacement,
  // I need to be careful. But replace_file_content is usually range based.
  // The instruction said "Implement WebRTC Video Call Integration".
  // The provided ReplaceContent is starting primarily from the component definition.
  // I will use START/END line to replace safely, preserving the bottom utility functions if possible,
  // OR I will simply provide the missing pieces in the right places.

  // Actually, I will replace the component body to include the new logic.
  // The critical part is rendering the RTCViews.

  // ... (Skipping re-typing existing handlers for Unmatch/Report/Clear/RenderMessage/RenderHeader for brevity in thought process)


  const handleUnmatch = () => {
    setShowMenu(false);
    Alert.alert(
      'Unmatch',
      `Are you sure you want to unmatch with ${displayChatName}? This action cannot be undone and you will be redirected to Discovery.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unmatch',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!actualOtherUserId || !user?.id) {
                Alert.alert('Error', 'Unable to unmatch. User information is missing.');
                return;
              }

              // Try to find the match ID from pending matches or match history
              let matchId = null;
              try {
                // First, try pending matches
                const pendingMatches = await matchAPI.getPendingMatches();
                const match = pendingMatches.find(
                  (m) =>
                    (m.user1Id === user.id && m.user2Id === actualOtherUserId) ||
                    (m.user1Id === actualOtherUserId && m.user2Id === user.id)
                );
                if (match) {
                  matchId = match.id;
                } else {
                  // Try match history
                  const matchHistory = await matchAPI.getMatchHistory(50, 0);
                  const historyMatch = matchHistory.find(
                    (m) =>
                      (m.user1Id === user.id && m.user2Id === otherUserId) ||
                      (m.user1Id === otherUserId && m.user2Id === user.id)
                  );
                  if (historyMatch) {
                    matchId = historyMatch.id;
                  }
                }
              } catch (err) {
                console.error('Error finding match:', err);
              }

              // If we found a match, decline it
              if (matchId) {
                try {
                  await matchAPI.declineMatch(matchId);
                } catch (err) {
                  console.error('Error declining match:', err);
                }
              }

              // Also try to remove connection if it exists
              try {
                const connections = await connectionAPI.getConnections();
                const connection = connections.find(
                  (c) =>
                    (c.user1Id === user.id && c.user2Id === actualOtherUserId) ||
                    (c.user1Id === actualOtherUserId && c.user2Id === user.id)
                );
                if (connection) {
                  await connectionAPI.removeConnection(connection.id);
                }
              } catch (err) {
                console.error('Error removing connection:', err);
              }

              // End the session if it exists
              if (chatId) {
                try {
                  await sessionAPI.endSession(chatId);
                } catch (err) {
                  console.error('Error ending session:', err);
                }
              }

              // Log the unmatch activity
              try {
                await activityAPI.logActivity({
                  type: 'CALL_ENDED', // Using CALL_ENDED as closest type
                  title: 'Unmatched',
                  description: `You unmatched with ${displayChatName || 'a user'}`,
                  metadata: {
                    unmatched: true,
                    otherUserId: actualOtherUserId,
                    matchId: matchId || null,
                    chatId: chatId || null
                  }
                });
              } catch (activityErr) {
                console.error('Error logging unmatch activity:', activityErr);
                // Don't block unmatch if activity logging fails
              }

              // Navigate back to Discovery
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [
                    {
                      name: 'Main',
                      state: {
                        routes: [
                          {
                            name: 'Discovery',
                            params: { openFilters: true },
                          },
                        ],
                        index: 0,
                      },
                    },
                  ],
                })
              );
            } catch (err) {
              console.error('Error during unmatch:', err);
              Alert.alert('Error', 'Failed to unmatch. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleReport = () => {
    setShowMenu(false);
    Alert.alert(
      'Report User',
      'Are you sure you want to report this user? This will be reviewed by our moderation team.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!actualOtherUserId) {
                Alert.alert('Error', 'Unable to report. User information is missing.');
                return;
              }

              // Report the user with sessionId if available
              // Ensure description is at least 10 characters (required by backend)
              const baseDescription = 'Reported from chat conversation';
              const reportInput = {
                reportedUserId: actualOtherUserId,
                reason: 'INAPPROPRIATE_BEHAVIOR',
                description: baseDescription.length >= 10 ? baseDescription : `${baseDescription}. User reported for inappropriate behavior during chat.`,
                ...(chatId && { sessionId: chatId }), // Include sessionId if available
              };

              const report = await userAPI.reportUser(reportInput);

              if (report && report.id) {
                Alert.alert('Reported', 'This user has been reported. Our moderation team will review this report.');
              } else {
                Alert.alert('Reported', 'This user has been reported.');
              }
            } catch (err) {
              console.error('Error reporting user:', err);
              const errorMessage = err.message || 'Failed to report user. Please try again.';
              Alert.alert('Error', errorMessage);
            }
          },
        },
      ]
    );
  };

  const handleClearChat = async () => {
    console.log('[ChatConversationScreen] handleClearChat called');
    setShowMenu(false);

    // Direct execution for testing - remove Alert temporarily
    console.log('[ChatConversationScreen] Executing clearMessages directly, chatId:', chatId);
    try {
      if (!chatId) {
        console.error('[ChatConversationScreen] No chatId available');
        Alert.alert('Error', 'Unable to clear messages. Chat ID is missing.');
        return;
      }

      console.log('[ChatConversationScreen] Calling chatAPI.clearMessages with chatId:', chatId, 'all: true');
      // Use GraphQL mutation to clear messages
      // The mutation will resolve sessionId to roomId automatically
      // Pass all: true to clear all messages (both users)
      const result = await chatAPI.clearMessages(chatId, true);
      console.log('[ChatConversationScreen] clearMessages result:', result);

      // Clear messages from local state
      setMessages([]);

      console.log('[ChatConversationScreen] Showing success alert');
      Alert.alert('Success', 'All messages cleared successfully.');
    } catch (err) {
      console.error('[ChatConversationScreen] Error clearing messages:', err);
      console.error('[ChatConversationScreen] Error details:', err.message, err.stack);
      Alert.alert('Error', err.message || 'Failed to clear messages. Please try again.');
    }
  };

  // Render message
  const renderMessage = ({ item }) => {
    if (item.isVoiceNote) {
      const isPlaying = playingMessageId === item.id;
      const isThisLoading = isLoadingAudio && playingMessageId === item.id;
      const canPlay = !item.isUploading && item.voiceUrl;
      const progress = isPlaying ? playbackProgress : 0;

      return (
        <View style={[styles.messageContainer, item.isMe ? styles.myMessage : styles.otherMessage]}>
          <TouchableOpacity
            style={[styles.voiceNoteBubble, item.isMe ? styles.myBubble : styles.otherBubble]}
            onPress={() => canPlay && playVoiceNote(item.id, item.voiceUrl)}
            disabled={!canPlay}
            activeOpacity={0.7}
          >
            <View style={styles.voiceNoteContent}>
              {/* Play/Pause Button */}
              {item.isUploading || isThisLoading ? (
                <ActivityIndicator size="small" color={item.isMe ? '#fff' : colors.primary} />
              ) : (
                <View style={[styles.playButton, !item.isMe && styles.otherPlayButton]}>
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={18}
                    color={item.isMe ? colors.primary : '#fff'}
                  />
                </View>
              )}

              {/* Progress Bar */}
              <View style={styles.voiceNoteProgressContainer}>
                <View style={styles.voiceNoteProgressBg}>
                  <View
                    style={[
                      styles.voiceNoteProgressFill,
                      {
                        width: `${progress * 100}%`,
                        backgroundColor: item.isMe ? '#fff' : colors.primary,
                      },
                    ]}
                  />
                </View>
                {/* Waveform visualization */}
                <View style={styles.voiceNoteWaveform}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((_, i) => {
                    const barProgress = (i + 1) / 12;
                    const isActive = progress >= barProgress;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.voiceNoteBar,
                          {
                            height: 4 + (Math.sin(i * 0.8) + 1) * 8,
                            backgroundColor: item.isMe ? '#fff' : colors.primary,
                            opacity: item.isUploading ? 0.3 : isActive ? 1 : 0.4,
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              </View>

              {/* Duration */}
              <Text style={[styles.voiceNoteDuration, !item.isMe && styles.otherVoiceNoteDuration]}>
                {item.isUploading ? 'Sending...' : formatTime(item.duration || 0)}
              </Text>
            </View>
            <Text style={[styles.timeText, item.isMe ? styles.myTimeText : styles.otherTimeText]}>
              {item.time}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[styles.messageContainer, item.isMe ? styles.myMessage : styles.otherMessage]}>
        <View style={[styles.messageBubble, item.isMe ? styles.myBubble : styles.otherBubble]}>
          <Text
            style={[styles.messageText, item.isMe ? styles.myMessageText : styles.otherMessageText]}
          >
            {item.text}
          </Text>
          <Text style={[styles.timeText, item.isMe ? styles.myTimeText : styles.otherTimeText]}>
            {item.time}
          </Text>
        </View>
      </View>
    );
  };

  // Render header
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        {displayProfilePicture ? (
          <Image source={{ uri: displayProfilePicture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={20} color="#8E8E93" />
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{displayChatName || 'User'}</Text>
          {isTyping && (
            <View style={styles.statusContainer}>
              <Text style={styles.typingText}>typing...</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.headerRight}>
        {incomingCallRequest ? (
          // Show accept/decline buttons when receiving a call
          <View style={styles.incomingCallButtons}>
            <TouchableOpacity
              style={[styles.callActionButton, styles.declineButton]}
              onPress={handleDeclineCall}
            >
              <Ionicons name="close" size={18} color="#FF4444" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.callActionButton, styles.acceptButton]}
              onPress={handleAcceptCall}
            >
              <Ionicons name="checkmark" size={18} color="#4CAF50" />
            </TouchableOpacity>
          </View>
        ) : (
          // Show normal header buttons when not receiving a call
          <>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => handleStartVoiceCall(false)}
            >
              <Ionicons name="call-outline" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={handleMenuPress}>
              <Ionicons name="ellipsis-vertical-outline" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  // Scroll to bottom when messages change or typing indicator appears
  useEffect(() => {
    if (flatListRef.current && (messages.length > 0 || isTyping)) {
      setTimeout(() => {
        flatListRef.current.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messages, isTyping]);

  // Show Call Interface when in call (Priority over loading)
  if (isInCall && callSession) {
    console.log('[ChatConversationScreen] Rendering call interface, status:', callStatus, 'callSession:', {
      partnerId: callSession.partnerId,
      partnerName: callSession.partnerName,
      partnerProfile: callSession.partnerProfile,
      callType: callSession.callType,
      hasRemoteStream: !!remoteStream,
      hasLocalStream: !!localStream,
    });
    
    const partnerDisplayName = callSession.partnerName || displayChatName || partnerName || 'User';
    const partnerProfilePic = callSession.partnerProfile || displayProfilePicture || partnerProfilePicture || profilePicture;
    const isVoiceCall = callSession.callType === 'VOICE';
    
    // Determine if we should show video streams (only for video calls when connected and remote stream is available)
    const isConnected = callStatus === 'connected' && remoteStream;
    const isConnecting = callStatus === 'calling' || callStatus === 'ringing';
    
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {isConnected && !isVoiceCall ? (
          // Show video streams when connected (only for video calls)
          <>
            {/* Full Screen Remote Video (Background) */}
            {Platform.OS === 'web' ? (
              <RemoteWebVideo
                stream={remoteStream}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View style={StyleSheet.absoluteFill}>
                <RTCView
                  streamURL={remoteStream.toURL()}
                  style={{ flex: 1, backgroundColor: 'black' }}
                  objectFit="cover"
                  zOrder={0}
                />
              </View>
            )}

            {/* Local Stream Video - Picture in Picture (Top Right) */}
            {localStream && (
              <View style={{
                position: 'absolute',
                top: 60,
                right: 20,
                width: 120,
                height: 160,
                borderRadius: 12,
                overflow: 'hidden',
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.8)',
                backgroundColor: '#222',
                zIndex: 10,
                elevation: 5,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.5,
                shadowRadius: 4,
              }}>
                {Platform.OS === 'web' ? (
                  <WebVideo
                    stream={localStream}
                    style={{ flex: 1 }}
                    mirror={isCameraFront}
                  />
                ) : (
                  <RTCView
                    streamURL={localStream.toURL()}
                    style={{ flex: 1 }}
                    objectFit="cover"
                    zOrder={1}
                    mirror={isCameraFront}
                  />
                )}
                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    padding: 6,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    borderRadius: 20
                  }}
                  onPress={handleToggleCamera}
                >
                  <Ionicons name="camera-reverse" size={18} color="white" />
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          // Show profile view while connecting/ringing
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }]}>
            {/* Large Profile Picture */}
            <View style={{
              width: 280,
              height: 280,
              borderRadius: 140,
              overflow: 'hidden',
              backgroundColor: '#333',
              marginBottom: 30,
              borderWidth: 4,
              borderColor: '#4CAF50',
            }}>
              {partnerProfilePic ? (
                <Image
                  source={{ uri: partnerProfilePic }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="person" size={120} color="#666" />
                </View>
              )}
            </View>
            
            {/* Partner Name */}
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '600', marginBottom: 8 }}>
              {partnerDisplayName}
            </Text>
            
            {/* Status Text */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              {isConnecting && (
                <>
                  <View style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#FFA500',
                    marginRight: 8,
                  }} />
                  <Text style={{ color: '#FFA500', fontSize: 16, fontWeight: '500' }}>
                    {callStatus === 'ringing' ? 'Ringing...' : 'Connecting...'}
                  </Text>
                </>
              )}
              {callStatus === 'connected' && !remoteStream && !isVoiceCall && (
                <>
                  <View style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#4CAF50',
                    marginRight: 8,
                  }} />
                  <Text style={{ color: '#4CAF50', fontSize: 16, fontWeight: '500' }}>
                    Connecting video...
                  </Text>
                </>
              )}
              {callStatus === 'connected' && isVoiceCall && (
                <>
                  <View style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#4CAF50',
                    marginRight: 8,
                  }} />
                  <Text style={{ color: '#4CAF50', fontSize: 16, fontWeight: '500' }}>
                    Connected
                  </Text>
                </>
              )}
            </View>
          </View>
        )}

        {/* Top Bar Overlay - Call Duration and Partner Name */}
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingTop: Platform.OS === 'ios' ? 50 : 20,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: isConnected ? 'rgba(0,0,0,0.5)' : 'transparent',
          zIndex: 5,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>{partnerDisplayName}</Text>
              {isConnecting ? (
                <Text style={{ color: '#4CAF50', fontSize: 14, marginTop: 4 }}>
                  {callStatus === 'ringing' ? 'Ringing...' : 'Connecting...'}
                </Text>
              ) : isConnected && callDuration > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Ionicons name="call" size={12} color="#4CAF50" />
                  <Text style={{ color: '#4CAF50', fontSize: 14, marginLeft: 4 }}>{formatCallTime(callDuration)}</Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={handleEndCall}
              style={{ padding: 8 }}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Controls Overlay */}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: Platform.OS === 'ios' ? 40 : 20,
          paddingTop: 20,
          paddingHorizontal: 20,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 5,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
            {/* Mute/Unmute Button */}
            <TouchableOpacity
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: 'rgba(255,255,255,0.2)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onPress={() => {
                // TODO: Implement mute toggle
                console.log('Mute toggle pressed');
              }}
            >
              <Ionicons name="mic" size={24} color="#fff" />
            </TouchableOpacity>

            {/* End Call Button */}
            <TouchableOpacity
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: '#ff4444',
                justifyContent: 'center',
                alignItems: 'center',
                elevation: 5,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.5,
                shadowRadius: 4,
              }}
              onPress={handleEndCall}
            >
              <Ionicons name="call" size={28} color="#fff" />
            </TouchableOpacity>

            {/* Camera Toggle Button (only for video calls) */}
            {!isVoiceCall && (
              <TouchableOpacity
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                onPress={handleToggleCamera}
              >
                <Ionicons name="camera-reverse" size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}

      <View style={styles.messagesContainer}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (flatListRef.current && messages.length > 0) {
              flatListRef.current.scrollToEnd({ animated: false });
            }
          }}
          ListFooterComponent={
            isTyping ? (
              <View style={[styles.messageContainer, styles.otherMessage]}>
                <View style={[styles.messageBubble, styles.otherBubble, styles.typingBubble]}>
                  <TypingIndicator />
                </View>
              </View>
            ) : null
          }
        />
      </View>

      {isRecording ? (
        <View style={styles.recordingContainer}>
          <View style={styles.recordingActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => stopRecording(false)}>
              <Ionicons name="close-circle" size={28} color="#ff6b6b" />
            </TouchableOpacity>

            <View style={styles.recordingIndicator}>
              <Ionicons name="mic" size={24} color="#fff" style={styles.micIcon} />
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>{formatTime(recordingTime)}</Text>
            </View>

            <TouchableOpacity style={styles.sendButton} onPress={() => stopRecording(true)}>
              <Ionicons name="checkmark-circle" size={28} color="#51e3a5" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inputContainer}
        >
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={message}
              onChangeText={handleTextChange}
              placeholder="Type a message..."
              placeholderTextColor={colors.gray}
              multiline
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSend}
              disabled={!message.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons
                  name="send"
                  size={24}
                  color={message.trim() ? colors.primary : colors.gray}
                />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.voiceButton} onPress={toggleRecording}>
              <Ionicons name="mic-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                console.log('[ChatConversationScreen] Clear Chat button pressed');
                handleClearChat();
              }}
            >
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
              <Text style={[styles.menuText, { color: '#FF3B30' }]}>Clear Chat</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleUnmatch}>
              <Ionicons name="close-circle-outline" size={24} color="#FF3B30" />
              <Text style={[styles.menuText, { color: '#FF3B30' }]}>Unmatch</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleReport}>
              <Ionicons name="flag-outline" size={24} color="#FF3B30" />
              <Text style={[styles.menuText, { color: '#FF3B30' }]}>Report</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    backgroundColor: colors.background,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  typingText: {
    fontSize: 12,
    color: colors.primary,
    fontStyle: 'italic',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  incomingCallButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  acceptButton: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  declineButton: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FF4444',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesList: {
    paddingVertical: 16,
  },
  messageContainer: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  myMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 4,
  },
  myBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: colors.lightGray,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: colors.white,
  },
  otherMessageText: {
    color: colors.textPrimary,
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  myTimeText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherTimeText: {
    color: colors.darkGray,
  },
  inputContainer: {
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    backgroundColor: colors.background,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    borderRadius: 24,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    minHeight: 48,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    maxHeight: 120,
    paddingVertical: 12,
    paddingLeft: 0,
    paddingRight: 8,
  },
  sendButton: {
    marginLeft: 8,
    padding: 8,
  },
  voiceButton: {
    marginLeft: 8,
    padding: 8,
  },
  voiceNoteBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 4,
  },
  voiceNoteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otherPlayButton: {
    backgroundColor: colors.primary,
  },
  voiceNoteProgressContainer: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
  },
  voiceNoteProgressBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  voiceNoteProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  voiceNoteWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
    height: 20,
  },
  voiceNoteBar: {
    width: 3,
    borderRadius: 2,
  },
  voiceNoteDuration: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  otherVoiceNoteDuration: {
    color: colors.textPrimary,
  },
  recordingContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    backgroundColor: colors.background,
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  cancelButton: {
    padding: 8,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  micIcon: {
    marginRight: 4,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff6b6b',
    marginHorizontal: 4,
  },
  recordingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 4,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 16,
  },
  menuContainer: {
    backgroundColor: colors.background,
    borderRadius: 12,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.lightGray,
    marginHorizontal: 16,
  },
  typingBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 60,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textPrimary,
  },
});

export default ChatConversationScreen;
