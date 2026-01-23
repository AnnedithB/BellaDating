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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/colors';
import { useNavigation, CommonActions, useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { chatAPI, sessionAPI, userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const ChatConversationScreen = ({ route }) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const {
    joinConversation,
    leaveConversation,
    subscribeToMessages,
    sendTypingStart,
    sendTypingStop,
    isUserOnline,
    getTypingUsersInConversation,
    connected: socketConnected,
  } = useSocket();
  const {
    chatId,
    chatName,
    isOnline: initialIsOnline,
    profilePicture,
    otherUserId,
  } = route.params || {};

  // State
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isOnline, setIsOnline] = useState(initialIsOnline);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

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

  // Load messages
  const loadMessages = async (showLoading = true) => {
    if (!chatId) return;

    try {
      if (showLoading) setIsLoading(true);

      const data = await chatAPI.getSessionMessages(chatId, 50, 0);

      // Transform to display format
      const formattedMessages = (data || []).map((msg) => ({
        id: msg.id,
        text: msg.content,
        time: formatMessageTime(msg.sentAt),
        isMe: msg.senderId === user?.id,
        isVoiceNote: msg.messageType === 'VOICE',
        voiceUrl: msg.voiceUrl,
        duration: msg.voiceDuration || msg.duration,
        isDelivered: msg.isDelivered,
        isRead: msg.isRead,
      }));

      // Sort by time, oldest first
      formattedMessages.sort((a, b) => {
        const timeA = new Date(a.sentAt || 0);
        const timeB = new Date(b.sentAt || 0);
        return timeA - timeB;
      });

      setMessages(formattedMessages);
    } catch (err) {
      console.error('Error loading messages:', err);
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

  // Load on mount and set up Socket.IO
  useEffect(() => {
    loadMessages();

    // Mark session as read
    if (chatId) {
      chatAPI.markSessionAsRead(chatId).catch(console.error);
    }

    // Join the conversation room via Socket.IO
    if (chatId && socketConnected) {
      joinConversation(chatId);
    }

    // Subscribe to real-time messages
    let unsubscribe = () => {};
    if (chatId) {
      unsubscribe = subscribeToMessages(chatId, (data) => {
        // Only add message if it's from the other user (our sent messages are added optimistically)
        if (data.senderId !== user?.id) {
          const newMessage = {
            id: data.id || `socket-${Date.now()}`,
            text: data.content,
            time: formatMessageTime(data.sentAt || new Date().toISOString()),
            isMe: false,
            isVoiceNote: data.messageType === 'VOICE',
            voiceUrl: data.voiceUrl,
            duration: data.voiceDuration || data.duration,
            isDelivered: true,
            isRead: false,
          };
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
        }
      });
    }

    return () => {
      // Leave conversation room
      if (chatId && socketConnected) {
        leaveConversation(chatId);
      }
      // Unsubscribe from messages
      unsubscribe();
      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [chatId, socketConnected]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadMessages(false);
      // Re-join conversation if socket reconnected
      if (chatId && socketConnected) {
        joinConversation(chatId);
      }
    }, [chatId, socketConnected])
  );

  // Track other user's online status
  useEffect(() => {
    if (otherUserId) {
      setIsOnline(isUserOnline(otherUserId));
    }
  }, [otherUserId, isUserOnline]);

  // Track typing indicator
  useEffect(() => {
    if (chatId) {
      const typingUsers = getTypingUsersInConversation(chatId);
      const otherTyping = typingUsers.some((t) => t.userId !== user?.id);
      setIsTyping(otherTyping);
    }
  }, [chatId, getTypingUsersInConversation, user?.id]);

  // Handle typing indicator - send when user is typing
  const handleTextChange = (text) => {
    setMessage(text);

    // Send typing start if we have text
    if (text.length > 0 && chatId) {
      sendTypingStart(chatId);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 2 seconds of no input
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingStop(chatId);
      }, 2000);
    } else if (text.length === 0 && chatId) {
      sendTypingStop(chatId);
    }
  };

  // Send message
  const handleSend = async () => {
    if (message.trim() === '' || isSending) return;

    const messageText = message.trim();
    setMessage('');
    setIsSending(true);

    // Stop typing indicator
    if (chatId) {
      sendTypingStop(chatId);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Optimistic update
    const tempMessage = {
      id: `temp-${Date.now()}`,
      text: messageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
      isDelivered: false,
      isRead: false,
    };
    setMessages((prev) => [...prev, tempMessage]);

    try {
      const sentMessage = await chatAPI.sendMessage({
        sessionId: chatId,
        content: messageText,
        messageType: 'TEXT',
      });

      // Replace temp message with real one
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempMessage.id
            ? {
                id: sentMessage.id,
                text: sentMessage.content,
                time: formatMessageTime(sentMessage.sentAt),
                isMe: true,
                isDelivered: sentMessage.isDelivered,
                isRead: sentMessage.isRead,
              }
            : msg
        )
      );
    } catch (err) {
      console.error('Error sending message:', err);
      // Remove temp message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
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

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    try {
      clearInterval(timerRef.current);
      setIsRecording(false);

      const recording = recordingRef.current;
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      // Get the recording URI
      const uri = recording.getURI();
      if (!uri) {
        console.error('No recording URI available');
        return;
      }

      // Create optimistic message while uploading
      const tempId = `temp-voice-${Date.now()}`;
      const tempMessage = {
        id: tempId,
        isVoiceNote: true,
        duration: recordingTime,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isMe: true,
        isUploading: true,
      };
      setMessages((prev) => [...prev, tempMessage]);

      try {
        // Upload voice note to server
        const result = await chatAPI.uploadVoiceNote(uri, chatId, recordingTime);

        // Replace temp message with real one
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId
              ? {
                  id: result.messageId,
                  isVoiceNote: true,
                  duration: result.voiceDuration || recordingTime,
                  voiceUrl: result.voiceUrl,
                  time: formatMessageTime(result.timestamp),
                  isMe: true,
                  isDelivered: true,
                }
              : msg
          )
        );
      } catch (uploadError) {
        console.error('Failed to upload voice note:', uploadError);
        // Remove temp message on error
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
        Alert.alert('Error', 'Failed to send voice note. Please try again.');
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to process recording.');
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Voice note playback
  const playVoiceNote = async (messageId, voiceUrl) => {
    try {
      // If already playing this message, pause it
      if (playingMessageId === messageId && soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setPlayingMessageId(null);
          return;
        } else {
          // Resume playback
          await soundRef.current.playAsync();
          setPlayingMessageId(messageId);
          return;
        }
      }

      // Stop any currently playing audio
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      setIsLoadingAudio(true);
      setPlayingMessageId(messageId);
      setPlaybackProgress(0);

      // Build full URL - voiceUrl is relative like /uploads/voice-notes/xxx.m4a
      const { config } = require('../services/config');
      const fullUrl = voiceUrl.startsWith('http')
        ? voiceUrl
        : `${config.COMMUNICATION_SERVICE_URL}${voiceUrl}`;

      // Set audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Load and play the audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: fullUrl },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      setIsLoadingAudio(false);
    } catch (error) {
      console.error('Error playing voice note:', error);
      setPlayingMessageId(null);
      setIsLoadingAudio(false);
      Alert.alert('Error', 'Failed to play voice note');
    }
  };

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      if (status.durationMillis > 0) {
        const progress = status.positionMillis / status.durationMillis;
        setPlaybackProgress(progress);
      }

      if (status.didJustFinish) {
        // Audio finished playing
        setPlayingMessageId(null);
        setPlaybackProgress(0);
        // Unload the sound
        if (soundRef.current) {
          soundRef.current.unloadAsync();
          soundRef.current = null;
        }
      }
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Menu handlers
  const handleMenuPress = () => {
    setShowMenu(true);
  };

  const handleUnmatch = () => {
    setShowMenu(false);
    Alert.alert(
      'Unmatch',
      `Are you sure you want to unmatch with ${chatName}? You will be redirected to Discovery.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          style: 'destructive',
          onPress: async () => {
            try {
              // End the session
              if (chatId) {
                await sessionAPI.endSession(chatId);
              }
            } catch (err) {
              console.error('Error ending session:', err);
            }

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
          },
        },
      ]
    );
  };

  const handleReport = () => {
    setShowMenu(false);
    Alert.alert('Report User', 'Are you sure you want to report this user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: async () => {
          try {
            if (otherUserId) {
              await userAPI.reportUser({
                reportedUserId: otherUserId,
                reason: 'INAPPROPRIATE_BEHAVIOR',
                description: 'Reported from chat',
              });
            }
            Alert.alert('Reported', 'This user has been reported.');
          } catch (err) {
            console.error('Error reporting user:', err);
            Alert.alert('Error', 'Failed to report user. Please try again.');
          }
        },
      },
    ]);
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
        {profilePicture ? (
          <Image source={{ uri: profilePicture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={20} color="#8E8E93" />
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{chatName || 'User'}</Text>
          <View style={styles.statusContainer}>
            {isTyping ? (
              <Text style={styles.typingText}>typing...</Text>
            ) : (
              <>
                <View
                  style={[styles.statusDot, { backgroundColor: isOnline ? colors.success : colors.gray }]}
                />
                <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
              </>
            )}
          </View>
        </View>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="call-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerButton} onPress={handleMenuPress}>
          <Ionicons name="ellipsis-vertical-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Scroll to bottom when messages change
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messages]);

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
        />
      </View>

      {isRecording ? (
        <View style={styles.recordingContainer}>
          <View style={styles.recordingActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={stopRecording}>
              <Ionicons name="close-circle" size={28} color="#ff6b6b" />
            </TouchableOpacity>

            <View style={styles.recordingIndicator}>
              <Ionicons name="mic" size={24} color="#fff" style={styles.micIcon} />
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>{formatTime(recordingTime)}</Text>
            </View>

            <TouchableOpacity style={styles.sendButton} onPress={stopRecording}>
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
});

export default ChatConversationScreen;
