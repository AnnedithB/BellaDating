export interface NotificationPayload {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
  clickAction?: string;
  deepLink?: string;
}

export interface SendNotificationRequest {
  type: 'NEW_MATCH' | 'NEW_MESSAGE' | 'CALL_STARTING' | 'CALL_MISSED' | 'SYSTEM_UPDATE' | 'MARKETING' | 'REMINDER';
  userId?: string;
  userIds?: string[];
  allUsers?: boolean;
  payload: NotificationPayload;
  scheduledFor?: Date;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  templateId?: string;
}

export interface FCMMessage {
  token?: string;
  tokens?: string[];
  notification: {
    title: string;
    body: string;
    imageUrl?: string;
  };
  data?: Record<string, string>;
  android?: {
    priority: 'normal' | 'high';
    notification: {
      sound: string;
      clickAction: string;
      channelId: string;
    };
  };
  apns?: {
    payload: {
      aps: {
        alert: {
          title: string;
          body: string;
        };
        sound: string;
        badge?: number;
        'content-available'?: number;
        category?: string;
      };
      deepLink?: string;
    };
  };
  webpush?: {
    notification: {
      title: string;
      body: string;
      icon?: string;
      image?: string;
      badge?: string;
      actions?: Array<{
        action: string;
        title: string;
        icon?: string;
      }>;
    };
    fcmOptions: {
      link: string;
    };
  };
}

export interface APNSMessage {
  aps: {
    alert: {
      title: string;
      body: string;
    };
    sound: string;
    badge?: number;
    'content-available'?: number;
    'mutable-content'?: number;
    category?: string;
  };
  deepLink?: string;
  customData?: Record<string, any>;
}

export interface DeviceTokenData {
  userId: string;
  token: string;
  platform: 'IOS' | 'ANDROID' | 'WEB';
  appVersion?: string;
  deviceModel?: string;
  osVersion?: string;
}

export interface NotificationPreferences {
  userId: string;
  globalEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
  newMatchEnabled: boolean;
  newMessageEnabled: boolean;
  callStartEnabled: boolean;
  marketingEnabled: boolean;
}

export interface BatchNotificationJob {
  id: string;
  notificationId: string;
  deviceTokens: Array<{
    id: string;
    token: string;
    platform: 'IOS' | 'ANDROID' | 'WEB';
    userId: string;
  }>;
  payload: NotificationPayload;
  retryCount: number;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
}

export interface NotificationDeliveryResult {
  deviceTokenId: string;
  userId: string;
  status: 'SENT' | 'FAILED' | 'DELIVERED';
  errorMessage?: string;
  messageId?: string;
}

export interface NotificationStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalClicked: number;
  deliveryRate: number;
  clickRate: number;
  failureRate: number;
  byPlatform: {
    ios: {
      sent: number;
      delivered: number;
      failed: number;
      clicked: number;
    };
    android: {
      sent: number;
      delivered: number;
      failed: number;
      clicked: number;
    };
    web: {
      sent: number;
      delivered: number;
      failed: number;
      clicked: number;
    };
  };
  byType: Record<string, {
    sent: number;
    delivered: number;
    failed: number;
    clicked: number;
  }>;
}

export interface QuietHoursCheck {
  isQuietHours: boolean;
  reason?: string;
  nextAllowedTime?: Date;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  title: string;
  body: string;
  imageUrl?: string;
  iosTitle?: string;
  iosBody?: string;
  androidTitle?: string;
  androidBody?: string;
  sound?: string;
  badge?: number;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  ttl?: number;
  clickAction?: string;
  deepLink?: string;
  actionButtons?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  isActive: boolean;
}