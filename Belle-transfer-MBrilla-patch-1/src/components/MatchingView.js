import React from 'react';
import { StyleSheet, Text, View, ActivityIndicator, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MatchingView({ onFilterPress, onCancel, queuePosition, estimatedWait }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AppCita</Text>
        <TouchableOpacity style={styles.filterButton} onPress={onFilterPress}>
          <Ionicons name="filter" size={20} color="#000000" />
        </TouchableOpacity>
      </View>

      <View style={styles.matchingContainer}>
        <ActivityIndicator size="large" color="#000000" style={styles.loadingSpinner} />
        <Text style={styles.matchingTitle}>Finding Your Match</Text>
        <Text style={styles.matchingSubtitle}>Searching for people nearby...</Text>

        {queuePosition && (
          <Text style={styles.queueInfo}>Queue position: {queuePosition}</Text>
        )}
        {estimatedWait && (
          <Text style={styles.queueInfo}>Estimated wait: {estimatedWait}s</Text>
        )}

        {onCancel && (
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  filterButton: {
    padding: 8,
  },
  matchingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingSpinner: {
    marginBottom: 30,
  },
  matchingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  matchingSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  queueInfo: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  cancelButton: {
    marginTop: 30,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#000000',
  },
  cancelText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '600',
  },
});

