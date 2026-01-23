import React, { useState } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ChatAvatar from './ChatAvatar';
import UnreadBadge from './UnreadBadge';

const ChatItem = ({ item, onPress, onDelete }) => {
  const [showDeleteButton, setShowDeleteButton] = useState(false);

  const handleLongPress = () => {
    setShowDeleteButton(true);
  };

  const handleDelete = (e) => {
    console.log('[ChatItem] Delete button pressed');
    e?.stopPropagation?.();
    setShowDeleteButton(false);
    if (onDelete) {
      console.log('[ChatItem] Calling onDelete handler');
      onDelete();
    } else {
      console.warn('[ChatItem] onDelete handler not provided');
    }
  };

  const handlePress = () => {
    if (showDeleteButton) {
      setShowDeleteButton(false);
    } else {
      onPress?.(item);
    }
  };

  return (
    <TouchableOpacity 
      style={styles.matchItem} 
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
    >
      <ChatAvatar isOnline={item.isOnline} profilePicture={item.profilePicture} />
      <View style={styles.matchInfo}>
        <View style={styles.matchHeader}>
          <Text style={styles.matchName}>{item.name}</Text>
          <View style={styles.headerRight}>
            <Text style={styles.matchTime}>{item.time}</Text>
            {showDeleteButton && (
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={handleDelete}
                onPressIn={(e) => e.stopPropagation()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={styles.messageContainer}>
          <Text
            style={[
              styles.lastMessage,
              item.unread > 0 && styles.lastMessageUnread,
              item.isTyping && styles.typingMessage,
              item.callStatus && styles.callStatusMessage,
              !item.isTyping && !item.callStatus && item.statusText && styles.statusMessage,
            ]}
            numberOfLines={1}
          >
            {item.isTyping
              ? 'typing...'
              : item.callStatus === 'receiving_call'
              ? 'receiving a call'
              : item.callStatus === 'missed_call'
              ? 'missed a call'
              : item.statusText || item.lastMessage}
          </Text>
          <UnreadBadge count={item.unread} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  matchInfo: {
    flex: 1,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  matchName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  matchTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  messageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
  },
  lastMessageUnread: {
    color: '#000000',
    fontWeight: '500',
  },
  typingMessage: {
    color: '#6B7280',
    fontStyle: 'italic',
  },
  statusMessage: {
    color: '#6B7280',
  },
  callStatusMessage: {
    color: '#007AFF',
    fontStyle: 'italic',
  },
});

export default ChatItem;
