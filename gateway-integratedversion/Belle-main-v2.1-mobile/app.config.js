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
  return 'ws://localhost:3005'; // Development (default)
};

export default {
  expo: {
    name: IS_DEV ? 'Belle (Dev)' : IS_PREVIEW ? 'Belle (Preview)' : 'Belle',
    slug: 'belle',
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
      infoPlist: {
        NSCameraUsageDescription: 'Belle needs camera access for video calls with your matches.',
        NSMicrophoneUsageDescription: 'Belle needs microphone access for voice and video calls.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      package: IS_DEV
        ? 'com.belle.app.dev'
        : IS_PREVIEW
        ? 'com.belle.app.preview'
        : 'com.belle.app',
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
      environment: IS_DEV ? 'development' : IS_PREVIEW ? 'preview' : 'production',
      eas: {
        projectId: process.env.EAS_PROJECT_ID || 'your-eas-project-id',
      },
    },
  },
};
