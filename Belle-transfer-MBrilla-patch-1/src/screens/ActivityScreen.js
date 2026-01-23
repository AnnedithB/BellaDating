import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { notificationAPI, connectionAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ActivityScreen({ navigation }) {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'connections'

  const loadActivity = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      setError(null);

      // Load both notifications and connections in parallel
      const [notifications, connections] = await Promise.all([
        notificationAPI.getNotifications(20, 0).catch(() => []),
        connectionAPI.getConnections().catch(() => []),
      ]);

      // Transform notifications to activity format
      const notificationActivities = (notifications || []).map((notif) => ({
        id: `notif-${notif.id}`,
        type: notif.type === 'CONNECTION_REQUEST' ? 'pending' : 'notification',
        name: notif.title,
        description: notif.message,
        time: formatTimeAgo(notif.createdAt),
        profilePicture: notif.data?.profilePicture,
        data: notif.data,
        read: notif.read,
        notificationId: notif.id,
      }));

      // Transform connections to activity format
      const connectionActivities = (connections || []).map((conn) => {
        const otherUser = conn.user1Id === user?.id ? conn.user2 : conn.user1;
        const isPending = conn.status === 'PENDING' && conn.user2Id === user?.id;

        return {
          id: `conn-${conn.id}`,
          type: isPending ? 'pending' : 'connection',
          name: otherUser?.name || otherUser?.username || 'Unknown',
          description: isPending
            ? `You've a new connection request from ${otherUser?.name || otherUser?.username}`
            : `You matched with ${otherUser?.name || otherUser?.username}`,
          time: formatTimeAgo(conn.createdAt),
          profilePicture: otherUser?.profilePicture,
          icon: 'heart',
          color: isPending ? '#FFA500' : '#ff4444',
          connectionId: conn.id,
          otherUserId: otherUser?.id,
        };
      });

      // Combine and sort by time
      let allActivities = [...notificationActivities, ...connectionActivities];

      // Apply filter
      if (filter === 'pending') {
        allActivities = allActivities.filter((a) => a.type === 'pending');
      } else if (filter === 'connections') {
        allActivities = allActivities.filter((a) => a.type === 'connection');
      }

      // Sort by most recent first
      allActivities.sort((a, b) => {
        // Simple sort - pending first, then by time string
        if (a.type === 'pending' && b.type !== 'pending') return -1;
        if (b.type === 'pending' && a.type !== 'pending') return 1;
        return 0;
      });

      setActivities(allActivities);
    } catch (err) {
      console.error('Error loading activity:', err);
      setError('Failed to load activity');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
  };

  // Load on mount
  useEffect(() => {
    loadActivity();
  }, [filter]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadActivity(false);
    }, [filter])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadActivity(false);
  };

  const handleActivityPress = (item) => {
    if (item.type === 'pending') {
      navigation.navigate('RequestReview', {
        request: item,
        connectionId: item.connectionId,
        otherUserId: item.otherUserId,
      });
    }

    // Mark notification as read if it's unread
    if (item.notificationId && !item.read) {
      notificationAPI.markNotificationAsRead(item.notificationId).catch(console.error);
    }
  };

  const handleFilterPress = () => {
    // Cycle through filters
    if (filter === 'all') setFilter('pending');
    else if (filter === 'pending') setFilter('connections');
    else setFilter('all');
  };

  const renderActivityItem = ({ item }) => {
    const ItemComponent = item.type === 'pending' ? TouchableOpacity : View;

    return (
      <ItemComponent
        style={[styles.activityItem, !item.read && item.notificationId && styles.unreadItem]}
        onPress={item.type === 'pending' ? () => handleActivityPress(item) : undefined}
      >
        {item.profilePicture ? (
          <Image source={{ uri: item.profilePicture }} style={styles.profilePicture} />
        ) : (
          <View style={[styles.profilePicture, styles.profilePlaceholder]}>
            <Ionicons name="person" size={24} color="#8E8E93" />
          </View>
        )}
        <View style={styles.activityInfo}>
          <Text style={styles.activityTitle}>
            {item.type === 'pending' ? 'Pending Request' : 'New Connection'}
          </Text>
          <Text style={styles.activityDescription} numberOfLines={2}>
            {item.description}
          </Text>
          <Text style={styles.activityTime}>{item.time}</Text>
        </View>
        {item.type === 'pending' && <Ionicons name="chevron-forward" size={20} color="#8E8E93" />}
      </ItemComponent>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Activity</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
        <TouchableOpacity style={styles.filterButton} onPress={handleFilterPress}>
          <Ionicons name="filter" size={20} color="#000000" />
          {filter !== 'all' && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      {filter !== 'all' && (
        <View style={styles.filterChip}>
          <Text style={styles.filterChipText}>
            {filter === 'pending' ? 'Pending Requests' : 'Connections'}
          </Text>
          <TouchableOpacity onPress={() => setFilter('all')}>
            <Ionicons name="close" size={16} color="#000000" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.content}>
        {error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadActivity()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : activities.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-outline" size={80} color="#cccccc" />
            <Text style={styles.emptyStateText}>No activity yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Your connections and interactions will appear here
            </Text>
          </View>
        ) : (
          <FlatList
            data={activities}
            renderItem={renderActivityItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.activityList}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  filterButton: {
    padding: 8,
    position: 'relative',
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    gap: 8,
  },
  filterChipText: {
    fontSize: 14,
    color: '#000000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
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
  activityList: {
    paddingBottom: 20,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  unreadItem: {
    backgroundColor: '#F8F8FA',
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  profilePlaceholder: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  activityDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
});
