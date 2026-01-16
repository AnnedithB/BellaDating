import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const UnreadBadge = ({ count }) => {
  if (count <= 0) return null;
  
  return (
    <View style={styles.unreadCount}>
      <Text style={styles.unreadCountText}>{count}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  unreadCount: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadCountText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default UnreadBadge;
