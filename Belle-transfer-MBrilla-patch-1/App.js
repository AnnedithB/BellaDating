import React from 'react';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';

// Developed by https://github.com/emadnahed

export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <AppNavigator />
    </>
  );
}
