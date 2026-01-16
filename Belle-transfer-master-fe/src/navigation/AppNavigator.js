import React, { useState, createContext, useContext, useEffect, useRef } from 'react';
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
import SubscriptionSuccessScreen from '../screens/SubscriptionSuccessScreen';
import EditProfile from '../screens/EditProfile';
import PreferenceScreen from '../screens/PreferenceScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import Help from '../screens/Help';
import ChatConversationScreen from '../screens/ChatConversationScreen';
import RequestReviewScreen from '../screens/RequestReviewScreen';
import PhotoVerificationScreen from '../screens/PhotoVerificationScreen';
import MatchProposalsScreen from '../screens/MatchProposalsScreen';
import GlobalCallNotification from '../components/GlobalCallNotification';

const Stack = createStackNavigator();

// Toggle to bypass login during development. Set to `false` to restore normal auth flow.
const FORCE_BYPASS_LOGIN = true;

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
function RootNavigator({ navigationRef }) {
  const auth = useAuth();
  // If user is explicitly null (logout), always show login screen even with FORCE_BYPASS_LOGIN
  const isAuthenticated = FORCE_BYPASS_LOGIN && auth.user !== null ? true : auth.isAuthenticated;
  const isLoading = FORCE_BYPASS_LOGIN && auth.user !== null ? false : auth.isLoading;
  const [isInCall, setIsInCall] = useState(false);

  // Navigate to EditProfile if user just registered
  useEffect(() => {
    if (isAuthenticated && auth.justRegistered && navigationRef?.current) {
      // Small delay to ensure navigation is ready
      setTimeout(() => {
        navigationRef.current?.reset({
          index: 0,
          routes: [{ name: 'EditProfile' }],
        });
        auth.clearJustRegistered();
      }, 100);
    }
  }, [isAuthenticated, auth.justRegistered, navigationRef, auth]);

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
      <Stack.Navigator 
        screenOptions={{ headerShown: false }}
        initialRouteName={isAuthenticated ? (auth.justRegistered ? 'EditProfile' : 'Main') : 'Login'}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="Subscription" component={Subscription} />
            <Stack.Screen name="SubscriptionScreen" component={SubscriptionScreen} />
            <Stack.Screen 
              name="SubscriptionSuccess" 
              component={SubscriptionSuccessScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="EditProfile" component={EditProfile} />
            <Stack.Screen name="PhotoVerification" component={PhotoVerificationScreen} />
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
            <Stack.Screen
              name="MatchProposals"
              component={MatchProposalsScreen}
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
  const navigationRef = React.useRef(null);
  
  // Handle deep links for subscription success (web)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleUrlChange = () => {
        const url = window.location.href;
        
        // Check if URL contains subscription-success or if we have session_id in localStorage
        const hasSessionIdInStorage = typeof window !== 'undefined' && localStorage.getItem('stripe_checkout_session_id');
        const urlMatches = url.includes('subscription-success') || url.includes('session_id=');
          
        if (urlMatches || hasSessionIdInStorage) {
          // Try multiple methods to extract session_id
          // Priority: URL methods first (most recent/accurate), then localStorage as fallback
          let sessionId = null;
          
          // Method 1: URLSearchParams from search (highest priority - from URL)
          try {
            const searchParams = new URLSearchParams(window.location.search);
            sessionId = searchParams.get('session_id');
          } catch (e) {
            // Ignore
          }
          
          // Method 2: Regex from full URL
          if (!sessionId) {
            try {
              const match = url.match(/[?&]session_id=([^&?#]+)/);
              sessionId = match ? decodeURIComponent(match[1]) : null;
            } catch (e) {
              // Ignore
            }
          }
          
          // Method 3: URLSearchParams from hash
          if (!sessionId && window.location.hash) {
            try {
              const hashParams = new URLSearchParams(window.location.hash.substring(1));
              sessionId = hashParams.get('session_id');
            } catch (e) {
              // Ignore
            }
          }
          
          // Method 4: Direct string extraction
          if (!sessionId) {
            try {
              const idx = url.indexOf('session_id=');
              if (idx !== -1) {
                const start = idx + 'session_id='.length;
                const end = url.indexOf('&', start);
                const end2 = url.indexOf('#', start);
                const finalEnd = end !== -1 && end2 !== -1 
                  ? Math.min(end, end2) 
                  : (end !== -1 ? end : (end2 !== -1 ? end2 : url.length));
                sessionId = decodeURIComponent(url.substring(start, finalEnd));
              }
            } catch (e) {
              // Ignore
            }
          }
          
          // Method 5: Check localStorage as fallback (if URL methods didn't find it)
          if (!sessionId && typeof window !== 'undefined') {
            try {
              sessionId = localStorage.getItem('stripe_checkout_session_id');
              // Don't remove it yet - let SubscriptionSuccessScreen handle that
            } catch (e) {
              // Ignore
            }
          }
          
          if (sessionId && navigationRef.current) {
            // Check if verification is already complete to prevent repeated navigation
            if (typeof window !== 'undefined') {
              const verificationComplete = localStorage.getItem('subscription_verification_complete');
              if (verificationComplete === 'true') {
                // Clear the session_id from localStorage to prevent future checks
                try {
                  localStorage.removeItem('stripe_checkout_session_id');
                } catch (e) {
                  // Ignore
                }
                return;
              }
            }
            
            console.log('[Subscription] Navigating to success screen');
            // Navigate to SubscriptionSuccess screen
            navigationRef.current.navigate('SubscriptionSuccess', { session_id: sessionId });
            // Clean up URL if it had subscription-success
            if (typeof window !== 'undefined' && urlMatches) {
              window.history.replaceState({}, '', window.location.pathname);
            }
          }
        }
      };
      
      // Check on mount
      handleUrlChange();
      
      // Listen for hash changes (React Navigation web uses hash)
      window.addEventListener('hashchange', handleUrlChange);
      
      // Also check periodically
      const interval = setInterval(() => {
        handleUrlChange();
      }, 1000);
      
      return () => {
        window.removeEventListener('hashchange', handleUrlChange);
        clearInterval(interval);
      };
    }
  }, []);
  
  return (
    <AuthProvider>
      <SocketProvider>
        <NavigationContainer ref={navigationRef}>
          <GlobalCallNotification />
          <RootNavigator navigationRef={navigationRef} />
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
