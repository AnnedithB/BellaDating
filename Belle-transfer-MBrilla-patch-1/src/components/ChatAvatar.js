import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ChatAvatar = ({ isOnline, size = 50 }) => (
  <View style={[styles.avatarContainer, { width: size, height: size }]}>
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name="person" size={size * 0.48} color="#8E8E93" />
    </View>
    {isOnline && <View style={styles.onlineIndicator} />}
  </View>
);

const styles = StyleSheet.create({
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});

export default ChatAvatar;
