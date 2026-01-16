import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from 'expo-web-browser';
import DynamicIcon from '../components/DynamicIcon';
import colors from "../styles/colors";
import { config } from '../services/config';
import { tokenStorage } from '../services/api';
import {
  initIAP,
  getProducts,
  purchaseSubscription,
  restorePurchases,
  isIAPAvailable,
  getProductsFromBackend,
  getSubscriptionStatus,
} from '../services/iap';

// Premium features are displayed as a simple bullet list below.

const PlanOption = React.memo(({
  duration,
  price,
  perMonth,
  isPopular,
  savePercent,
  isSelected,
  onPress,
  disabled,
  priceAmount,
}) => {
  // Calculate Direct Price - specific values for web pricing
  let directPrice = null;
  if (priceAmount) {
    // Set specific web prices: monthly = 19.99, 6 months = 99.99
    // Check for 6 months first to avoid matching "1 Month"
    if (priceAmount === 139.99 || duration === "6 Months" || duration?.includes("Months") || duration?.includes("Year")) {
      directPrice = "99.99";
    } else if (priceAmount === 29.99 || duration === "1 Month") {
      directPrice = "19.99";
    } else {
      // Fallback: use 10% off for other prices
      directPrice = (priceAmount * 0.9).toFixed(2);
    }
  }

  return (
    <TouchableOpacity
      style={[styles.planBox, isSelected && styles.selectedPlan, disabled && styles.disabledPlan]}
      onPress={onPress}
      disabled={disabled}
    >
      {isPopular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>POPULAR</Text>
        </View>
      )}
      <Ionicons
        name={isSelected ? "radio-button-on" : "radio-button-off-outline"}
        size={24}
        color={isSelected ? "black" : "#A0A0A0"}
        style={styles.radioIcon}
      />
      <Text style={styles.planDuration}>{duration}</Text>
      <Text style={styles.planPrice}>{price}</Text>

      {/** Direct/Web Pricing Display */}
      {directPrice && (
        <View style={styles.directPriceContainer}>
          <Text style={styles.directPriceLabel}>${directPrice}</Text>
          <Text style={styles.directPriceValue}>via Web</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// Fallback plans when IAP is not available (demo mode)
const fallbackPlans = [
  {
    id: "com.belle.premium.monthly",
    duration: "1 Month",
    price: "$29.99",
    productId: "com.belle.premium.monthly",
    priceAmount: 29.99,
  },
  {
    id: "com.belle.premium.yearly",
    duration: "6 Months",
    price: "$139.99",
    isPopular: true,
    savePercent: "44%",
    productId: "com.belle.premium.yearly",
    priceAmount: 139.99,
  },
];

const PREMIUM_FEATURES = [
  { iconName: "options", title: "Interests & Languages", subtitle: "Match by shared interests and languages" },
  { iconName: "school", title: "Education", subtitle: "Filter by education level" },
  { iconName: "people", title: "Family Plans", subtitle: "Find people who want (or don't want) kids" },
  { iconName: "baby", title: "Has Kids", subtitle: "Filter by whether someone has children" },
  { iconName: "heart", title: "Religion", subtitle: "Match based on religious preference" },
  { iconName: "megaphone", title: "Political Views", subtitle: "Filter by political leaning" },
  { iconName: "wine", title: "Drink & Smoke", subtitle: "Filter by drinking or smoking habits" },
];

export default function Subscription({ navigation }) {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [iapAvailable, setIapAvailable] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState(null);

  // Initialize IAP and load products
  useEffect(() => {
    loadProducts();
    
    // Check if we're returning from a successful payment (web)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const checkSuccessUrl = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        if (sessionId) {
          console.log('[Subscription] Detected success URL with session_id:', sessionId);
          // Clear the URL parameter
          window.history.replaceState({}, '', '/subscription-success');
          // Poll for subscription status
          pollSubscriptionStatus(20, 1500); // More attempts for web
        }
      };
      
      // Check immediately
      checkSuccessUrl();
      
      // Also listen for popstate events (back/forward navigation)
      const handlePopState = () => {
        setTimeout(checkSuccessUrl, 100);
      };
      window.addEventListener('popstate', handlePopState);
      
      // Check periodically in case URL changed while component was mounted
      const interval = setInterval(() => {
        if (window.location.pathname.includes('subscription-success') || window.location.search.includes('session_id')) {
          checkSuccessUrl();
          clearInterval(interval);
        }
      }, 500);
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
        clearInterval(interval);
      };
    }
  }, []);

  // Poll for subscription status after payment
  const pollSubscriptionStatus = async (maxAttempts = 20, delay = 1500) => {
    console.log('[Subscription] ========== POLL SUBSCRIPTION STATUS START ==========');
    console.log('[Subscription] Max attempts:', maxAttempts);
    console.log('[Subscription] Delay between attempts:', delay);
    setPurchasing(true); // Show loading state
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        console.log(`[Subscription] ========== POLLING ATTEMPT ${i + 1}/${maxAttempts} ==========`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.log('[Subscription] Calling getSubscriptionStatus()...');
        const status = await getSubscriptionStatus();
        console.log('[Subscription] ========== SUBSCRIPTION STATUS RESPONSE ==========');
        console.log('[Subscription] Full status response:', JSON.stringify(status, null, 2));
        console.log('[Subscription] status:', status);
        console.log('[Subscription] status?.subscription:', status?.subscription);
        console.log('[Subscription] status?.subscription?.status:', status?.subscription?.status);
        
        if (status?.subscription?.status === 'ACTIVE') {
          console.log('[Subscription] ✅✅✅ ACTIVE SUBSCRIPTION FOUND! ✅✅✅');
          console.log('[Subscription] Subscription details:', JSON.stringify(status.subscription, null, 2));
          setCurrentSubscription(status.subscription);
          setPurchasing(false);
          
          // Reload products to update UI
          console.log('[Subscription] Reloading products...');
          await loadProducts();
          console.log('[Subscription] Products reloaded');
          
          Alert.alert(
            'Payment Successful!',
            'Your subscription is now active. Enjoy Premium!',
            [
              {
                text: 'OK',
                onPress: () => {
                  console.log('[Subscription] User clicked OK, navigating...');
                  // Navigate back to discovery screen to refresh filters and premium status
                  if (navigation.canGoBack()) {
                    console.log('[Subscription] Can go back, going back first...');
                    navigation.goBack();
                    // Trigger refresh in DiscoveryScreen
                    setTimeout(() => {
                      console.log('[Subscription] Navigating to Main -> Discovery with refreshPremium: true');
                      navigation.navigate('Main', { 
                        screen: 'Discovery',
                        params: { refreshPremium: true } 
                      });
                      console.log('[Subscription] Navigation command sent');
                    }, 500);
                  } else {
                    console.log('[Subscription] Cannot go back, navigating directly...');
                    navigation.navigate('Main', { 
                      screen: 'Discovery',
                      params: { refreshPremium: true } 
                    });
                    console.log('[Subscription] Navigation command sent');
                  }
                },
              },
            ]
          );
          return true; // Success
        } else {
          console.log('[Subscription] ⚠️ Subscription status is NOT ACTIVE:', status?.subscription?.status);
        }
      } catch (e) {
        console.log(`[Subscription] ❌ Polling attempt ${i + 1} ERROR!`);
        console.log('[Subscription] Error message:', e.message);
        console.log('[Subscription] Error stack:', e.stack);
        console.log('[Subscription] Full error:', e);
      }
    }
    
    setPurchasing(false);
    console.log('[Subscription] ========== POLLING COMPLETED - NO ACTIVE SUBSCRIPTION FOUND ==========');
    console.log('[Subscription] ❌ Polling completed but no active subscription found after', maxAttempts, 'attempts');
    
    // If we get here, payment might still be processing
    Alert.alert(
      'Payment Processing',
      'Your payment is being processed. The subscription should be active shortly. Please refresh the page or check back in a few moments.',
      [
        { 
          text: 'Refresh Now',
          onPress: async () => {
            console.log('[Subscription] User clicked Refresh Now...');
            await loadProducts();
            const status = await getSubscriptionStatus();
            console.log('[Subscription] Refresh status:', JSON.stringify(status, null, 2));
            if (status?.subscription?.status === 'ACTIVE') {
              console.log('[Subscription] ✅ Subscription is now active after refresh!');
              setCurrentSubscription(status.subscription);
              Alert.alert('Success!', 'Your subscription is now active!');
            } else {
              console.log('[Subscription] ⚠️ Subscription still not active after refresh');
            }
          }
        },
        { text: 'OK' }
      ]
    );
    return false;
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      // Initialize IAP
      const initialized = await initIAP();
      setIapAvailable(initialized);

      // Check current subscription status
      try {
        const status = await getSubscriptionStatus();
        if (status?.subscription?.status === 'ACTIVE') {
          setCurrentSubscription(status.subscription);
        }
      } catch (e) {
        // User might not be subscribed or backend error
        if (e.message?.includes('500') || e.message?.includes('Internal server error')) {
          console.warn('[Subscription] Backend error checking subscription status. This may indicate a server issue.');
        } else {
          console.log('[Subscription] No active subscription');
        }
      }

      if (initialized) {
        // Get product IDs from backend
        const backendProducts = await getProductsFromBackend();
        const productIds = backendProducts?.products?.map(p => p.appleProductId) || [
          'com.belle.premium.monthly',
          'com.belle.premium.yearly'
        ];

        // Get products from Apple
        const appleProducts = await getProducts(productIds);

        if (appleProducts.length > 0) {
          // Map Apple products to our format
          const mappedPlans = appleProducts.map((product, index) => {
            const isYearly = product.productId.includes('yearly') || product.productId.includes('annual');
            const isMonthly = product.productId.includes('monthly');

            let savePercent = null;

            if (isYearly) {
              const yearlyPrice = product.priceAmount;
              // Calculate savings vs monthly (assume monthly is ~$29.99)
              const monthlyPrice = appleProducts.find(p => p.productId.includes('monthly'))?.priceAmount || 29.99;
              const savings = Math.round((1 - (yearlyPrice / (monthlyPrice * 12))) * 100);
              if (savings > 0) savePercent = `${savings}%`;
            }

            return {
              id: product.productId,
              productId: product.productId,
              duration: isYearly ? '6 Months' : isMonthly ? '1 Month' : product.title,
              price: product.price,
              priceAmount: product.priceAmount || parseFloat(String(product.price).replace(/[^0-9.]/g, '')) || null,
              isPopular: isYearly,
              savePercent,
            };
          });

          setPlans(mappedPlans);
          // Select the yearly plan by default if available, otherwise first plan
          const yearlyPlan = mappedPlans.find(p => p.productId.includes('yearly'));
          setSelectedPlan(yearlyPlan?.id || mappedPlans[0]?.id);
        } else {
          // Use fallback plans
          setPlans(fallbackPlans);
          setSelectedPlan('com.belle.premium.yearly');
        }
      } else {
        // IAP not available (Expo Go), use fallback
        setPlans(fallbackPlans);
        setSelectedPlan('com.belle.premium.yearly');
      }
    } catch (error) {
      console.error('[Subscription] Error loading products:', error);
      // Use fallback plans on error
      setPlans(fallbackPlans);
      setSelectedPlan('com.belle.premium.yearly');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = useCallback((planId) => {
    setSelectedPlan(planId);
  }, []);

  const handleWebPayment = async () => {
    if (!selectedPlan) {
      Alert.alert('Select a Plan', 'Please select a subscription plan to continue.');
      return;
    }

    const plan = plans.find(p => p.id === selectedPlan);
    if (!plan) {
      Alert.alert('Error', 'Selected plan not found.');
      return;
    }

    // Determine billing cycle from plan
    const billingCycle = plan.duration?.includes('Month') && !plan.duration?.includes('6') 
      ? 'MONTHLY' 
      : 'YEARLY';

    setPurchasing(true);
    try {
      const token = await tokenStorage.getToken();
      if (!token) {
        Alert.alert('Authentication Required', 'Please log in to continue.');
        return;
      }

      // Get billing cycle from plan duration
      const billingCycle = plan.duration?.includes('6') || plan.duration?.includes('Year') 
        ? 'YEARLY' 
        : 'MONTHLY';

      // Use appleProductId (which is plan.id from Apple IAP) or plan.id
      const appleProductId = plan.productId || plan.id;

      // Create checkout session
      const response = await fetch(`${config.SUBSCRIPTION_SERVICE_URL}/api/subscriptions/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          appleProductId: appleProductId, // Send Apple product ID
          billingCycle: billingCycle,
          successUrl: Platform.OS === 'web' 
            ? `${window.location.origin}/subscription-success?session_id={CHECKOUT_SESSION_ID}`
            : `${config.API_URL.replace(':4000', ':3010')}/api/subscriptions/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: Platform.OS === 'web'
            ? `${window.location.origin}/subscription-cancel`
            : `${config.API_URL.replace(':4000', ':3010')}/api/subscriptions/checkout-cancel`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to create checkout session' }));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Subscription] Checkout session response:', data);

      if (data.status === 'success' && data.data?.url) {
        const checkoutUrl = data.data.url;
        const sessionId = data.data?.sessionId;
        console.log('[Subscription] Opening Stripe checkout:', checkoutUrl);
        console.log('[Subscription] Session ID from backend:', sessionId);
        
        // Store session_id in localStorage for later retrieval
        if (sessionId) {
          try {
            localStorage.setItem('stripe_checkout_session_id', sessionId);
            // Clear any previous verification status so new payment can be verified
            localStorage.removeItem('subscription_verification_complete');
            console.log('[Subscription] ✅ Stored session_id in localStorage:', sessionId);
            console.log('[Subscription] ✅ Cleared previous verification status');
          } catch (e) {
            console.warn('[Subscription] Failed to store session_id in localStorage:', e);
          }
        }
        
        // Validate URL
        if (!checkoutUrl.startsWith('https://checkout.stripe.com')) {
          throw new Error('Invalid checkout URL received from server');
        }

        // Open Stripe checkout in browser
        if (Platform.OS === 'web') {
          // For web, redirect in same window so we can detect the return
          window.location.href = checkoutUrl;
          // Note: We'll detect the return via URL parameter in useEffect
          return;
        } else {
          // For mobile (iOS/Android), use WebBrowser as modal/popup
          const browserOptions = {
            showTitle: true,
            enableBarCollapsing: false,
            controlsColor: '#000000',
          };
          
          // Add iOS-specific modal presentation
          if (Platform.OS === 'ios') {
            browserOptions.presentationStyle = WebBrowser.WebBrowserPresentationStyle.FORM_SHEET;
          }
          
          const result = await WebBrowser.openBrowserAsync(checkoutUrl, browserOptions);

          // Check if payment was successful (user closed browser)
          if (result.type === 'dismiss' || result.type === 'cancel') {
            // Poll for subscription status after browser closes
            await pollSubscriptionStatus();
          }
        }
      } else {
        throw new Error(data.message || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('[Subscription] Web payment error:', error);
      const errorMessage = error.message || 'An error occurred. Please try again.';
      
      // Provide more helpful error messages
      let userMessage = errorMessage;
      if (errorMessage.includes('500') || errorMessage.includes('Internal server error')) {
        userMessage = 'Server error. Please check that the subscription service is running and database is configured.';
      } else if (errorMessage.includes('404')) {
        userMessage = 'Subscription plan not found. Please contact support.';
      } else if (errorMessage.includes('409')) {
        userMessage = 'You already have an active subscription.';
      }
      
      Alert.alert(
        'Payment Failed',
        userMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPlan) {
      Alert.alert('Select a Plan', 'Please select a subscription plan to continue.');
      return;
    }

    if (!iapAvailable) {
      Alert.alert(
        'Demo Mode',
        'In-app purchases are not available in Expo Go. Please use a development build to test purchases.',
        [{ text: 'OK' }]
      );
      return;
    }

    setPurchasing(true);
    try {
      const result = await purchaseSubscription(selectedPlan);

      Alert.alert(
        'Success!',
        'Your subscription is now active. Enjoy Premium!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      if (error.message === 'Purchase cancelled') {
        // User cancelled, don't show error
        return;
      }

      Alert.alert(
        'Purchase Failed',
        error.message || 'An error occurred during purchase. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (!iapAvailable) {
      Alert.alert(
        'Demo Mode',
        'Restore purchases is not available in Expo Go. Please use a development build.',
        [{ text: 'OK' }]
      );
      return;
    }

    setRestoring(true);
    try {
      const restored = await restorePurchases();

      if (restored && restored.length > 0) {
        Alert.alert(
          'Purchases Restored',
          'Your subscription has been restored successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert(
          'No Purchases Found',
          'No previous purchases were found for this Apple ID.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Restore Failed',
        error.message || 'Failed to restore purchases. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setRestoring(false);
    }
  };

  // (removed temporary web-price helpers)

  // If user already has active subscription
  if (currentSubscription) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <DynamicIcon
              iconName="arrow-back"
              iconFamily="MaterialIcons"
              iconColor={colors.black}
              iconSize={26}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Premium</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContentContainer}
        >
        <View style={styles.activeSubscriptionContainer}>
          <View style={styles.diamondIconBg}>
            <Ionicons name="diamond" size={40} color="#000" />
          </View>
          <Text style={styles.activeTitle}>You're a Premium Member!</Text>
          <Text style={styles.activeSubtitle}>
            Your subscription is active and will renew on{' '}
            {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
          </Text>
          <Text style={styles.managementNote}>
            Manage your subscription in your device's Settings → Apple ID → Subscriptions
          </Text>
        </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <DynamicIcon
            iconName="arrow-back"
            iconFamily="MaterialIcons"
            iconColor={colors.black}
            iconSize={26}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Premium</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.loadingText}>Loading plans...</Text>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            bounces={true}
            nestedScrollEnabled={true}
          >




            <Text style={styles.sectionTitle}>Choose Your Plan</Text>
            
            {/* Show current subscription status if active */}
            {currentSubscription && (
              <View style={styles.currentSubscriptionBanner}>
                <View style={styles.bannerContent}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <View style={styles.bannerText}>
                    <Text style={styles.bannerTitle}>You're a Premium Member</Text>
                    <Text style={styles.bannerSubtitle}>
                      Renews on {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </View>
            )}
            <View style={styles.planContainer}>
              {plans.map((plan) => {
                const isCurrentPlan = currentSubscription?.planId === plan.id;
                return (
                  <View key={plan.id} style={styles.planWrapper}>
                    {isCurrentPlan && (
                      <View style={styles.currentPlanBadge}>
                        <Text style={styles.currentPlanBadgeText}>Current</Text>
                      </View>
                    )}
                    <PlanOption
                      {...plan}
                      isSelected={selectedPlan === plan.id}
                      onPress={() => handlePlanSelect(plan.id)}
                      disabled={purchasing || restoring || isCurrentPlan}
                    />
                  </View>
                );
              })}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 32 }]}>
              Advanced Filters (Premium)
            </Text>
            <View style={styles.featureList}>
              {PREMIUM_FEATURES.map((feature) => (
                <View key={feature.title} style={styles.bulletItem}>
                  <Text style={styles.bulletText}>•</Text>
                  <View style={styles.bulletContent}>
                    <Text style={styles.bulletTitle}>{feature.title}</Text>
                    <Text style={styles.bulletSubtitle}>{feature.subtitle}</Text>
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={restoring || purchasing}
            >
              {restoring ? (
                <ActivityIndicator size="small" color="#6B7280" />
              ) : (
                <Text style={styles.restoreButtonText}>Restore Purchases</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.footerNote}>
              Auto-renews unless cancelled 24h before period ends. Manage in
              Settings → Apple ID → Subscriptions.
            </Text>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <TouchableOpacity
              style={[
                styles.continueButton,
                (purchasing || !selectedPlan) && styles.continueButtonDisabled,
                { marginBottom: 12, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#000' }
              ]}
              onPress={handleWebPayment}
              disabled={purchasing || !selectedPlan}
            >
              <Ionicons name="card-outline" size={20} color="#000" style={{ marginRight: 8 }} />
              <Text style={[styles.continueButtonText, { color: '#000' }]}>Pay via Web</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.continueButton,
                (purchasing || !selectedPlan) && styles.continueButtonDisabled,
                { backgroundColor: '#000000', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }
              ]}
              onPress={handlePurchase}
              disabled={purchasing || !selectedPlan}
            >
              <Ionicons name="logo-apple" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              {purchasing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.continueButtonText}>Pay with Apple Pay</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    marginTop: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 180,
    flexGrow: 1,
  },
  scrollContentContainer: {
    paddingBottom: 40,
  },

  upgradeSection: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  diamondIconBg: {
    backgroundColor: "#F3F4F6",
    padding: 16,
    borderRadius: 50,
    marginRight: 16,
  },
  upgradeTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  upgradeSubtitle: {
    fontSize: 15,
    color: "#6B7280",
    marginTop: 2,
  },

  demoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  demoNoticeText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },

  planContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  planBox: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginHorizontal: 6,
    position: "relative",
  },
  selectedPlan: {
    borderColor: "#000000",
    borderWidth: 2,
  },
  disabledPlan: {
    opacity: 0.6,
  },
  popularBadge: {
    position: "absolute",
    top: -12,
    backgroundColor: "#000000",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  radioIcon: {
    marginBottom: 12,
  },
  planDuration: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  planPrice: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginVertical: 4,
  },
  planWebPrice: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  planPerMonth: {
    fontSize: 14,
    color: "#6B7280",
  },
  saveBadge: {
    backgroundColor: "#111827",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 12,
  },
  saveBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },

  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  featureBox: {
    width: "48%",
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,

    alignItems: "center",
  },
  featureIconCircle: {
    backgroundColor: "#FFFFFF",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  featureText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",

    textAlign: "center",
  },

  featureList: {
    marginBottom: 8,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  bulletText: {
    fontSize: 20,
    lineHeight: 22,
    marginRight: 10,
    color: '#111827',
    width: 20,
    textAlign: 'center',
  },
  bulletContent: {
    flex: 1,
  },
  bulletTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  bulletSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  featureListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    marginBottom: 10,
  },
  featureTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  featureTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featureListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  featureListSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  premiumBadge: {
    backgroundColor: '#FFCC30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 12,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#111827',
  },
  featureIconList: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginBottom: 0,
  },

  restoreButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  restoreButtonText: {
    fontSize: 14,
    color: '#6B7280',
    textDecorationLine: 'underline',
  },

  footerNote: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 20,
    marginTop: 8,
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    zIndex: 10,
    minHeight: 100,
  },
  continueButton: {
    backgroundColor: "#000000",
    padding: 16,
    borderRadius: 30,
    alignItems: "center",
  },
  continueButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },

  // Active subscription styles
  activeSubscriptionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  activeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 24,
    textAlign: 'center',
  },
  activeSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  managementNote: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 24,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  directPriceContainer: {
    marginVertical: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  directPriceLabel: {
    fontSize: 13,
    color: "#166534", // green text
    fontWeight: "800",
    marginRight: 4,
  },
  directPriceValue: {
    fontSize: 13,
    color: "#166534", // green text
    fontWeight: "500",
  },
  currentSubscriptionBanner: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerText: {
    marginLeft: 12,
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065F46',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#047857',
  },
  planWrapper: {
    flex: 1,
    position: 'relative',
  },
  currentPlanBadge: {
    position: 'absolute',
    top: -10,
    right: 8,
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 10,
  },
  currentPlanBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
