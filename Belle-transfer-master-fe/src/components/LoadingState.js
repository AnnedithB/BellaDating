import React, { memo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

const LoadingState = memo(({ message = 'Loading...', size = 'large', color = '#000000' }) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
});

LoadingState.displayName = 'LoadingState';

export default LoadingState;
