import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenHeader } from '../components';
import { subscriptionAPI } from '../services/api';
import {
  initIAP,
  getProducts,
  purchaseSubscription,
  restorePurchases,
  isIAPAvailable,
  getProductsFromBackend,
  getSubscriptionStatus,
} from '../services/iap';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ACCENT_COLOR = '#000000';
const GOLD_COLOR = '#D4AF37';
const LIGHT_GRAY = '#F3F4F6';

// Dummy plans for when API is not available
const DUMMY_PLANS = [
  {
    id: 'free',
    name: 'free',
    displayName: 'Free',
    description: 'Basic features to get started',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      'Limited daily matches',
      'Basic messaging',
      'Standard profile',
    ],
  },
  {
    id: 'premium',
    name: 'premium',
    displayName: 'Premium',
    description: 'Unlock all features',
    monthlyPrice: 19.99,
    yearlyPrice: 119.99,
    yearlySavings: 119.89,
    features: [
      'Unlimited matches',
      'See who likes you',
      'Advanced filters',
      'Priority in queue',
      'Read receipts',
      'No ads',
    ],
    popular: true,
  },
  {
    id: 'vip',
    name: 'vip',
    displayName: 'VIP',
    description: 'The ultimate experience',
    monthlyPrice: 39.99,
    yearlyPrice: 239.99,
    yearlySavings: 239.89,
    features: [
      'Everything in Premium',
      'Profile boost monthly',
      'Super likes daily',
      'Undo swipes',
      'Travel mode',
      'Priority support',
      'Exclusive events access',
    ],
  },
];

export default function SubscriptionScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [storeProducts, setStoreProducts] = useState({}); // Map of productId -> StoreKit product
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [iapAvailable, setIapAvailable] = useState(false);

  useEffect(() => {
    initializeAndLoad();
  }, []);

  const initializeAndLoad = async () => {
    // Initialize IAP first
    const iapReady = await initIAP();
    setIapAvailable(iapReady);

    // Then load data
    await loadData(iapReady);
  };

  const loadData = async (iapReady = iapAvailable) => {
    try {
      setIsLoading(true);

      // Try to load from API, fall back to dummy data
      let plansData = DUMMY_PLANS;
      let subscriptionData = null;
      let appleProductIds = [];

      try {
        // Get plans from backend (includes Apple product IDs)
        const backendData = await getProductsFromBackend();
        if (backendData?.plans && backendData.plans.length > 0) {
          plansData = backendData.plans;
          appleProductIds = backendData.appleProductIds || [];
        }

        // Get current subscription status
        const statusData = await getSubscriptionStatus();
        subscriptionData = statusData?.subscription || null;
      } catch (apiError) {
        if (__DEV__) {
          console.log('Using dummy plans (API not available):', apiError.message);
        }
      }

      // If IAP is available and we have Apple product IDs, fetch prices from App Store
      if (iapReady && appleProductIds.length > 0) {
        try {
          const products = await getProducts(appleProductIds);
          const productMap = {};
          products.forEach((product) => {
            productMap[product.productId] = product;
          });
          setStoreProducts(productMap);

          // Update plan prices with actual App Store prices
          plansData = plansData.map((plan) => {
            const monthlyProduct = productMap[plan.appleProductIdMonthly];
            const yearlyProduct = productMap[plan.appleProductIdYearly];

            return {
              ...plan,
              // Use App Store prices if available
              monthlyPriceDisplay: monthlyProduct?.price || `$${plan.monthlyPrice}`,
              yearlyPriceDisplay: yearlyProduct?.price || `$${plan.yearlyPrice}`,
              monthlyPriceAmount: monthlyProduct?.priceAmount || plan.monthlyPrice,
              yearlyPriceAmount: yearlyProduct?.priceAmount || plan.yearlyPrice,
            };
          });

          if (__DEV__) {
            console.log('App Store products loaded:', Object.keys(productMap).length);
          }
        } catch (productError) {
          if (__DEV__) {
            console.log('Could not load App Store products:', productError.message);
          }
        }
      }

      setPlans(plansData);
      setCurrentSubscription(subscriptionData);

      // Pre-select current plan or premium
      if (subscriptionData?.plan?.id) {
        setSelectedPlan(subscriptionData.plan.id);
      } else {
        const premiumPlan = plansData.find(p => p.popular || p.name === 'premium');
        if (premiumPlan) {
          setSelectedPlan(premiumPlan.id);
        }
      }
    } catch (error) {
      console.error('Error loading subscription data:', error);
      setPlans(DUMMY_PLANS);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlan = useCallback((planId) => {
    setSelectedPlan(planId);
  }, []);

  const handleSubscribe = async () => {
    const plan = plans.find(p => p.id === selectedPlan);

    if (!plan || plan.monthlyPrice === 0) {
      Alert.alert('Free Plan', 'You are on the free plan. Select a premium plan to upgrade.');
      return;
    }

    // Get the Apple product ID for the selected billing cycle
    const productId = billingCycle === 'YEARLY'
      ? plan.appleProductIdYearly
      : plan.appleProductIdMonthly;

    // Check if we can use real IAP
    if (iapAvailable && productId && Platform.OS === 'ios') {
      // Real Apple IAP purchase
      setIsSubscribing(true);
      try {
        const subscription = await purchaseSubscription(productId);

        Alert.alert(
          'Purchase Successful!',
          `Welcome to ${plan.displayName}! Your premium features are now active.`,
          [{
            text: 'OK',
            onPress: () => {
              setCurrentSubscription(subscription);
              navigation.goBack();
            }
          }]
        );
      } catch (error) {
        if (error.message === 'Purchase cancelled') {
          // User cancelled - do nothing
          return;
        }

        Alert.alert(
          'Purchase Failed',
          error.message || 'Something went wrong. Please try again.',
          [{ text: 'OK' }]
        );
      } finally {
        setIsSubscribing(false);
      }
    } else {
      // Fallback: Demo mode or GraphQL API (for web/testing)
      const priceDisplay = billingCycle === 'YEARLY'
        ? (plan.yearlyPriceDisplay || `$${plan.yearlyPrice}`)
        : (plan.monthlyPriceDisplay || `$${plan.monthlyPrice}`);

      Alert.alert(
        'Subscribe to ' + plan.displayName,
        `You will be charged ${priceDisplay}/${billingCycle === 'YEARLY' ? 'year' : 'month'}.\n\n${
          iapAvailable
            ? 'Tap Subscribe to continue.'
            : 'Note: Real purchases require a development build (not Expo Go).'
        }`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Subscribe',
            onPress: async () => {
              setIsSubscribing(true);
              try {
                await subscriptionAPI.createSubscription(selectedPlan, billingCycle);
                Alert.alert(
                  'Success!',
                  `You are now subscribed to ${plan.displayName}!`,
                  [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
              } catch (error) {
                Alert.alert(
                  'Demo Mode',
                  `Purchases require a development build with react-native-iap installed.`,
                  [{ text: 'OK' }]
                );
              } finally {
                setIsSubscribing(false);
              }
            },
          },
        ]
      );
    }
  };

  const handleRestorePurchases = async () => {
    if (!iapAvailable) {
      Alert.alert(
        'Not Available',
        'Purchase restoration requires a development build.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsRestoring(true);
    try {
      const restored = await restorePurchases();

      if (restored && restored.length > 0) {
        const latest = restored[0];
        setCurrentSubscription(latest);
        Alert.alert(
          'Purchases Restored',
          `Your ${latest.plan?.displayName || 'subscription'} has been restored!`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'No Purchases Found',
          'We couldn\'t find any previous purchases associated with your Apple ID.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Restore Failed',
        error.message || 'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCancelSubscription = async () => {
    // For Apple subscriptions, users must cancel via iOS Settings
    if (currentSubscription && Platform.OS === 'ios') {
      Alert.alert(
        'Cancel Subscription',
        'Apple subscriptions must be cancelled through your device settings.\n\nGo to: Settings → Apple ID → Subscriptions',
        [
          { text: 'OK' },
          {
            text: 'Open Settings',
            onPress: () => {
              // Deep link to subscription settings (iOS 15+)
              const { Linking } = require('react-native');
              Linking.openURL('App-Prefs:root=ACCOUNT_SETTINGS&path=SUBSCRIPTIONS');
            },
          },
        ]
      );
      return;
    }

    // Fallback for non-Apple subscriptions
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel? You will lose access to premium features at the end of your billing period.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await subscriptionAPI.cancelSubscription();
              Alert.alert('Cancelled', 'Your subscription has been cancelled.');
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Could not cancel subscription. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getPrice = (plan) => {
    // Use App Store price display if available, otherwise fall back to stored price
    if (billingCycle === 'YEARLY') {
      return plan.yearlyPriceDisplay || `$${plan.yearlyPrice}`;
    }
    return plan.monthlyPriceDisplay || `$${plan.monthlyPrice}`;
  };

  const getPriceAmount = (plan) => {
    if (billingCycle === 'YEARLY') {
      return plan.yearlyPriceAmount || plan.yearlyPrice;
    }
    return plan.monthlyPriceAmount || plan.monthlyPrice;
  };

  const renderPlanCard = (plan) => {
    const isSelected = selectedPlan === plan.id;
    const isCurrentPlan = currentSubscription?.planId === plan.id;
    const isFree = plan.monthlyPrice === 0;

    return (
      <TouchableOpacity
        key={plan.id}
        style={[
          styles.planCard,
          isSelected && styles.planCardSelected,
          plan.popular && styles.planCardPopular,
        ]}
        onPress={() => handleSelectPlan(plan.id)}
        activeOpacity={0.8}
      >
        {plan.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
          </View>
        )}

        <View style={styles.planHeader}>
          <Text style={[styles.planName, isSelected && styles.planNameSelected]}>
            {plan.displayName}
          </Text>
          {isCurrentPlan && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>CURRENT</Text>
            </View>
          )}
        </View>

        <Text style={styles.planDescription}>{plan.description}</Text>

        <View style={styles.priceContainer}>
          {isFree ? (
            <Text style={styles.priceText}>Free</Text>
          ) : (
            <>
              <Text style={styles.priceText}>
                {getPrice(plan)}
              </Text>
              <Text style={styles.pricePeriod}>
                /{billingCycle === 'YEARLY' ? 'year' : 'month'}
              </Text>
            </>
          )}
        </View>

        {!isFree && billingCycle === 'YEARLY' && plan.yearlySavings > 0 && (
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsText}>
              Save ${plan.yearlySavings.toFixed(2)}/year
            </Text>
          </View>
        )}

        <View style={styles.featuresContainer}>
          {plan.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={isSelected ? GOLD_COLOR : '#10B981'}
              />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {isSelected && !isFree && (
          <View style={styles.selectedIndicator}>
            <Ionicons name="checkmark-circle" size={24} color={GOLD_COLOR} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Premium" navigation={navigation} showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT_COLOR} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Premium" navigation={navigation} showBack={true} />

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#1a1a1a', '#333333']}
          style={styles.headerGradient}
        >
          <Ionicons name="diamond" size={48} color={GOLD_COLOR} />
          <Text style={styles.headerTitle}>Upgrade to Premium</Text>
          <Text style={styles.headerSubtitle}>
            Get unlimited matches and exclusive features
          </Text>
        </LinearGradient>

        {/* Billing Toggle */}
        <View style={styles.billingToggleContainer}>
          <TouchableOpacity
            style={[
              styles.billingOption,
              billingCycle === 'MONTHLY' && styles.billingOptionSelected,
            ]}
            onPress={() => setBillingCycle('MONTHLY')}
          >
            <Text
              style={[
                styles.billingOptionText,
                billingCycle === 'MONTHLY' && styles.billingOptionTextSelected,
              ]}
            >
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.billingOption,
              billingCycle === 'YEARLY' && styles.billingOptionSelected,
            ]}
            onPress={() => setBillingCycle('YEARLY')}
          >
            <Text
              style={[
                styles.billingOptionText,
                billingCycle === 'YEARLY' && styles.billingOptionTextSelected,
              ]}
            >
              Yearly
            </Text>
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>-50%</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Plans */}
        <View style={styles.plansContainer}>
          {plans.map(renderPlanCard)}
        </View>

        {/* Current Subscription Info */}
        {currentSubscription && (
          <View style={styles.currentSubscriptionContainer}>
            <Text style={styles.currentSubscriptionTitle}>
              Current Subscription
            </Text>
            <Text style={styles.currentSubscriptionDetails}>
              {currentSubscription.plan?.displayName} - {currentSubscription.billingCycle}
            </Text>
            <Text style={styles.currentSubscriptionRenewal}>
              {currentSubscription.cancelAt
                ? `Cancels on ${new Date(currentSubscription.cancelAt).toLocaleDateString()}`
                : `Renews on ${new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}`}
            </Text>
            {!currentSubscription.cancelAt && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelSubscription}
              >
                <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Terms */}
        <Text style={styles.termsText}>
          By subscribing, you agree to our Terms of Service and Privacy Policy.
          Subscriptions automatically renew unless cancelled at least 24 hours
          before the end of the current period.
        </Text>
      </ScrollView>

      {/* Subscribe Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[
            styles.subscribeButton,
            (isSubscribing || isRestoring || !selectedPlan || getPriceAmount(plans.find(p => p.id === selectedPlan) || {}) === 0) &&
              styles.subscribeButtonDisabled,
          ]}
          onPress={handleSubscribe}
          disabled={isSubscribing || isRestoring || !selectedPlan || getPriceAmount(plans.find(p => p.id === selectedPlan) || {}) === 0}
        >
          {isSubscribing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="diamond" size={20} color="#FFFFFF" />
              <Text style={styles.subscribeButtonText}>
                {currentSubscription ? 'Change Plan' : 'Subscribe Now'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Restore Purchases - Required by Apple */}
        <View style={styles.bottomLinks}>
          <TouchableOpacity
            onPress={handleRestorePurchases}
            disabled={isRestoring}
            style={styles.restoreButton}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color="#6B7280" />
            ) : (
              <Text style={styles.restoreText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.skipText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>

        {/* IAP availability indicator (dev only) */}
        {__DEV__ && (
          <Text style={styles.devIndicator}>
            {iapAvailable ? '✓ StoreKit Ready' : '⚠ Demo Mode (Expo Go)'}
          </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  headerGradient: {
    padding: 32,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    textAlign: 'center',
  },
  billingToggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: LIGHT_GRAY,
    borderRadius: 12,
    padding: 4,
  },
  billingOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  billingOptionSelected: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  billingOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  billingOptionTextSelected: {
    color: ACCENT_COLOR,
  },
  discountBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  discountBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  plansContainer: {
    padding: 20,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: LIGHT_GRAY,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: GOLD_COLOR,
    backgroundColor: '#FFFDF5',
  },
  planCardPopular: {
    borderColor: GOLD_COLOR,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    left: 20,
    backgroundColor: GOLD_COLOR,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 24,
    fontWeight: '700',
    color: ACCENT_COLOR,
  },
  planNameSelected: {
    color: GOLD_COLOR,
  },
  currentBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  priceText: {
    fontSize: 32,
    fontWeight: '700',
    color: ACCENT_COLOR,
  },
  pricePeriod: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 4,
  },
  savingsBadge: {
    backgroundColor: '#ECFDF5',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  featuresContainer: {
    marginTop: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  currentSubscriptionContainer: {
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: LIGHT_GRAY,
    borderRadius: 12,
    marginBottom: 16,
  },
  currentSubscriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: ACCENT_COLOR,
    marginBottom: 8,
  },
  currentSubscriptionDetails: {
    fontSize: 14,
    color: '#374151',
  },
  currentSubscriptionRenewal: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  cancelButton: {
    marginTop: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
  termsText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    lineHeight: 18,
  },
  bottomContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: LIGHT_GRAY,
    alignItems: 'center',
  },
  subscribeButton: {
    backgroundColor: ACCENT_COLOR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: '100%',
    gap: 8,
  },
  subscribeButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  skipText: {
    fontSize: 14,
    color: '#6B7280',
  },
  bottomLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 24,
  },
  restoreButton: {
    paddingVertical: 8,
  },
  restoreText: {
    fontSize: 14,
    color: '#6B7280',
    textDecorationLine: 'underline',
  },
  devIndicator: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 12,
  },
});
