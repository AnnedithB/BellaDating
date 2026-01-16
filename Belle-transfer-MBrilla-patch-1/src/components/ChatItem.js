import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import ChatAvatar from './ChatAvatar';
import UnreadBadge from './UnreadBadge';

const ChatItem = ({ item, onPress }) => (
  <TouchableOpacity style={styles.matchItem} onPress={() => onPress?.(item)}>
    <ChatAvatar isOnline={item.isOnline} />
    <View style={styles.matchInfo}>
      <View style={styles.matchHeader}>
        <Text style={styles.matchName}>{item.name}</Text>
        <Text style={styles.matchTime}>{item.time}</Text>
      </View>
      <View style={styles.messageContainer}>
        <Text style={[
          styles.lastMessage,
          item.unread > 0 && styles.lastMessageUnread
        ]} numberOfLines={1}>
          {item.lastMessage}
        </Text>
        <UnreadBadge count={item.unread} />
      </View>
    </View>
  </TouchableOpacity>
);

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
});

export default ChatItem;
