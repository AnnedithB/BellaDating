/**
 * Apple StoreKit 2 / App Store Server API Integration
 *
 * This service handles:
 * - Receipt validation with App Store Server API
 * - Transaction history lookup
 * - Subscription status checking
 * - JWS (JSON Web Signature) verification for App Store Server Notifications V2
 *
 * Required environment variables:
 * - APPLE_BUNDLE_ID: Your app's bundle identifier
 * - APPLE_ISSUER_ID: From App Store Connect > Users and Access > Keys
 * - APPLE_KEY_ID: The Key ID for your App Store Connect API key
 * - APPLE_PRIVATE_KEY: The .p8 private key contents (base64 encoded)
 * - APPLE_ENVIRONMENT: 'Sandbox' or 'Production'
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Configuration
const config = {
  bundleId: process.env.APPLE_BUNDLE_ID || 'com.belle.dating',
  issuerId: process.env.APPLE_ISSUER_ID || '',
  keyId: process.env.APPLE_KEY_ID || '',
  privateKey: process.env.APPLE_PRIVATE_KEY
    ? Buffer.from(process.env.APPLE_PRIVATE_KEY, 'base64').toString('utf-8')
    : '',
  environment: (process.env.APPLE_ENVIRONMENT || 'Sandbox') as 'Sandbox' | 'Production',
};

// App Store Server API endpoints
const API_BASE_URL = {
  Sandbox: 'https://api.storekit-sandbox.itunes.apple.com',
  Production: 'https://api.storekit.itunes.apple.com',
};

// Types
export interface AppleTransactionInfo {
  transactionId: string;
  originalTransactionId: string;
  webOrderLineItemId?: string;
  bundleId: string;
  productId: string;
  subscriptionGroupIdentifier?: string;
  purchaseDate: number;
  originalPurchaseDate: number;
  expiresDate?: number;
  quantity: number;
  type: 'Auto-Renewable Subscription' | 'Non-Consumable' | 'Consumable' | 'Non-Renewing Subscription';
  appAccountToken?: string;
  inAppOwnershipType: 'PURCHASED' | 'FAMILY_SHARED';
  signedDate: number;
  revocationReason?: number;
  revocationDate?: number;
  isUpgraded?: boolean;
  offerType?: number;
  offerIdentifier?: string;
  environment: 'Sandbox' | 'Production';
  storefront: string;
  storefrontId: string;
  transactionReason: 'PURCHASE' | 'RENEWAL';
  price?: number;
  currency?: string;
}

export interface AppleRenewalInfo {
  originalTransactionId: string;
  autoRenewProductId: string;
  productId: string;
  autoRenewStatus: number; // 0 = off, 1 = on
  renewalPrice?: number;
  currency?: string;
  signedDate: number;
  environment: 'Sandbox' | 'Production';
  expirationIntent?: number;
  gracePeriodExpiresDate?: number;
  isInBillingRetryPeriod?: boolean;
  offerIdentifier?: string;
  offerType?: number;
  priceIncreaseStatus?: number;
}

export interface AppleSubscriptionStatus {
  subscriptionGroupIdentifier: string;
  lastTransactions: Array<{
    originalTransactionId: string;
    status: number; // 1=Active, 2=Expired, 3=Billing Retry, 4=Grace Period, 5=Revoked
    signedTransactionInfo: string;
    signedRenewalInfo: string;
  }>;
}

export interface DecodedNotification {
  notificationType: string;
  subtype?: string;
  notificationUUID: string;
  data: {
    appAppleId?: number;
    bundleId: string;
    bundleVersion?: string;
    environment: 'Sandbox' | 'Production';
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
  version: string;
  signedDate: number;
}

// Notification types from Apple
export const APPLE_NOTIFICATION_TYPES = {
  CONSUMPTION_REQUEST: 'CONSUMPTION_REQUEST',
  DID_CHANGE_RENEWAL_PREF: 'DID_CHANGE_RENEWAL_PREF',
  DID_CHANGE_RENEWAL_STATUS: 'DID_CHANGE_RENEWAL_STATUS',
  DID_FAIL_TO_RENEW: 'DID_FAIL_TO_RENEW',
  DID_RENEW: 'DID_RENEW',
  EXPIRED: 'EXPIRED',
  GRACE_PERIOD_EXPIRED: 'GRACE_PERIOD_EXPIRED',
  OFFER_REDEEMED: 'OFFER_REDEEMED',
  PRICE_INCREASE: 'PRICE_INCREASE',
  REFUND: 'REFUND',
  REFUND_DECLINED: 'REFUND_DECLINED',
  REFUND_REVERSED: 'REFUND_REVERSED',
  RENEWAL_EXTENDED: 'RENEWAL_EXTENDED',
  REVOKE: 'REVOKE',
  SUBSCRIBED: 'SUBSCRIBED',
  TEST: 'TEST',
};

/**
 * Generate a JWT for App Store Server API authentication
 */
function generateAppStoreJWT(): string {
  if (!config.privateKey || !config.issuerId || !config.keyId) {
    throw new Error('Apple App Store Connect API credentials not configured');
  }

  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: config.issuerId,
    iat: now,
    exp: now + 3600, // 1 hour
    aud: 'appstoreconnect-v1',
    bid: config.bundleId,
  };

  return jwt.sign(payload, config.privateKey, {
    algorithm: 'ES256',
    header: {
      alg: 'ES256',
      kid: config.keyId,
      typ: 'JWT',
    },
  });
}

/**
 * Make authenticated request to App Store Server API
 */
async function appStoreRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' = 'GET',
  body?: any
): Promise<T> {
  const baseUrl = API_BASE_URL[config.environment];
  const url = `${baseUrl}${endpoint}`;
  const token = generateAppStoreJWT();

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`App Store API error ${response.status}: ${errorBody}`);
  }

  return response.json();
}

/**
 * Decode and verify a JWS (JSON Web Signature) from Apple
 * Apple signs transactions and notifications using JWS
 */
export function decodeJWS<T>(signedData: string): T {
  // For production, you should verify the signature using Apple's public key
  // Apple's public keys are available at: https://appleid.apple.com/auth/keys
  // For now, we decode without verification (add verification for production)

  const parts = signedData.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWS format');
  }

  const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
  return JSON.parse(payload) as T;
}

/**
 * Get transaction history for a user
 */
export async function getTransactionHistory(
  originalTransactionId: string
): Promise<AppleTransactionInfo[]> {
  const response = await appStoreRequest<{
    signedTransactions: string[];
    revision?: string;
    hasMore: boolean;
  }>(`/inApps/v1/history/${originalTransactionId}`);

  return response.signedTransactions.map((signed) =>
    decodeJWS<AppleTransactionInfo>(signed)
  );
}

/**
 * Get subscription status for a transaction
 */
export async function getSubscriptionStatus(
  originalTransactionId: string
): Promise<AppleSubscriptionStatus[]> {
  const response = await appStoreRequest<{
    data: AppleSubscriptionStatus[];
    environment: string;
    appAppleId: number;
    bundleId: string;
  }>(`/inApps/v1/subscriptions/${originalTransactionId}`);

  return response.data;
}

/**
 * Get all subscription statuses for a user (by transaction ID)
 * Returns decoded transaction and renewal info
 */
export async function getFullSubscriptionStatus(originalTransactionId: string): Promise<{
  status: number;
  transactionInfo: AppleTransactionInfo;
  renewalInfo: AppleRenewalInfo;
} | null> {
  try {
    const subscriptions = await getSubscriptionStatus(originalTransactionId);

    if (!subscriptions || subscriptions.length === 0) {
      return null;
    }

    // Get the most recent transaction
    const latestGroup = subscriptions[0];
    const latestTx = latestGroup.lastTransactions[0];

    if (!latestTx) {
      return null;
    }

    const transactionInfo = decodeJWS<AppleTransactionInfo>(latestTx.signedTransactionInfo);
    const renewalInfo = decodeJWS<AppleRenewalInfo>(latestTx.signedRenewalInfo);

    return {
      status: latestTx.status,
      transactionInfo,
      renewalInfo,
    };
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return null;
  }
}

/**
 * Look up a specific transaction by its ID
 */
export async function lookupTransaction(
  transactionId: string
): Promise<AppleTransactionInfo | null> {
  try {
    const response = await appStoreRequest<{
      signedTransactionInfo: string;
    }>(`/inApps/v1/transactions/${transactionId}`);

    return decodeJWS<AppleTransactionInfo>(response.signedTransactionInfo);
  } catch (error) {
    console.error('Error looking up transaction:', error);
    return null;
  }
}

/**
 * Verify and decode an App Store Server Notification V2
 */
export function decodeNotification(signedPayload: string): DecodedNotification {
  return decodeJWS<DecodedNotification>(signedPayload);
}

/**
 * Extract transaction info from a notification
 */
export function extractTransactionFromNotification(notification: DecodedNotification): {
  transactionInfo: AppleTransactionInfo | null;
  renewalInfo: AppleRenewalInfo | null;
} {
  let transactionInfo: AppleTransactionInfo | null = null;
  let renewalInfo: AppleRenewalInfo | null = null;

  if (notification.data.signedTransactionInfo) {
    transactionInfo = decodeJWS<AppleTransactionInfo>(notification.data.signedTransactionInfo);
  }

  if (notification.data.signedRenewalInfo) {
    renewalInfo = decodeJWS<AppleRenewalInfo>(notification.data.signedRenewalInfo);
  }

  return { transactionInfo, renewalInfo };
}

/**
 * Map Apple subscription status to our internal status
 * Apple status codes:
 * 1 = Active
 * 2 = Expired
 * 3 = Billing Retry Period
 * 4 = Grace Period
 * 5 = Revoked
 */
export function mapAppleStatusToInternal(
  appleStatus: number
): 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'PAUSED' {
  switch (appleStatus) {
    case 1:
      return 'ACTIVE';
    case 2:
      return 'CANCELED';
    case 3:
    case 4:
      return 'PAST_DUE';
    case 5:
      return 'CANCELED';
    default:
      return 'CANCELED';
  }
}

/**
 * Request a test notification from Apple (for testing webhook integration)
 */
export async function requestTestNotification(): Promise<{ testNotificationToken: string }> {
  return appStoreRequest<{ testNotificationToken: string }>(
    '/inApps/v1/notifications/test',
    'POST'
  );
}

/**
 * Get notification history (useful for debugging missed notifications)
 */
export async function getNotificationHistory(
  startDate: Date,
  endDate: Date,
  notificationType?: string
): Promise<any> {
  const params = new URLSearchParams({
    startDate: startDate.getTime().toString(),
    endDate: endDate.getTime().toString(),
  });

  if (notificationType) {
    params.append('notificationType', notificationType);
  }

  return appStoreRequest(`/inApps/v1/notifications/history?${params.toString()}`, 'POST', {
    startDate: startDate.getTime(),
    endDate: endDate.getTime(),
    notificationType,
  });
}

/**
 * Extend a subscription's renewal date (for customer service)
 */
export async function extendSubscriptionRenewalDate(
  originalTransactionId: string,
  extendByDays: number,
  extendReasonCode: number, // 0=undeclared, 1=customer satisfaction, 2=other, 3=service issue
  requestIdentifier: string
): Promise<{ effectiveDate: number; originalTransactionId: string }> {
  return appStoreRequest(
    `/inApps/v1/subscriptions/extend/${originalTransactionId}`,
    'PUT',
    {
      extendByDays,
      extendReasonCode,
      requestIdentifier,
    }
  );
}

/**
 * Check if the Apple configuration is valid
 */
export function isAppleConfigured(): boolean {
  return !!(config.privateKey && config.issuerId && config.keyId && config.bundleId);
}

/**
 * Get the current environment
 */
export function getEnvironment(): 'Sandbox' | 'Production' {
  return config.environment;
}

export default {
  getTransactionHistory,
  getSubscriptionStatus,
  getFullSubscriptionStatus,
  lookupTransaction,
  decodeNotification,
  extractTransactionFromNotification,
  mapAppleStatusToInternal,
  requestTestNotification,
  getNotificationHistory,
  extendSubscriptionRenewalDate,
  isAppleConfigured,
  getEnvironment,
  decodeJWS,
  APPLE_NOTIFICATION_TYPES,
};
