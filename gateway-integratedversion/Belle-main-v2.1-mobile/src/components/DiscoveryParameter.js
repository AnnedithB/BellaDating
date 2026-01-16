import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function DiscoveryParameter({ icon, label, value, detail }) {
  return (
    <View style={styles.parameterSection}>
      <View style={styles.parameterHeader}>
        <Ionicons name={icon} size={16} color="#000000" />
        <Text style={styles.parameterLabel}>{label}</Text>
      </View>
      <Text style={styles.parameterValue}>{value}</Text>
      {detail && <Text style={styles.parameterDetail}>{detail}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  parameterSection: {
    marginBottom: 24,
  },
  parameterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  parameterLabel: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  parameterValue: {
    fontSize: 18,
    color: '#000000',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  parameterDetail: {
    fontSize: 14,
    color: '#666666',
  },
});

