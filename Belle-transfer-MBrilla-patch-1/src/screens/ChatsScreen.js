import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ChatItem, EmptyState, ScreenHeader } from '../components';
import { sessionAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ChatsScreen({ navigation }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadSessions = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      setError(null);

      const data = await sessionAPI.getActiveSessions();

      // Transform sessions to chat format
      const chats = (data || []).map((session) => {
        // Determine which user is the other person
        const otherUser = session.user1Id === user?.id ? session.user2 : session.user1;

        return {
          id: session.id,
          sessionId: session.id,
          name: otherUser?.username || otherUser?.name || 'Unknown',
          profilePicture: otherUser?.profilePicture,
          lastMessage: '', // Will be populated from last message
          time: formatTimeAgo(session.startedAt),
          unread: 0, // Will be populated from unread count
          isOnline: otherUser?.isOnline || false,
          otherUserId: otherUser?.id,
        };
      });

      setSessions(chats);
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError('Failed to load conversations');
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
    loadSessions();
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadSessions(false);
    }, [])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSessions(false);
  };

  const handleChatPress = (item) => {
    navigation.navigate('ChatConversation', {
      chatId: item.sessionId,
      chatName: item.name,
      isOnline: item.isOnline,
      profilePicture: item.profilePicture,
      otherUserId: item.otherUserId,
    });
  };

  const handleSearchPress = () => {
    console.log('Search pressed');
  };

  const renderChatItem = ({ item }) => (
    <ChatItem item={item} onPress={handleChatPress} />
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
