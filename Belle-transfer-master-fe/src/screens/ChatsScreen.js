import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Text,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ChatItem, EmptyState, ScreenHeader } from '../components';
import { sessionAPI, chatAPI, matchAPI, connectionAPI, userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function ChatsScreen({ navigation }) {
  const { user } = useAuth();
  const {
    subscribeToMatches,
    getTypingUsersInConversation,
    typingUsers,
    callStatuses,
    connected,
    joinConversation,
    leaveConversation,
  } = useSocket();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const joinedConversationIdsRef = useRef(new Set());

  const loadSessions = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      setError(null);

      // Check if user is authenticated before making API call
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Fetch both active sessions and persistent conversations in parallel
      const [sessionsData, conversationsData] = await Promise.all([
        sessionAPI.getActiveSessions().catch(err => {
          console.warn('[ChatsScreen] Error loading sessions:', err);
          return [];
        }),
        chatAPI.getConversations(50, 0).catch(err => {
          console.warn('[ChatsScreen] Error loading conversations:', err);
          return [];
        }),
      ]);

      console.log('[ChatsScreen] Loaded sessions:', sessionsData?.length || 0);
      console.log('[ChatsScreen] Loaded conversations:', conversationsData?.length || 0);

      // Transform sessions to chat format
      const sessionChats = (sessionsData || []).map((session) => {
        // Determine which user is the other person
        const otherUser = session.user1Id === user?.id ? session.user2 : session.user1;

        return {
          id: session.id,
          sessionId: session.id,
          roomId: session.metadata?.roomId || null,
          name: otherUser?.name || otherUser?.email?.split('@')[0] || 'Unknown',
          profilePicture: otherUser?.profilePicture,
          lastMessage: '',
          time: formatTimeAgo(session.startedAt),
          unread: 0,
          isOnline: otherUser?.isOnline || false,
          otherUserId: otherUser?.id,
          startedAt: session.startedAt,
          isActive: true,
        };
      });

      // Transform conversations (chat rooms) to chat format
      // First, collect all unique other user IDs that need profile info
      const otherUserIdsToFetch = new Set();
      (conversationsData || []).forEach((conv) => {
        const otherUserId = conv.participant1Id === user?.id ? conv.participant2Id : conv.participant1Id;
        if (otherUserId) otherUserIdsToFetch.add(otherUserId);
      });

      // Fetch profiles for other users in parallel
      const userProfiles = {};
      if (otherUserIdsToFetch.size > 0) {
        const profilePromises = Array.from(otherUserIdsToFetch).map(async (userId) => {
          try {
            const profile = await userAPI.getUserById(userId);
            if (profile) {
              userProfiles[userId] = profile;
            }
          } catch (err) {
            console.warn(`[ChatsScreen] Failed to fetch profile for ${userId}:`, err);
          }
        });
        await Promise.allSettled(profilePromises);
      }

      const conversationChats = (conversationsData || []).map((conv) => {
        // Determine which user is the other person
        const otherUserId = conv.participant1Id === user?.id ? conv.participant2Id : conv.participant1Id;
        // Get last message info
        const lastMessage = conv.messages?.[0];
        // Get profile from fetched profiles
        const otherUserProfile = userProfiles[otherUserId] || {};

        return {
          id: conv.roomId || conv.id,
          sessionId: null, // Conversations don't have sessionId
          roomId: conv.roomId,
          name: otherUserProfile.name || otherUserProfile.displayName || otherUserProfile.email?.split('@')[0] || 'Unknown User',
          profilePicture: otherUserProfile.profilePicture || null,
          lastMessage: lastMessage?.content || '',
          time: formatTimeAgo(conv.lastActivity || lastMessage?.timestamp || conv.createdAt),
          unread: 0,
          isOnline: otherUserProfile.isOnline || false,
          otherUserId: otherUserId,
          startedAt: conv.createdAt,
          isActive: false,
        };
      });

      // Merge and deduplicate by otherUserId - prefer active sessions
      const chatMap = new Map();
      
      // Add conversation chats first (lower priority)
      conversationChats.forEach((chat) => {
        if (!chat.otherUserId) return;
        chatMap.set(chat.otherUserId, chat);
      });

      // Add session chats (higher priority - overwrites conversations)
      // Keep the conversation roomId when available so both users join the same chat room.
      sessionChats.forEach((chat) => {
        if (!chat.otherUserId) return;
        const existing = chatMap.get(chat.otherUserId);
        if (existing?.roomId && existing.roomId !== chat.roomId) {
          chat.roomId = existing.roomId;
        }
        chatMap.set(chat.otherUserId, chat);
      });

      // Convert map to array and sort by most recent
      let chats = Array.from(chatMap.values()).sort((a, b) => {
        return new Date(b.startedAt) - new Date(a.startedAt);
      });

      // Add typing status and call status to each chat
      chats = chats.map((chat) => {
        if (!chat.otherUserId) {
          return { ...chat, isTyping: false, callStatus: null };
        }

        // Get all possible conversation ID formats for this chat
        const possibleIds = [
          chat.roomId,
          chat.sessionId,
          chat.id,
        ].filter(Boolean);

        // Check typingUsers map directly - iterate through all typing users
        // and check if userId matches and conversationId matches any of our possible IDs
        let otherUserTyping = false;
        if (typingUsers) {
          typingUsers.forEach((data, key) => {
            // Key format is: `${conversationId}:${userId}`
            const [convId, userId] = key.split(':');
            
            // Check if this typing event is for our other user
            if (userId === chat.otherUserId) {
              // Check if the conversation ID matches any of our possible IDs
              if (possibleIds.includes(convId)) {
                otherUserTyping = true;
              }
            }
          });
        }

        // Check call statuses
        let callStatus = null;
        if (callStatuses) {
          callStatuses.forEach((status, key) => {
            // Key format is: `${conversationId}:${callerId}`
            const [convId, callerId] = key.split(':');
            
            // Check if this call is from/to our other user
            if (callerId === chat.otherUserId || callerId === user?.id) {
              // Check if the conversation ID matches any of our possible IDs
              if (possibleIds.includes(convId)) {
                callStatus = status;
              }
            }
          });
        }

        return {
          ...chat,
          isTyping: otherUserTyping,
          callStatus,
        };
      });

      setSessions(chats);
    } catch (err) {
      console.error('Error loading sessions:', err);
      const errorMessage = err?.message || err?.error?.message || 'Failed to load conversations';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  // Load on mount
  useEffect(() => {
    // Only load if user is authenticated
    if (user) {
      loadSessions();
    }
  }, [user]);

  // Subscribe to match notifications
  useEffect(() => {
    const unsubscribe = subscribeToMatches((data) => {
      console.log('[ChatsScreen] Received match notification, reloading sessions...');
      loadSessions(false);
    });

    return () => {
      unsubscribe();
    };
  }, [subscribeToMatches]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Only load if user is authenticated
      if (user) {
        loadSessions(false);
      }
    }, [user])
  );

  // Update typing status and call status when typingUsers or callStatuses changes
  useEffect(() => {
    console.log('[ChatsScreen] Typing/call status update triggered:', {
      sessionsCount: sessions.length,
      typingUsersSize: typingUsers?.size || 0,
      callStatusesSize: callStatuses?.size || 0,
    });
    
    if (sessions.length > 0 && (typingUsers || callStatuses)) {
      setSessions((prevSessions) =>
        prevSessions.map((chat) => {
          if (!chat.otherUserId) {
            return { ...chat, isTyping: false, callStatus: null };
          }

          // Get all possible conversation ID formats for this chat
          const possibleIds = [
            chat.roomId,
            chat.sessionId,
            chat.id,
          ].filter(Boolean);

          // Check typingUsers map directly - iterate through all typing users
          // and check if userId matches and conversationId matches any of our possible IDs
          let otherUserTyping = false;
          if (typingUsers) {
            typingUsers.forEach((data, key) => {
              // Key format is: `${conversationId}:${userId}`
              const [convId, userId] = key.split(':');
              
              // Check if this typing event is for our other user
              if (userId === chat.otherUserId) {
                // Check if the conversation ID matches any of our possible IDs
                if (possibleIds.includes(convId)) {
                  otherUserTyping = true;
                  console.log('[ChatsScreen] Found typing match:', {
                    chatName: chat.name,
                    otherUserId: chat.otherUserId,
                    conversationId: convId,
                    possibleIds,
                  });
                }
              }
            });
          }

          // Check call statuses
          let callStatus = null;
          if (callStatuses) {
            callStatuses.forEach((status, key) => {
              // Key format is: `${conversationId}:${callerId}`
              const [convId, callerId] = key.split(':');
              
              console.log('[ChatsScreen] Checking call status:', {
                key,
                convId,
                callerId,
                chatOtherUserId: chat.otherUserId,
                currentUserId: user?.id,
                possibleIds,
                status,
              });
              
              // Check if the conversation ID matches any of our possible IDs
              if (possibleIds.includes(convId)) {
                // If callerId matches otherUserId, they're calling us (receiving_call)
                // If callerId matches our userId, we're calling them (shouldn't show in list)
                if (callerId === chat.otherUserId) {
                  callStatus = status;
                  console.log('[ChatsScreen] Found call status match:', {
                    chatName: chat.name,
                    callStatus: status,
                    key,
                  });
                }
              }
            });
          }

          return {
            ...chat,
            isTyping: otherUserTyping,
            callStatus,
          };
        })
      );
    }
  }, [typingUsers, callStatuses, user?.id]);

  // Join all known conversation/session rooms so typing indicators work in list
  useEffect(() => {
    if (!connected) return;

    const desiredIds = new Set();
    sessions.forEach((chat) => {
      if (chat.roomId) desiredIds.add(chat.roomId);
      if (chat.sessionId) desiredIds.add(chat.sessionId);
      if (chat.id) desiredIds.add(chat.id);
    });

    const currentIds = joinedConversationIdsRef.current;
    desiredIds.forEach((id) => {
      if (!currentIds.has(id)) {
        joinConversation(id);
        currentIds.add(id);
      }
    });

    currentIds.forEach((id) => {
      if (!desiredIds.has(id)) {
        leaveConversation(id);
        currentIds.delete(id);
      }
    });
  }, [connected, sessions, joinConversation, leaveConversation]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSessions(false);
  };

  const handleChatPress = (item) => {
    navigation.navigate('ChatConversation', {
      chatId: item.sessionId || item.roomId,
      roomId: item.roomId,
      sessionId: item.sessionId,
      chatName: item.name,
      isOnline: item.isOnline,
      profilePicture: item.profilePicture,
      otherUserId: item.otherUserId,
    });
  };

  const handleSearchPress = () => {
    console.log('Search pressed');
  };

  const handleDeleteChat = async (item) => {
    console.log('[ChatsScreen] handleDeleteChat called with item:', item);

    // Direct execution for testing - remove Alert temporarily
    console.log('[ChatsScreen] Executing deleteChat directly');
    try {
      const otherUserId = item.otherUserId;

      console.log('[ChatsScreen] otherUserId:', otherUserId, 'user?.id:', user?.id);
      if (!otherUserId) {
        console.error('[ChatsScreen] No otherUserId available');
        Alert.alert('Error', 'Unable to delete. User information is missing.');
        return;
      }

      // 1. Find and decline the match
      try {
        const pendingMatches = await matchAPI.getPendingMatches();
        const pendingMatch = pendingMatches.find(
          (m) =>
            (m.user1Id === user?.id && m.user2Id === otherUserId) ||
            (m.user1Id === otherUserId && m.user2Id === user?.id)
        );

        if (pendingMatch) {
          await matchAPI.declineMatch(pendingMatch.id);
          console.log('[ChatsScreen] Declined pending match');
        } else {
          // Try match history
          const matchHistory = await matchAPI.getMatchHistory(50, 0);
          const historyMatch = matchHistory.find(
            (m) =>
              (m.user1Id === user?.id && m.user2Id === otherUserId) ||
              (m.user1Id === otherUserId && m.user2Id === user?.id)
          );
          if (historyMatch) {
            await matchAPI.declineMatch(historyMatch.id);
            console.log('[ChatsScreen] Declined match from history');
          }
        }
      } catch (matchErr) {
        console.error('[ChatsScreen] Error declining match:', matchErr);
        // Continue even if match decline fails
      }

      // 2. Remove connection if it exists
      try {
        const connections = await connectionAPI.getConnections();
        const connection = connections.find(
          (c) =>
            (c.user1Id === user?.id && c.user2Id === otherUserId) ||
            (c.user1Id === otherUserId && c.user2Id === user?.id)
        );
        if (connection) {
          await connectionAPI.removeConnection(connection.id);
          console.log('[ChatsScreen] Removed connection');
        }
      } catch (connectionErr) {
        console.error('[ChatsScreen] Error removing connection:', connectionErr);
        // Continue even if connection removal fails
      }

      // 3. Clear all messages in the conversation (both users)
      try {
        // Use sessionId (chatId) - the GraphQL mutation will resolve it to roomId
        // Pass all: true to clear all messages (not just user's own)
        await chatAPI.clearMessages(item.sessionId, true);
        console.log('[ChatsScreen] Cleared all messages');
      } catch (messageErr) {
        console.error('[ChatsScreen] Error clearing messages:', messageErr);
        // Continue even if message clearing fails
      }

      // 4. End the session
      try {
        await sessionAPI.endSession(item.sessionId);
        console.log('[ChatsScreen] Ended session');
      } catch (sessionErr) {
        console.error('[ChatsScreen] Error ending session:', sessionErr);
        // Continue even if session end fails
      }

      // Remove from local state
      setSessions((prevSessions) =>
        prevSessions.filter((session) => session.id !== item.id)
      );

      Alert.alert('Success', 'All history deleted successfully.');
    } catch (err) {
      console.error('[ChatsScreen] Error deleting chat:', err);
      Alert.alert('Error', 'Failed to delete chat. Please try again.');
    }
  };

  const renderChatItem = ({ item }) => (
    <ChatItem
      item={item}
      onPress={handleChatPress}
      onDelete={() => handleDeleteChat(item)}
    />
  );

  const searchButton = (
    <TouchableOpacity style={styles.searchButton} onPress={handleSearchPress}>
      <Ionicons name="search" size={20} color="#000000" />
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Chats" rightButton={searchButton} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Chats" rightButton={searchButton} />

      <View style={styles.content}>
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadSessions()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="No matches yet"
            subtitle="Start matching to see your conversations here"
          />
        ) : (
          <FlatList
            data={sessions}
            renderItem={renderChatItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.matchesList}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor="#000000"
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  matchesList: {
    paddingBottom: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
