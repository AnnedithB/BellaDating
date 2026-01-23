/**
 * In-App Purchase Service using react-native-iap
 *
 * This service handles Apple StoreKit purchases and integrates with our backend.
 *
 * Setup Requirements:
 * 1. Install: npx expo install react-native-iap
 * 2. Requires EAS build (won't work in Expo Go)
 * 3. Configure products in App Store Connect
 *
 * Usage:
 * import { initIAP, getProducts, purchaseSubscription } from './services/iap';
 *
 * // Initialize on app start
 * await initIAP();
 *
 * // Get products
 * const products = await getProducts(['com.belle.premium.monthly']);
 *
 * // Purchase
 * await purchaseSubscription('com.belle.premium.monthly');
 */

import { Platform, Alert } from 'react-native';
import { config } from './config';
import { tokenStorage } from './api';

// react-native-iap will be imported dynamically to prevent crashes in Expo Go
let RNIap = null;

// State
let isIAPInitialized = false;
let purchaseUpdateSubscription = null;
let purchaseErrorSubscription = null;
let pendingPurchaseResolvers = {};

/**
 * Initialize IAP connection
 * Call this once when app starts
 */
export async function initIAP() {
  if (isIAPInitialized) {
    return true;
  }

  try {
    // Dynamically import react-native-iap
    // This allows the app to run in Expo Go (with fallback) and dev builds
    RNIap = require('react-native-iap');

    // Initialize connection
    const result = await RNIap.initConnection();
    console.log('[IAP] Connection initialized:', result);

    // Clear any pending transactions (iOS)
    if (Platform.OS === 'ios') {
      await RNIap.clearTransactionIOS();
    }

    // Set up purchase listeners
    setupPurchaseListeners();

    isIAPInitialized = true;
    return true;
  } catch (error) {
    console.warn('[IAP] Init failed (expected in Expo Go):', error.message);
    return false;
  }
}

/**
 * Set up purchase update and error listeners
 */
function setupPurchaseListeners() {
  if (!RNIap) return;

  // Remove existing listeners if any
  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
  }
  if (purchaseErrorSubscription) {
    purchaseErrorSubscription.remove();
  }

  // Listen for purchase updates
  purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(async (purchase) => {
    console.log('[IAP] Purchase updated:', purchase);

    const { productId, transactionId, originalTransactionIdIOS } = purchase;
    const receipt = purchase.transactionReceipt;

    if (receipt) {
      try {
        // Verify with our backend
        const verified = await verifyPurchaseWithBackend({
          transactionId,
          originalTransactionId: originalTransactionIdIOS || transactionId,
          productId,
        });

        if (verified) {
          // Finish the transaction (required by Apple)
          await RNIap.finishTransaction({ purchase, isConsumable: false });
          console.log('[IAP] Transaction finished');

          // Resolve pending promise
          if (pendingPurchaseResolvers[productId]) {
            pendingPurchaseResolvers[productId].resolve(verified);
            delete pendingPurchaseResolvers[productId];
          }
        } else {
          throw new Error('Backend verification failed');
        }
      } catch (error) {
        console.error('[IAP] Verification error:', error);

        if (pendingPurchaseResolvers[productId]) {
          pendingPurchaseResolvers[productId].reject(error);
          delete pendingPurchaseResolvers[productId];
        }
      }
    }
  });

  // Listen for purchase errors
  purchaseErrorSubscription = RNIap.purchaseErrorListener((error) => {
    console.error('[IAP] Purchase error:', error);

    // Find and reject pending promise
    Object.keys(pendingPurchaseResolvers).forEach((productId) => {
      pendingPurchaseResolvers[productId].reject(error);
      delete pendingPurchaseResolvers[productId];
    });
  });
}

/**
 * End IAP connection (call on app unmount)
 */
export async function endIAP() {
  if (!RNIap || !isIAPInitialized) return;

  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
    purchaseUpdateSubscription = null;
  }
  if (purchaseErrorSubscription) {
    purchaseErrorSubscription.remove();
    purchaseErrorSubscription = null;
  }

  await RNIap.endConnection();
  isIAPInitialized = false;
  console.log('[IAP] Connection ended');
}

/**
 * Get available products from App Store
 * @param {string[]} productIds - Array of product IDs to fetch
 * @returns {Promise<Array>} Array of product objects with price info
 */
export async function getProducts(productIds) {
  if (!RNIap || !isIAPInitialized) {
    console.warn('[IAP] Not initialized, returning empty products');
    return [];
  }

  try {
    // For subscriptions, use getSubscriptions
    const products = await RNIap.getSubscriptions({ skus: productIds });
    console.log('[IAP] Products fetched:', products.length);

    return products.map((product) => ({
      productId: product.productId,
      title: product.title,
      description: product.description,
      price: product.localizedPrice,
      priceAmount: parseFloat(product.price),
      currency: product.currency,
      // iOS specific
      subscriptionPeriodNumberIOS: product.subscriptionPeriodNumberIOS,
      subscriptionPeriodUnitIOS: product.subscriptionPeriodUnitIOS,
      introductoryPrice: product.introductoryPrice,
      introductoryPricePaymentModeIOS: product.introductoryPricePaymentModeIOS,
    }));
  } catch (error) {
    console.error('[IAP] Error fetching products:', error);
    return [];
  }
}

/**
 * Purchase a subscription
 * @param {string} productId - The product ID to purchase
 * @returns {Promise<object>} The verified subscription data
 */
export async function purchaseSubscription(productId) {
  if (!RNIap || !isIAPInitialized) {
    throw new Error('IAP not initialized. Purchases only work in development builds.');
  }

  return new Promise(async (resolve, reject) => {
    // Store resolvers for the listener
    pendingPurchaseResolvers[productId] = { resolve, reject };

    try {
      // Request the purchase
      await RNIap.requestSubscription({
        sku: productId,
        andDangerouslyFinishTransactionAutomaticallyIOS: false,
      });

      // The purchase will complete via the listener
      // Timeout after 5 minutes
      setTimeout(() => {
        if (pendingPurchaseResolvers[productId]) {
          pendingPurchaseResolvers[productId].reject(new Error('Purchase timeout'));
          delete pendingPurchaseResolvers[productId];
        }
      }, 5 * 60 * 1000);
    } catch (error) {
      delete pendingPurchaseResolvers[productId];

      // Handle user cancellation
      if (error.code === 'E_USER_CANCELLED') {
        reject(new Error('Purchase cancelled'));
        return;
      }

      reject(error);
    }
  });
}

/**
 * Restore previous purchases
 * @returns {Promise<Array>} Array of restored subscription data
 */
export async function restorePurchases() {
  if (!RNIap || !isIAPInitialized) {
    throw new Error('IAP not initialized');
  }

  try {
    // Get available purchases (iOS will prompt for Apple ID if needed)
    const purchases = await RNIap.getAvailablePurchases();
    console.log('[IAP] Available purchases:', purchases.length);

    if (purchases.length === 0) {
      return [];
    }

    // Send to backend for verification
    const transactions = purchases.map((purchase) => ({
      transactionId: purchase.transactionId,
      originalTransactionId: purchase.originalTransactionIdIOS || purchase.transactionId,
      productId: purchase.productId,
    }));

    const result = await restorePurchasesWithBackend(transactions);
    return result;
  } catch (error) {
    console.error('[IAP] Restore error:', error);
    throw error;
  }
}

/**
 * Check if IAP is available (not in Expo Go)
 */
export function isIAPAvailable() {
  return isIAPInitialized && RNIap !== null;
}

// ============================================
// BACKEND API CALLS
// ============================================

/**
 * Verify purchase with our backend
 */
async function verifyPurchaseWithBackend({ transactionId, originalTransactionId, productId }) {
  try {
    const token = await tokenStorage.getToken();

    const response = await fetch(`${config.SUBSCRIPTION_SERVICE_URL}/api/apple-iap/verify-purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        transactionId,
        originalTransactionId,
        productId,
      }),
    });

    const data = await response.json();

    if (data.status === 'success') {
      return data.data.subscription;
    } else {
      throw new Error(data.message || 'Verification failed');
    }
  } catch (error) {
    console.error('[IAP] Backend verification error:', error);
    throw error;
  }
}

/**
 * Restore purchases with our backend
 */
async function restorePurchasesWithBackend(transactions) {
  try {
    const token = await tokenStorage.getToken();

    const response = await fetch(`${config.SUBSCRIPTION_SERVICE_URL}/api/apple-iap/restore-purchases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ transactions }),
    });

    const data = await response.json();

    if (data.status === 'success') {
      return data.data.restored;
    } else {
      throw new Error(data.message || 'Restore failed');
    }
  } catch (error) {
    console.error('[IAP] Backend restore error:', error);
    throw error;
  }
}

/**
 * Get products from our backend (with Apple product IDs)
 */
export async function getProductsFromBackend() {
  try {
    const token = await tokenStorage.getToken();

    const response = await fetch(`${config.SUBSCRIPTION_SERVICE_URL}/api/apple-iap/products`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : undefined,
      },
    });

    const data = await response.json();

    if (data.status === 'success') {
      return data.data;
    } else {
      throw new Error(data.message || 'Failed to get products');
    }
  } catch (error) {
    console.error('[IAP] Backend products error:', error);
    throw error;
  }
}

/**
 * Get subscription status from our backend
 */
export async function getSubscriptionStatus() {
  try {
    const token = await tokenStorage.getToken();

    const response = await fetch(`${config.SUBSCRIPTION_SERVICE_URL}/api/apple-iap/subscription-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (data.status === 'success') {
      return data.data;
    } else {
      throw new Error(data.message || 'Failed to get status');
    }
  } catch (error) {
    console.error('[IAP] Backend status error:', error);
    throw error;
  }
}

export default {
  initIAP,
  endIAP,
  getProducts,
  purchaseSubscription,
  restorePurchases,
  isIAPAvailable,
  getProductsFromBackend,
  getSubscriptionStatus,
};
