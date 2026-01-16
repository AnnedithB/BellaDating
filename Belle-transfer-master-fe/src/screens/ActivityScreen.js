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
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { notificationAPI, connectionAPI, matchAPI, activityAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

import { useSocket } from '../context/SocketContext';

export default function ActivityScreen({ navigation }) {
  const { user } = useAuth();
  const { subscribeToMatches } = useSocket();
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'connections'
  const [matchModalVisible, setMatchModalVisible] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [processingMatch, setProcessingMatch] = useState(false);
  const [clearModalVisible, setClearModalVisible] = useState(false);
  const [clearingActivity, setClearingActivity] = useState(false);

  // ... (loadActivity function remains the same)

  const loadActivity = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      setError(null);

      // Load both notifications and connections in parallel
      console.log('[ActivityScreen] Loading notifications and connections...');
      const [notifications, connections, activityLogs] = await Promise.all([
        notificationAPI.getNotifications(20, 0).catch((err) => {
          console.error('[ActivityScreen] Error loading notifications:', err);
          return [];
        }),
        connectionAPI.getConnections().catch((err) => {
          console.error('[ActivityScreen] Error loading connections:', err);
          return [];
        }),
        activityAPI.getActivities(50, 0).catch((err) => {
          console.error('[ActivityScreen] Error loading activities:', err);
          return [];
        }),
      ]);

      console.log('[ActivityScreen] Loaded notifications:', notifications?.length || 0);
      console.log('[ActivityScreen] Notification types:', notifications?.map(n => n.type) || []);
      console.log('[ActivityScreen] Loaded connections:', connections?.length || 0);
      console.log('[ActivityScreen] Loaded activity logs:', activityLogs?.length || 0);

      // Transform notifications to activity format
      // Show all notifications (both read and unread) - they should persist in activity list
      const notificationActivities = (notifications || [])
        .map((notif) => {
          // Handle NEW_MATCH notifications specially
          const isNewMatch = notif.type === 'NEW_MATCH';
          const isCallRequest = notif.type === 'CALL_REQUEST';
          const isCallActivity = notif.type === 'CALL_ACCEPTED' || notif.type === 'CALL_DECLINED';

          let type = 'notification';
          if (notif.type === 'CONNECTION_REQUEST') type = 'pending';
          else if (isNewMatch) type = 'match';
          else if (isCallRequest) type = 'call_request';
          else if (isCallActivity) type = notif.type.toLowerCase();

          return {
            id: `notif-${notif.id}`,
            type,
            name: notif.title,
            description: notif.message || notif.title,
            time: formatTimeAgo(notif.createdAt),
            profilePicture: notif.data?.partnerProfilePicture || notif.data?.profilePicture || notif.data?.callerProfilePicture,
            data: notif.data,
            read: notif.read,
            notificationId: notif.id,
            matchId: notif.data?.matchId, // For NEW_MATCH notifications
            callId: notif.data?.callId, // For CALL_REQUEST notifications
            direction: 'inbound', // All notifications are inbound
            createdAt: notif.createdAt,
          };
        });

      console.log('[ActivityScreen] Loaded notifications:', notificationActivities.length);
      console.log('[ActivityScreen] Notification types:', notificationActivities.map(n => n.type));

      // Transform connections to activity format
      const connectionActivities = (connections || []).map((conn) => {
        const otherUser = conn.user1Id === user?.id ? conn.user2 : conn.user1;
        const isPending = conn.status === 'PENDING' && conn.user2Id === user?.id;

        return {
          id: `conn-${conn.id}`,
          type: isPending ? 'pending' : 'connection',
          name: otherUser?.name || 'Unknown',
          description: isPending
            ? `You've a new connection request from ${otherUser?.name || 'User'}`
            : `You matched with ${otherUser?.name || 'User'}`,
          time: formatTimeAgo(conn.createdAt),
          profilePicture: otherUser?.profilePicture,
          icon: 'heart',
          color: isPending ? '#FFA500' : '#ff4444',
          connectionId: conn.id,
          otherUserId: otherUser?.id,
          direction: isPending ? 'inbound' : 'both', // Connection can be either direction
          createdAt: conn.createdAt,
        };
      });

      const activityLogItems = (activityLogs || []).map((activity) => {
        const partnerId = activity.metadata?.partnerId;
        return {
          id: `activity-${activity.id}`,
          type: activity.type?.toLowerCase(),
          name: activity.title,
          description: activity.description || activity.title,
          time: formatTimeAgo(activity.createdAt),
          profilePicture: activity.metadata?.partnerProfilePicture || null,
          data: activity.metadata,
          partnerId,
          direction: 'both',
          createdAt: activity.createdAt,
        };
      });

      // Combine and sort by time
      let allActivities = [...activityLogItems, ...notificationActivities, ...connectionActivities];

      // Apply filter
      if (filter === 'pending') {
        allActivities = allActivities.filter((a) => a.type === 'pending');
      } else if (filter === 'connections') {
        allActivities = allActivities.filter((a) => a.type === 'connection');
      }

      // Sort by most recent first
      allActivities.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
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

  // Subscribe to match notifications
  useEffect(() => {
    const unsubscribe = subscribeToMatches((data) => {
      console.log('[ActivityScreen] Received match notification, reloading activity...');
      loadActivity(false);
    });

    return () => {
      unsubscribe();
    };
  }, [subscribeToMatches]);

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
    console.log('[ActivityScreen] Activity item pressed:', item.type, item.matchId);

    // Handle NEW_MATCH notifications - show popup modal
    if (item.type === 'match' && item.matchId) {
      console.log('[ActivityScreen] Showing match modal for match:', item.matchId);
      setSelectedMatch(item);
      setMatchModalVisible(true);
    } else if (item.type === 'pending') {
      navigation.navigate('RequestReview', {
        request: item,
        connectionId: item.connectionId,
        otherUserId: item.otherUserId,
      });
    }

    // Mark notification as read if it's unread (but keep it in the list)
    if (item.notificationId && !item.read) {
      console.log('[ActivityScreen] Marking notification as read:', item.notificationId);
      notificationAPI.markNotificationAsRead(item.notificationId).catch(console.error);
      // Update local state to mark as read without removing from list
      setActivities(prevActivities =>
        prevActivities.map(activity =>
          activity.id === item.id
            ? { ...activity, read: true }
            : activity
        )
      );
    }
  };

  const handleAcceptMatch = async () => {
    if (!selectedMatch || !selectedMatch.matchId) return;

    try {
      setProcessingMatch(true);
      console.log('[ActivityScreen] Accepting match:', selectedMatch.matchId);
      const result = await matchAPI.acceptMatch(selectedMatch.matchId);
      console.log('[ActivityScreen] Accept match result:', result);

      // Mark notification as read (but keep in activity list)
      if (selectedMatch.notificationId) {
        try {
          await notificationAPI.markNotificationAsRead(selectedMatch.notificationId);
          // Update local state to mark as read without removing from list
          setActivities(prevActivities =>
            prevActivities.map(activity =>
              activity.id === selectedMatch.id
                ? { ...activity, read: true }
                : activity
            )
          );
        } catch (notifError) {
          console.error('[ActivityScreen] Error marking notification as read:', notifError);
        }
      }

      // Save match data before clearing
      const matchData = selectedMatch;
      const partnerName = matchData.data?.partnerName || matchData.name || 'your match';

      setMatchModalVisible(false);
      setSelectedMatch(null);

      // Navigate directly to chat if session exists
      if (result?.session?.id) {
        const partnerId = result.user1Id === user?.id ? result.user2Id : result.user1Id;
        navigation.navigate('ChatConversation', {
          sessionId: result.session.id,
          chatId: result.session.id,
          chatName: partnerName,
          partnerId: partnerId,
          partnerName: partnerName,
        });
      } else if (result?.chatRoomId) {
        // If we have a chat room but no session, navigate to chat with room ID
        const partnerId = result.user1Id === user?.id ? result.user2Id : result.user1Id;
        navigation.navigate('ChatConversation', {
          roomId: result.chatRoomId,
          chatId: result.chatRoomId,
          chatName: partnerName,
          partnerId: partnerId,
          partnerName: partnerName,
        });
      } else {
        // If no session, navigate to Chats tab - the new chat should appear there
        console.log('[ActivityScreen] No session in response, navigating to Chats tab');
        navigation.navigate('Chats');
        // Show a quick success message
        Alert.alert(
          'Match Accepted!',
          `You are now connected with ${partnerName}! Check your chats.`
        );
      }

      // Refresh activities
      loadActivity(false);
    } catch (error) {
      console.error('[ActivityScreen] Error accepting match:', error);
      Alert.alert('Error', 'Failed to accept match. Please try again.');
    } finally {
      setProcessingMatch(false);
    }
  };

  const handleDeclineMatch = async () => {
    if (!selectedMatch || !selectedMatch.matchId) return;

    try {
      setProcessingMatch(true);
      console.log('[ActivityScreen] Declining match:', selectedMatch.matchId);
      await matchAPI.declineMatch(selectedMatch.matchId);

      setMatchModalVisible(false);
      setSelectedMatch(null);

      Alert.alert('Match Declined', 'The match has been declined.');

      // Refresh activities
      loadActivity(false);
    } catch (error) {
      console.error('[ActivityScreen] Error declining match:', error);
      Alert.alert('Error', 'Failed to decline match. Please try again.');
    } finally {
      setProcessingMatch(false);
    }
  };

  const handleFilterPress = () => {
    // Cycle through filters
    if (filter === 'all') setFilter('pending');
    else if (filter === 'pending') setFilter('connections');
    else setFilter('all');
  };

  const handleClearActivity = () => {
    console.log('[ActivityScreen] Clear activity button clicked');
    setClearModalVisible(true);
  };

  const handleConfirmClear = async () => {
    try {
      setClearingActivity(true);
      console.log('[ActivityScreen] Clear confirmed, starting...');
      
      // Delete all notifications and activity logs in parallel
      const results = await Promise.allSettled([
        notificationAPI.deleteAllNotifications(),
        activityAPI.clearActivities(),
      ]);
      
      // Log results
      results.forEach((result, index) => {
        const name = index === 0 ? 'notifications' : 'activities';
        if (result.status === 'fulfilled') {
          console.log(`[ActivityScreen] ${name} cleared successfully:`, result.value);
        } else {
          console.warn(`[ActivityScreen] Failed to clear ${name}:`, result.reason);
        }
      });

      // Clear all activities from local state
      setActivities([]);
      console.log('[ActivityScreen] All activities cleared from local state');

      setClearModalVisible(false);
    } catch (error) {
      console.error('[ActivityScreen] Error clearing activity:', error);

      // Provide more specific error messages
      let errorMessage = 'Failed to clear activity. Please try again.';
      const errorMsg = error?.message || '';

      if (errorMsg.includes('CONNECTION_REFUSED') || errorMsg.includes('Failed to fetch') || errorMsg.includes('Network error')) {
        errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
      } else if (errorMsg.includes('timeout') || errorMsg.includes('TIMEOUT')) {
        errorMessage = 'Request timed out. Please try again.';
      }

      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setClearingActivity(false);
    }
  };

  const handleCancelClear = () => {
    setClearModalVisible(false);
  };

  const renderActivityItem = ({ item }) => {
    // Make match notifications, pending items, and call requests clickable
    const ItemComponent = (item.type === 'pending' || item.type === 'match' || item.type === 'call_request') ? TouchableOpacity : View;

    // Determine direction indicator
    const isOutbound = item.direction === 'outbound';
    const isInbound = item.direction === 'inbound';

    // Get icon based on type and direction
    const getActivityIcon = () => {
      if (isOutbound) {
        if (item.type === 'outbound_call') return 'videocam';
        if (item.type === 'match_created') return 'heart';
        return 'arrow-forward';
      } else if (isInbound) {
        if (item.type === 'call_request') return 'videocam';
        if (item.type === 'call_accepted') return 'videocam';
        if (item.type === 'call_declined') return 'videocam-off';
        if (item.type === 'match') return 'heart';
        return 'arrow-back';
      }
      // Default fallback
      if (item.type === 'call_accepted') return 'videocam';
      if (item.type === 'call_declined') return 'videocam-off';
      if (item.type === 'call_started') return 'call';
      if (item.type === 'call_ended') return 'call';
      if (item.type === 'heart_requested') return 'heart';
      if (item.type === 'heart_accepted') return 'heart';
      if (item.type === 'heart_expired') return 'heart-dislike';
      if (item.type === 'video_requested') return 'videocam';
      if (item.type === 'video_accepted') return 'videocam';
      if (item.type === 'video_declined') return 'videocam-off';

      return 'heart';
    };

    // Get title based on type
    const getActivityTitle = () => {
      if (item.type === 'pending') return 'Pending Request';
      if (item.type === 'match') return 'New Match!';
      if (item.type === 'call_request') return 'Incoming Call';
      if (item.type === 'call_accepted') return 'Call Accepted';
      if (item.type === 'call_declined') return 'Call Declined';
      if (item.type === 'outbound_call') return 'Call Initiated';
      if (item.type === 'match_created') return 'Match Created';
      if (item.type === 'call_started') return 'Call Started';
      if (item.type === 'call_ended') return 'Call Ended';
      if (item.type === 'heart_requested') return 'Heart Requested';
      if (item.type === 'heart_accepted') return 'Heart Accepted';
      if (item.type === 'heart_expired') return 'Heart Expired';
      if (item.type === 'video_requested') return 'Video Requested';
      if (item.type === 'video_accepted') return 'Video Accepted';
      if (item.type === 'video_declined') return 'Video Declined';
      return 'New Connection';
    };

    return (
      <ItemComponent
        style={[styles.activityItem, !item.read && item.notificationId && styles.unreadItem]}
        onPress={(item.type === 'pending' || item.type === 'match' || item.type === 'call_request') ? () => handleActivityPress(item) : undefined}
      >
        <View style={styles.profileContainer}>
          {item.profilePicture ? (
            <Image source={{ uri: item.profilePicture }} style={styles.profilePicture} />
          ) : (
            <View style={[styles.profilePicture, styles.profilePlaceholder]}>
              <Ionicons name="person" size={24} color="#8E8E93" />
            </View>
          )}
          {isOutbound && (
            <View style={[styles.directionBadge, styles.outboundBadge]}>
              <Ionicons name="arrow-forward" size={12} color="#ffffff" />
            </View>
          )}
          {isInbound && (
            <View style={[styles.directionBadge, styles.inboundBadge]}>
              <Ionicons name="arrow-back" size={12} color="#ffffff" />
            </View>
          )}
        </View>
        <View style={styles.activityInfo}>
          <View style={styles.activityTitleRow}>
            <Ionicons
              name={getActivityIcon()}
              size={16}
              color={isOutbound ? '#007AFF' : (isInbound ? '#ff4444' : '#8E8E93')}
              style={styles.activityIcon}
            />
            <Text style={styles.activityTitle}>
              {getActivityTitle()}
            </Text>
          </View>
          <Text style={styles.activityDescription} numberOfLines={2}>
            {item.description}
          </Text>
          <Text style={styles.activityTime}>{item.time}</Text>
        </View>
        {(item.type === 'pending' || item.type === 'match' || item.type === 'call_request') && (
          <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
        )}
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
        <View style={styles.headerButtons}>
          {activities.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                console.log('[ActivityScreen] Trash button pressed');
                handleClearActivity();
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={20} color="#000000" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.filterButton} onPress={handleFilterPress}>
            <Ionicons name="filter" size={20} color="#000000" />
            {filter !== 'all' && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>
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

      {/* Match Notification Modal */}
      <Modal
        visible={matchModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!processingMatch) {
            setMatchModalVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.matchModalContent}>
            {/* Close button in top right */}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                if (!processingMatch) {
                  setMatchModalVisible(false);
                }
              }}
              disabled={processingMatch}
            >
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>

            {selectedMatch?.profilePicture ? (
              <Image
                source={{ uri: selectedMatch.profilePicture }}
                style={styles.matchModalProfilePicture}
              />
            ) : (
              <View style={[styles.matchModalProfilePicture, styles.profilePlaceholder]}>
                <Ionicons name="person" size={60} color="#8E8E93" />
              </View>
            )}

            <Ionicons name="heart" size={40} color="#ff4444" style={styles.matchModalHeart} />
            <View style={styles.matchModalTitleContainer}>
              <Ionicons name="star" size={24} color="#ff4444" style={styles.matchModalIcon} />
              <Text style={styles.matchModalTitle}>New Match!</Text>
            </View>
            <Text style={styles.matchModalMessage}>
              You have a new match with {selectedMatch?.data?.partnerName || 'someone'}!
            </Text>

            {selectedMatch?.data?.matchScore && (
              <View style={styles.matchScoreContainer}>
                <Text style={styles.matchScoreText}>
                  {Math.round(selectedMatch.data.matchScore * 100)}% Match
                </Text>
              </View>
            )}

            <View style={styles.matchModalButtons}>
              <TouchableOpacity
                style={[styles.matchModalButton, styles.declineButton]}
                onPress={handleDeclineMatch}
                disabled={processingMatch}
              >
                {processingMatch ? (
                  <ActivityIndicator size="small" color="#ff4444" />
                ) : (
                  <>
                    <Ionicons name="close" size={20} color="#ff4444" />
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.matchModalButton, styles.acceptButton]}
                onPress={handleAcceptMatch}
                disabled={processingMatch}
              >
                {processingMatch ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#ffffff" />
                    <Text style={styles.acceptButtonText}>Accept</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Clear Activity Confirmation Modal */}
      <Modal
        visible={clearModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelClear}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.clearModalContent}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={handleCancelClear}
            >
              <Ionicons name="close" size={20} color="#000000" />
            </TouchableOpacity>

            <View style={styles.clearModalIconContainer}>
              <Ionicons name="trash" size={48} color="#ff4444" />
            </View>

            <Text style={styles.clearModalTitle}>Clear Activity</Text>
            <Text style={styles.clearModalMessage}>
              Are you sure you want to clear all activity? This will mark all notifications as read and remove them from view.
            </Text>

            <View style={styles.clearModalButtons}>
              <TouchableOpacity
                style={[styles.clearModalButton, styles.cancelClearButton]}
                onPress={handleCancelClear}
                disabled={clearingActivity}
              >
                <Text style={styles.cancelClearButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.clearModalButton, styles.confirmClearButton]}
                onPress={handleConfirmClear}
                disabled={clearingActivity}
              >
                {clearingActivity ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmClearButtonText}>Clear</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  clearButton: {
    padding: 8,
    borderRadius: 8,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
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
  // Match Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  matchModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  matchModalProfilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 20,
  },
  matchModalHeart: {
    marginBottom: 10,
  },
  matchModalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    gap: 8,
  },
  matchModalIcon: {
    marginRight: 4,
  },
  matchModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  matchModalMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
  },
  matchScoreContainer: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  matchScoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff4444',
  },
  matchModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  matchModalButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 25,
    gap: 6,
  },
  declineButton: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#ff4444',
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff4444',
  },
  acceptButton: {
    backgroundColor: '#000000',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
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
    backgroundColor: '#F0F4FF',
    marginHorizontal: -20,
    paddingHorizontal: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  profileContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  profilePlaceholder: {
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  directionBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  outboundBadge: {
    backgroundColor: '#007AFF',
  },
  inboundBadge: {
    backgroundColor: '#ff4444',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  activityIcon: {
    marginRight: 6,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
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
  // Clear Modal Styles
  clearModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  clearModalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  clearModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  clearModalMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  clearModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  clearModalButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 25,
  },
  cancelClearButton: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#E5E5E7',
  },
  cancelClearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  confirmClearButton: {
    backgroundColor: '#ff4444',
  },
  confirmClearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
