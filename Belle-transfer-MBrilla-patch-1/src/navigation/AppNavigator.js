import React, { useState, createContext, useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { AuthProvider, useAuth } from '../context/AuthContext';
import { SocketProvider } from '../context/SocketContext';

import LoginScreen from '../screens/LoginScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import TabNavigator from './TabNavigator';
import Subscription from '../screens/Subscription';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import EditProfile from '../screens/EditProfile';
import PreferenceScreen from '../screens/PreferenceScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import Help from '../screens/Help';
import ChatConversationScreen from '../screens/ChatConversationScreen';
import RequestReviewScreen from '../screens/RequestReviewScreen';

const Stack = createStackNavigator();

// Call context for managing in-call state
export const CallContext = createContext();

export const useCallContext = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCallContext must be used within a CallProvider');
  }
  return context;
};

// Loading screen while checking auth
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#000000" />
  </View>
);

// Main navigator with auth state
function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const [isInCall, setIsInCall] = useState(false);

  // While auth state is being checked, show loading
  if (isLoading) {
    return (
      <CallContext.Provider value={{ isInCall, setIsInCall }}>
        <LoadingScreen />
      </CallContext.Provider>
    );
  }

  return (
    <CallContext.Provider value={{ isInCall, setIsInCall }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="Subscription" component={Subscription} />
            <Stack.Screen name="SubscriptionScreen" component={SubscriptionScreen} />
            <Stack.Screen name="EditProfile" component={EditProfile} />
            <Stack.Screen name="PreferenceScreen" component={PreferenceScreen} />
            <Stack.Screen name="PrivacyScreen" component={PrivacyScreen} />
            <Stack.Screen name="NotificationsScreen" component={NotificationsScreen} />
            <Stack.Screen name="Help" component={Help} />
            <Stack.Screen
              name="ChatConversation"
              component={ChatConversationScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="RequestReview"
              component={RequestReviewScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </CallContext.Provider>
  );
}

// App navigator with auth provider
export default function AppNavigator() {
  return (
    <AuthProvider>
      <SocketProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SocketProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
