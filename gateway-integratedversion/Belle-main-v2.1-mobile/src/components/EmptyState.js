import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const EmptyState = memo(({ icon, title, subtitle, action, actionText }) => (
  <View style={styles.emptyState}>
    <Ionicons name={icon} size={80} color="#E5E5E7" />
    <Text style={styles.emptyStateText}>{title}</Text>
    <Text style={styles.emptyStateSubtext}>{subtitle}</Text>
    {action && actionText && (
      <TouchableOpacity style={styles.actionButton} onPress={action}>
        <Text style={styles.actionButtonText}>{actionText}</Text>
      </TouchableOpacity>
    )}
  </View>
));

const styles = StyleSheet.create({
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
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

EmptyState.displayName = 'EmptyState';

export default EmptyState;
