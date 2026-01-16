// Dynamic Expo configuration
// This allows environment-based configuration without hardcoding values

// Default to development if APP_VARIANT is not set
const IS_DEV = !process.env.APP_VARIANT || process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';
const IS_PRODUCTION = process.env.APP_VARIANT === 'production';

// Get API URLs from environment variables or use defaults
const getApiUrl = () => {
  if (process.env.API_URL) return process.env.API_URL;
  if (IS_PRODUCTION) return 'https://api.belle.app';
  if (IS_PREVIEW) return 'https://staging-api.belle.app';
  return 'http://localhost:4000'; // Development (default)
};

const getUserServiceUrl = () => {
  if (process.env.USER_SERVICE_URL) return process.env.USER_SERVICE_URL;
  if (IS_PRODUCTION) return 'https://users.belle.app';
  if (IS_PREVIEW) return 'https://staging-users.belle.app';
  return 'http://localhost:3001'; // Development (default)
};

const getWsUrl = () => {
  if (process.env.WS_URL) return process.env.WS_URL;
  if (IS_PRODUCTION) return 'wss://ws.belle.app';
  if (IS_PREVIEW) return 'wss://staging-ws.belle.app';
  return 'ws://localhost:3005'; // Development (default) -- Communication Service
};

const getCommunicationServiceUrl = () => {
  if (process.env.COMMUNICATION_SERVICE_URL) return process.env.COMMUNICATION_SERVICE_URL;
  if (IS_PRODUCTION) return 'https://communication.belle.app';
  if (IS_PREVIEW) return 'https://staging-communication.belle.app';
  return 'http://localhost:3005'; // Development (default) -- Server is running 3005
};

const getInteractionServiceUrl = () => {
  if (process.env.INTERACTION_SERVICE_URL) return process.env.INTERACTION_SERVICE_URL;
  if (IS_PRODUCTION) return 'https://interaction.belle.app';
  if (IS_PREVIEW) return 'https://staging-interaction.belle.app';
  return 'http://localhost:3003'; // Development (default) -- Server is running 3003
};

const getSubscriptionServiceUrl = () => {
  if (process.env.SUBSCRIPTION_SERVICE_URL) return process.env.SUBSCRIPTION_SERVICE_URL;
  if (IS_PRODUCTION) return 'https://subscription.belle.app';
  if (IS_PREVIEW) return 'https://staging-subscription.belle.app';
  return 'http://localhost:3010'; // Development (default) -- Server is running 3010
};

const getNotificationServiceUrl = () => {
  if (process.env.NOTIFICATION_SERVICE_URL) return process.env.NOTIFICATION_SERVICE_URL;
  if (IS_PRODUCTION) return 'https://notification.belle.app';
  if (IS_PREVIEW) return 'https://staging-notification.belle.app';
  return 'http://localhost:3006'; // Development (default) -- Server is running 3006
};

export default {
  expo: {
    name: IS_DEV ? 'Appcita (Dev)' : IS_PREVIEW ? 'Appcita (Preview)' : 'Appcita',
    slug: 'appcita',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_DEV
        ? 'com.dreamswonder.appcita.dev'
        : IS_PREVIEW
          ? 'com.dreamswonder.appcita'
          : 'com.dreamswonder.appcita',
      buildNumber: '2',
      infoPlist: {
        NSCameraUsageDescription: 'Belle needs camera access for video calls with your matches.',
        NSMicrophoneUsageDescription: 'Belle needs microphone access for voice and video calls.',
        NSPhotoLibraryUsageDescription: 'Belle needs access to your photo library to upload profile pictures.',
        NSPhotoLibraryAddUsageDescription: 'Belle needs access to save photos to your library.',
        ITSAppUsesNonExemptEncryption: false,
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
      },
      // Apple Sign-In capability
      usesAppleSignIn: true,
      // Google OAuth URL scheme
      associatedDomains: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ? ['applinks:your-domain.com'] : [],
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      package: IS_DEV
        ? 'com.dreamswonder.appcita.dev'
        : IS_PREVIEW
          ? 'com.dreamswonder.appcita'
          : 'com.dreamswonder.appcita',
      versionCode: 2,
      permissions: [
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
      ],
    },
    plugins: [
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 24,
          },
          ios: {
            deploymentTarget: '15.1',
          },
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission: 'Belle needs camera access for video calls with your matches.',
          microphonePermission: 'Belle needs microphone access for voice and video calls.',
          recordAudioAndroid: true,
        },
      ],
    ],
    web: {
      favicon: './assets/favicon.png',
    },
    // Extra configuration accessible via expo-constants
    extra: {
      apiUrl: getApiUrl(),
      graphqlUrl: `${getApiUrl()}/graphql`,
      userServiceUrl: getUserServiceUrl(),
      wsUrl: getWsUrl(),
      communicationServiceUrl: getCommunicationServiceUrl(),
      interactionServiceUrl: getInteractionServiceUrl(),
      subscriptionServiceUrl: getSubscriptionServiceUrl(),
      notificationServiceUrl: getNotificationServiceUrl(),
      environment: IS_DEV ? 'development' : IS_PREVIEW ? 'preview' : 'production',
      eas: {
        projectId: process.env.EAS_PROJECT_ID || '975f4b67-4792-44df-8968-d4458641ed01',
      },
    },
  },
};
