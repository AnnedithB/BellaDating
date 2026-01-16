// API Configuration
// URLs are loaded from app.config.js extra field via expo-constants
// This allows different URLs for development, preview, and production builds

import Constants from 'expo-constants';

// Get configuration from Expo Constants (set in app.config.js)
const expoConfig = Constants.expoConfig?.extra || {};

// Fallback URLs for development (when running without proper config)
// For PHYSICAL DEVICE: use your Mac's IP (run: ipconfig getifaddr en0)
// For SIMULATOR/WEB: use localhost
const USE_PHYSICAL_DEVICE = false; // Set to true for physical device testing
const LOCAL_IP = '192.168.0.103';
const HOST = USE_PHYSICAL_DEVICE ? LOCAL_IP : 'localhost';
const DEFAULT_DEV_GATEWAY_URL = `http://${HOST}:4000`;
const DEFAULT_DEV_USER_SERVICE_URL = `http://${HOST}:3001`;
const DEFAULT_DEV_WS_URL = `ws://${HOST}:3005`;
const DEFAULT_DEV_COMMUNICATION_SERVICE_URL = `http://${HOST}:3005`;
const DEFAULT_DEV_INTERACTION_SERVICE_URL = `ws://${HOST}:3457`;
const DEFAULT_DEV_SUBSCRIPTION_SERVICE_URL = `http://${HOST}:3006`;

// For physical device testing, replace localhost with your machine's IP:
// Run `ipconfig getifaddr en0` (Mac) or `ipconfig` (Windows) to get your IP
// Example: 'http://192.168.1.100:4000'

export const config = {
  // GraphQL endpoint (API Gateway)
  API_URL: expoConfig.apiUrl || DEFAULT_DEV_GATEWAY_URL,
  GRAPHQL_URL: expoConfig.graphqlUrl || `${DEFAULT_DEV_GATEWAY_URL}/graphql`,

  // User Service (REST endpoints for file uploads)
  USER_SERVICE_URL: expoConfig.userServiceUrl || DEFAULT_DEV_USER_SERVICE_URL,

  // WebSocket for real-time chat (Communication Service)
  WS_URL: expoConfig.wsUrl || DEFAULT_DEV_WS_URL,

  // Communication Service (REST endpoints for file uploads in chat)
  COMMUNICATION_SERVICE_URL: expoConfig.communicationServiceUrl || DEFAULT_DEV_COMMUNICATION_SERVICE_URL,

  // WebSocket for video/voice calls (Interaction Service)
  INTERACTION_SERVICE_URL: expoConfig.interactionServiceUrl || DEFAULT_DEV_INTERACTION_SERVICE_URL,

  // Subscription Service (for Apple IAP)
  SUBSCRIPTION_SERVICE_URL: expoConfig.subscriptionServiceUrl || DEFAULT_DEV_SUBSCRIPTION_SERVICE_URL,

  // Environment
  ENVIRONMENT: expoConfig.environment || 'development',
  IS_DEV: (expoConfig.environment || 'development') === 'development',

  // Timeouts
  REQUEST_TIMEOUT: 10000, // 10 seconds

  // Token refresh threshold (refresh when less than this many seconds left)
  TOKEN_REFRESH_THRESHOLD: 3600, // 1 hour
};

// Helper to get the correct base URL for device testing
// Call this to get URLs that work on physical devices
export const getDeviceUrl = (url) => {
  // If already configured for non-localhost, return as-is
  if (!url.includes('localhost')) {
    return url;
  }

  // For development on physical devices, you need to replace localhost
  // with your development machine's IP address
  // You can set this via environment variables in app.config.js
  return url;
};

// Log configuration in development
if (__DEV__) {
  console.log('App Configuration:', {
    API_URL: config.API_URL,
    GRAPHQL_URL: config.GRAPHQL_URL,
    USER_SERVICE_URL: config.USER_SERVICE_URL,
    WS_URL: config.WS_URL,
    ENVIRONMENT: config.ENVIRONMENT,
  });
}

export default config;
