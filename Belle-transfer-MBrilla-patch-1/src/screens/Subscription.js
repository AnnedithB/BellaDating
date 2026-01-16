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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DynamicIcon from '../components/DynamicIcon';
import colors from "../styles/colors";
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

const PlanOption = React.memo(
  ({
    duration,
    price,
    perMonth,
    isPopular,
    savePercent,
    isSelected,
    onPress,
    disabled,
  }) => (
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
      <Text style={styles.planPerMonth}>{perMonth}</Text>
      {savePercent && (
        <View style={styles.saveBadge}>
          <Text style={styles.saveBadgeText}>Save {savePercent}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
);

// Fallback plans when IAP is not available (demo mode)
const fallbackPlans = [
  {
    id: "com.belle.premium.monthly",
    duration: "1 Month",
    price: "$29.99",
    perMonth: "$29.99/mo",
    productId: "com.belle.premium.monthly",
  },
  {
    id: "com.belle.premium.yearly",
    duration: "6 Months",
    price: "$199.99",
    perMonth: "$16.67/mo",
    isPopular: true,
    savePercent: "44%",
    productId: "com.belle.premium.yearly",
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
  }, []);

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
        // User might not be subscribed
        console.log('[Subscription] No active subscription');
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

            let perMonth = product.price;
            let savePercent = null;

            if (isYearly) {
              const yearlyPrice = product.priceAmount;
              const monthlyEquiv = yearlyPrice / 12;
              perMonth = `$${monthlyEquiv.toFixed(2)}/mo`;
              // Calculate savings vs monthly (assume monthly is ~$29.99)
              const monthlyPrice = appleProducts.find(p => p.productId.includes('monthly'))?.priceAmount || 29.99;
              const savings = Math.round((1 - (yearlyPrice / (monthlyPrice * 12))) * 100);
              if (savings > 0) savePercent = `${savings}%`;
            } else if (isMonthly) {
              perMonth = `${product.price}/mo`;
            }

            return {
              id: product.productId,
              productId: product.productId,
              duration: isYearly ? '1 Year' : isMonthly ? '1 Month' : product.title,
              price: product.price,
              perMonth,
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
            showsVerticalScrollIndicator={false}
          >
            

          

            <Text style={styles.sectionTitle}>Choose Your Plan</Text>
            <View style={styles.planContainer}>
              {plans.map((plan) => (
                <PlanOption
                  key={plan.id}
                  {...plan}
                  isSelected={selectedPlan === plan.id}
                  onPress={() => handlePlanSelect(plan.id)}
                  disabled={purchasing || restoring}
                />
              ))}
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

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.continueButton,
                (purchasing || !selectedPlan) && styles.continueButtonDisabled,
                { marginBottom: 12, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#000' }
              ]}
              onPress={() => {
                Alert.alert('Stripe Payment', 'Save 10% off! You will be redirected to the website to complete your payment via Stripe.');
                // TODO: Implement actual redirect logic
              }}
              disabled={purchasing || !selectedPlan}
            >
              <Ionicons name="card" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Ionicons name="card" size={20} color="#000" style={{ marginRight: 8 }} />
              <Text style={[styles.continueButtonText, { color: '#000' }]}>Pay with Stripe (Save 10% Off)</Text>
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
    paddingBottom: 120,
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
    padding: 16,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
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
});
