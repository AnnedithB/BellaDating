import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/colors';

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const RecordingIndicator = memo(({ recordingTime, onCancel, onConfirm }) => {
  return (
    <View style={styles.recordingContainer}>
      <View style={styles.recordingActions}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Ionicons name="close-circle" size={28} color="#ff6b6b" />
        </TouchableOpacity>

        <View style={styles.recordingIndicator}>
          <Ionicons name="mic" size={24} color="#fff" style={styles.micIcon} />
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>{formatTime(recordingTime)}</Text>
        </View>

        <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
          <Ionicons name="checkmark-circle" size={28} color="#51e3a5" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
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
  confirmButton: {
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
});

RecordingIndicator.displayName = 'RecordingIndicator';

export default RecordingIndicator;
