// Lightweight push registration helper that tries to use expo-notifications when available.
// It posts device tokens to the notification-service `/device-tokens` endpoint.
import { Platform } from 'react-native';
import config from '../services/config';
import { tokenStorage } from './api';

async function safeRequire(moduleName) {
  try {
    // dynamic require to avoid failing in environments without expo
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    return require(moduleName);
  } catch (e) {
    return null;
  }
}

export async function registerForPushNotificationsAsync(userId) {
  const Notifications = await safeRequire('expo-notifications');
  const Device = await safeRequire('expo-device');
  if (!Notifications) {
    console.warn('[pushNotifications] expo-notifications not available - skipping device token registration');
    return null;
  }

  try {
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('[pushNotifications] Push permission not granted');
      return null;
    }

    // Get device push token
    let deviceToken = null;
    try {
      // getDevicePushTokenAsync returns native token (APNs/FCM) when available (EAS builds)
      const tokenResponse = await Notifications.getDevicePushTokenAsync();
      deviceToken = tokenResponse.data || tokenResponse.token || null;
    } catch (err) {
      // fallback to Expo push token (may require server translation)
      const expoTokenResp = await Notifications.getExpoPushTokenAsync();
      deviceToken = expoTokenResp.data || expoTokenResp.token || null;
    }

    if (!deviceToken) {
      console.warn('[pushNotifications] Could not obtain device push token');
      return null;
    }

    const platform = Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'ANDROID' : 'WEB';
    const appVersion = (Device && Device.osVersion) ? String(Device.osVersion) : undefined;
    const deviceModel = (Device && Device.modelName) ? String(Device.modelName) : undefined;
    const osVersion = (Device && Device.osName) ? `${Device.osName} ${Device.osBuildId || ''}`.trim() : undefined;

    const tokenData = {
      userId,
      token: deviceToken,
      platform,
      appVersion,
      deviceModel,
      osVersion
    };

    // POST to notification-service via API wrapper
    const notificationServiceUrl = config.notificationServiceUrl;
    const authToken = await tokenStorage.getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const resp = await fetch(`${notificationServiceUrl}/device-tokens`, {
      method: 'POST',
      headers,
      body: JSON.stringify(tokenData)
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.warn('[pushNotifications] failed to register device token:', resp.status, text);
      return null;
    }

    const json = await resp.json();
    console.log('[pushNotifications] registered device token id:', json.data?.deviceTokenId || json.data);
    return json;

  } catch (error) {
    console.warn('[pushNotifications] registration error:', error);
    return null;
  }
}

export default {
  registerForPushNotificationsAsync
};

