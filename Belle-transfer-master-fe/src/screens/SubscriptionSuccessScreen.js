import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, SafeAreaView, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getSubscriptionStatus } from '../services/iap';
import { useAuth } from '../context/AuthContext';
import { config } from '../services/config';
import { tokenStorage } from '../services/api';

export default function SubscriptionSuccessScreen({ route }) {
  console.log('[SubscriptionSuccess] ========== SUBSCRIPTION SUCCESS SCREEN MOUNTED ==========');
  console.log('[SubscriptionSuccess] Route params:', route?.params);
  console.log('[SubscriptionSuccess] Full route object:', route);
  
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { checkAuthState } = useAuth();
  const [status, setStatus] = useState('checking'); // 'checking', 'success', 'processing', 'error'
  const [message, setMessage] = useState('Verifying your payment...');
  const hasStartedVerification = useRef(false); // Track if verification has started
  const hasSucceeded = useRef(false); // Track if we've already succeeded

  useEffect(() => {
    // Check localStorage to see if we've already verified (persists across remounts)
    if (typeof window !== 'undefined') {
      const alreadyVerified = localStorage.getItem('subscription_verification_complete');
      if (alreadyVerified === 'true') {
        console.log('[SubscriptionSuccess] ⚠️ Verification already completed (from localStorage), skipping...');
        setStatus('success');
        setMessage('Your subscription is now active! Enjoy Premium!');
        return;
      }
    }
    
    // Prevent multiple runs
    if (hasStartedVerification.current) {
      console.log('[SubscriptionSuccess] ⚠️ Verification already started, skipping...');
      return;
    }
    
    // Don't run if we're already in success or processing state
    if (status === 'success' || status === 'processing') {
      console.log('[SubscriptionSuccess] ⚠️ Already in', status, 'state, skipping verification...');
      return;
    }
    
    // Mark as started
    hasStartedVerification.current = true;
    console.log('[SubscriptionSuccess] ✅ Starting verification (first time)...');
    console.log('[SubscriptionSuccess] ========== USE EFFECT RUNNING ==========');
    console.log('[SubscriptionSuccess] Platform.OS:', Platform.OS);
    console.log('[SubscriptionSuccess] typeof window:', typeof window);
    console.log('[SubscriptionSuccess] route?.params:', route?.params);
    console.log('[SubscriptionSuccess] route?.params?.session_id:', route?.params?.session_id);
    
    // Get session_id from multiple sources (priority order):
    // 1. Route params (if navigated with params)
    // 2. localStorage (stored when checkout session was created)
    // 3. URL (query params or hash)
    let sessionId = route?.params?.session_id;
    console.log('[SubscriptionSuccess] Initial sessionId from route params:', sessionId);
    
    // Check localStorage if not in route params
    if (!sessionId && typeof window !== 'undefined') {
      try {
        sessionId = localStorage.getItem('stripe_checkout_session_id');
        console.log('[SubscriptionSuccess] SessionId from localStorage:', sessionId);
        if (sessionId) {
          // Clear it from localStorage after retrieving
          localStorage.removeItem('stripe_checkout_session_id');
          console.log('[SubscriptionSuccess] ✅ Retrieved and cleared session_id from localStorage');
        }
      } catch (e) {
        console.log('[SubscriptionSuccess] Failed to read from localStorage:', e.message);
      }
    }
    
    if (!sessionId && Platform.OS === 'web' && typeof window !== 'undefined') {
      console.log('[SubscriptionSuccess] SessionId not in route params, trying URL extraction...');
      console.log('[SubscriptionSuccess] window.location.href:', window.location.href);
      console.log('[SubscriptionSuccess] window.location.search:', window.location.search);
      console.log('[SubscriptionSuccess] window.location.hash:', window.location.hash);
      
      // Method 1: Try URLSearchParams from search
      try {
        const searchParams = new URLSearchParams(window.location.search);
        sessionId = searchParams.get('session_id');
        console.log('[SubscriptionSuccess] Method 1 (URLSearchParams from search):', sessionId);
      } catch (e) {
        console.log('[SubscriptionSuccess] Method 1 failed:', e.message);
      }
      
      // Method 2: Try regex from full URL
      if (!sessionId) {
        try {
          const match = window.location.href.match(/[?&]session_id=([^&?#]+)/);
          sessionId = match ? decodeURIComponent(match[1]) : null;
          console.log('[SubscriptionSuccess] Method 2 (Regex from URL):', sessionId);
        } catch (e) {
          console.log('[SubscriptionSuccess] Method 2 failed:', e.message);
        }
      }
      
      // Method 3: Try URLSearchParams from hash
      if (!sessionId && window.location.hash) {
        try {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          sessionId = hashParams.get('session_id');
          console.log('[SubscriptionSuccess] Method 3 (URLSearchParams from hash):', sessionId);
        } catch (e) {
          console.log('[SubscriptionSuccess] Method 3 failed:', e.message);
        }
      }
      
      // Method 4: Direct string extraction
      if (!sessionId) {
        try {
          const url = window.location.href;
          const idx = url.indexOf('session_id=');
          if (idx !== -1) {
            const start = idx + 'session_id='.length;
            const end = url.indexOf('&', start);
            const end2 = url.indexOf('#', start);
            const finalEnd = end !== -1 && end2 !== -1 
              ? Math.min(end, end2) 
              : (end !== -1 ? end : (end2 !== -1 ? end2 : url.length));
            sessionId = decodeURIComponent(url.substring(start, finalEnd));
            console.log('[SubscriptionSuccess] Method 4 (Direct string extraction):', sessionId);
          }
        } catch (e) {
          console.log('[SubscriptionSuccess] Method 4 failed:', e.message);
        }
      }
    }

    console.log('[SubscriptionSuccess] Final extracted sessionId:', sessionId);

    if (sessionId) {
      console.log('[SubscriptionSuccess] ✅ Found session ID:', sessionId);
      // First verify the session with backend, then poll
      verifySessionAndPoll(sessionId);
    } else {
      console.log('[SubscriptionSuccess] ⚠️ No session ID found - user may have navigated back without completing payment');
      // If no session_id found, user likely navigated back without completing payment
      // Clear any stale data and set status to allow them to go back immediately
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('stripe_checkout_session_id');
          localStorage.removeItem('subscription_verification_complete');
        } catch (e) {
          // Ignore
        }
      }
      setStatus('error');
      setMessage('No payment session found. If you completed a payment, please wait a moment and try again.');
      // Don't start polling - allow user to go back
      return;
    }
    
    // Cleanup function to clear refs and localStorage when component unmounts
    return () => {
      console.log('[SubscriptionSuccess] ========== SCREEN UNMOUNTED, CLEANING UP ==========');
      hasStartedVerification.current = false;
      // Only clear localStorage if verification wasn't successful
      if (!hasSucceeded.current && typeof window !== 'undefined') {
        try {
          localStorage.removeItem('stripe_checkout_session_id');
          localStorage.removeItem('subscription_verification_complete');
          console.log('[SubscriptionSuccess] Cleared session_id and verification status from localStorage on unmount.');
        } catch (e) {
          console.warn('[SubscriptionSuccess] Failed to clear localStorage on unmount:', e);
        }
      }
      hasSucceeded.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const verifySessionAndPoll = async (sessionId) => {
    // Prevent re-running if already successful
    if (hasSucceeded.current) {
      console.log('[SubscriptionSuccess] ⚠️ Already successful, skipping verification...');
      return;
    }
    
    console.log('[SubscriptionSuccess] ========== VERIFY SESSION AND POLL START ==========');
    console.log('[SubscriptionSuccess] Session ID:', sessionId);
    console.log('[SubscriptionSuccess] Subscription Service URL:', config.SUBSCRIPTION_SERVICE_URL);
    
    try {
      const token = await tokenStorage.getToken();
      console.log('[SubscriptionSuccess] Token exists:', !!token);
      console.log('[SubscriptionSuccess] Token length:', token?.length || 0);
      
      // Verify session with backend - this will create subscription if webhook hasn't fired
      const url = `${config.SUBSCRIPTION_SERVICE_URL}/api/subscriptions/checkout-success?session_id=${sessionId}`;
      console.log('[SubscriptionSuccess] Calling URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      
      console.log('[SubscriptionSuccess] Response status:', response.status);
      console.log('[SubscriptionSuccess] Response ok:', response.ok);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[SubscriptionSuccess] ========== SESSION VERIFICATION RESPONSE ==========');
        console.log('[SubscriptionSuccess] Full response data:', JSON.stringify(data, null, 2));
        console.log('[SubscriptionSuccess] data.data:', data.data);
        console.log('[SubscriptionSuccess] data.data?.subscription:', data.data?.subscription);
        console.log('[SubscriptionSuccess] data.data?.subscription?.status:', data.data?.subscription?.status);
        
        if (data.data?.subscription?.status === 'ACTIVE') {
          // Prevent duplicate success handling
          if (hasSucceeded.current) {
            console.log('[SubscriptionSuccess] ⚠️ Already handled success, skipping...');
            return;
          }
          hasSucceeded.current = true;
          
          // Mark as verified in localStorage to prevent re-verification on remount
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('subscription_verification_complete', 'true');
              console.log('[SubscriptionSuccess] ✅ Marked verification as complete in localStorage');
            } catch (e) {
              console.warn('[SubscriptionSuccess] Failed to save verification status to localStorage:', e);
            }
          }
          
          console.log('[SubscriptionSuccess] ✅✅✅ SUBSCRIPTION FOUND VIA VERIFICATION! ✅✅✅');
          console.log('[SubscriptionSuccess] Subscription details:', JSON.stringify(data.data.subscription, null, 2));
          setStatus('success');
          setMessage('Your subscription is now active! Enjoy Premium!');
          
          // Refresh auth state to update user data
          console.log('[SubscriptionSuccess] Calling checkAuthState()...');
          if (checkAuthState) {
            console.log('[SubscriptionSuccess] checkAuthState function exists, calling it...');
            const authResult = await checkAuthState();
            console.log('[SubscriptionSuccess] checkAuthState() completed. Result:', authResult);
          } else {
            console.log('[SubscriptionSuccess] ⚠️ checkAuthState function is NOT available!');
          }
          
          // Force a navigation event to trigger premium status refresh in other screens
          console.log('[SubscriptionSuccess] Setting up navigation to DiscoveryScreen with refreshPremium param...');
          setTimeout(() => {
            console.log('[SubscriptionSuccess] Executing navigation...');
            if (navigation.canGoBack()) {
              console.log('[SubscriptionSuccess] Can go back, going back first...');
              navigation.goBack();
              // Small delay to ensure navigation completes, then trigger a refresh
              setTimeout(() => {
                console.log('[SubscriptionSuccess] Navigating to Main -> Discovery with refreshPremium: true');
                navigation.navigate('Main', { 
                  screen: 'Discovery',
                  params: { refreshPremium: true } 
                });
                console.log('[SubscriptionSuccess] Navigation command sent');
              }, 500);
            } else {
              console.log('[SubscriptionSuccess] Cannot go back, navigating directly to Main -> Discovery');
              navigation.navigate('Main', { 
                screen: 'Discovery',
                params: { refreshPremium: true } 
              });
              console.log('[SubscriptionSuccess] Navigation command sent');
            }
          }, 2000);
          return;
        } else {
          console.log('[SubscriptionSuccess] ⚠️ Subscription status is NOT ACTIVE:', data.data?.subscription?.status);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.log('[SubscriptionSuccess] ❌ Verification failed!');
        console.log('[SubscriptionSuccess] Status:', response.status);
        console.log('[SubscriptionSuccess] Error data:', JSON.stringify(errorData, null, 2));
      }
    } catch (e) {
      console.log('[SubscriptionSuccess] ❌❌❌ Session verification ERROR! ❌❌❌');
      console.log('[SubscriptionSuccess] Error message:', e.message);
      console.log('[SubscriptionSuccess] Error stack:', e.stack);
      console.log('[SubscriptionSuccess] Full error:', e);
    }
    
    // If verification didn't find it, check subscription status once
    console.log('[SubscriptionSuccess] ========== CHECKING SUBSCRIPTION STATUS ==========');
    checkSubscriptionStatus();
  };

  const checkSubscriptionStatus = async () => {
    // Prevent re-running if already successful
    if (hasSucceeded.current) {
      console.log('[SubscriptionSuccess] ⚠️ Already successful, skipping check...');
      return;
    }
    
    console.log('[SubscriptionSuccess] ========== CHECKING SUBSCRIPTION STATUS (SINGLE CHECK) ==========');
    
    try {
      console.log('[SubscriptionSuccess] Calling getSubscriptionStatus()...');
      const subscriptionStatus = await getSubscriptionStatus();
      console.log('[SubscriptionSuccess] ========== SUBSCRIPTION STATUS RESPONSE ==========');
      console.log('[SubscriptionSuccess] Full response:', JSON.stringify(subscriptionStatus, null, 2));
      console.log('[SubscriptionSuccess] subscriptionStatus?.subscription?.status:', subscriptionStatus?.subscription?.status);
      
      if (subscriptionStatus?.subscription?.status === 'ACTIVE') {
        // Prevent duplicate success handling
        if (hasSucceeded.current) {
          console.log('[SubscriptionSuccess] ⚠️ Already handled success, skipping...');
          return;
        }
        hasSucceeded.current = true;
        
        // Mark as verified in localStorage to prevent re-verification on remount
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('subscription_verification_complete', 'true');
            console.log('[SubscriptionSuccess] ✅ Marked verification as complete in localStorage');
          } catch (e) {
            console.warn('[SubscriptionSuccess] Failed to save verification status to localStorage:', e);
          }
        }
        
        console.log('[SubscriptionSuccess] ✅✅✅ ACTIVE SUBSCRIPTION FOUND! ✅✅✅');
        console.log('[SubscriptionSuccess] Subscription details:', JSON.stringify(subscriptionStatus.subscription, null, 2));
        setStatus('success');
        setMessage('Your subscription is now active! Enjoy Premium!');
        
        // Refresh auth state to update user data
        console.log('[SubscriptionSuccess] Calling checkAuthState()...');
        if (checkAuthState) {
          console.log('[SubscriptionSuccess] checkAuthState function exists, calling it...');
          const authResult = await checkAuthState();
          console.log('[SubscriptionSuccess] checkAuthState() completed. Result:', authResult);
        } else {
          console.log('[SubscriptionSuccess] ⚠️ checkAuthState function is NOT available!');
        }
        
        // Force a navigation event to trigger premium status refresh in other screens
        console.log('[SubscriptionSuccess] Setting up navigation to DiscoveryScreen with refreshPremium param...');
        setTimeout(() => {
          console.log('[SubscriptionSuccess] Executing navigation...');
          if (navigation.canGoBack()) {
            console.log('[SubscriptionSuccess] Can go back, going back first...');
            navigation.goBack();
            // Small delay to ensure navigation completes, then trigger a refresh
            setTimeout(() => {
              console.log('[SubscriptionSuccess] Navigating to Main -> Discovery with refreshPremium: true');
              navigation.navigate('Main', { 
                screen: 'Discovery',
                params: { refreshPremium: true } 
              });
              console.log('[SubscriptionSuccess] Navigation command sent');
            }, 500);
          } else {
            console.log('[SubscriptionSuccess] Cannot go back, navigating directly to Main -> Discovery');
            navigation.navigate('Main', { 
              screen: 'Discovery',
              params: { refreshPremium: true } 
            });
            console.log('[SubscriptionSuccess] Navigation command sent');
          }
        }, 2000);
        return;
      } else {
        console.log('[SubscriptionSuccess] ⚠️ Subscription status is NOT ACTIVE:', subscriptionStatus?.subscription?.status);
        // Payment might still be processing - show processing state
        setStatus('processing');
        setMessage('Your payment is being processed. Please check back in a few moments.');
      }
    } catch (e) {
      console.log('[SubscriptionSuccess] ❌ Subscription status check ERROR!');
      console.log('[SubscriptionSuccess] Error message:', e.message);
      // If rate limited or other error, show processing state
      setStatus('processing');
      setMessage('Your payment is being processed. Please check back in a few moments.');
    }
  };

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        {status === 'checking' && (
          <>
            <ActivityIndicator size="large" color="#000000" />
            <Text style={styles.title}>Verifying Payment</Text>
            <Text style={styles.message}>{message}</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <Ionicons name="checkmark-circle" size={80} color="#10B981" />
            <Text style={styles.title}>Payment Successful!</Text>
            <Text style={styles.message}>{message}</Text>
            <TouchableOpacity style={styles.button} onPress={handleGoBack}>
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'processing' && (
          <>
            <Ionicons name="time-outline" size={80} color="#F59E0B" />
            <Text style={styles.title}>Payment Processing</Text>
            <Text style={styles.message}>{message}</Text>
            <TouchableOpacity style={styles.button} onPress={handleGoBack}>
              <Text style={styles.buttonText}>Go Back</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'error' && (
          <>
            <Ionicons name="alert-circle" size={80} color="#EF4444" />
            <Text style={styles.title}>Error</Text>
            <Text style={styles.message}>{message}</Text>
            <TouchableOpacity style={styles.button} onPress={handleGoBack}>
              <Text style={styles.buttonText}>Go Back</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#000000',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
