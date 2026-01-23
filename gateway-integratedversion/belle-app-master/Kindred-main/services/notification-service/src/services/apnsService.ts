import apn from 'node-apn';
import { readFileSync } from 'fs';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { APNSMessage, NotificationDeliveryResult } from '../types';

export class APNSService {
  private provider: apn.Provider | null = null;

  constructor() {
    this.initializeAPNS();
  }

  private initializeAPNS(): void {
    try {
      if (!config.apns.privateKeyPath || 
          !config.apns.keyId || 
          !config.apns.teamId) {
        logger.warn('APNs configuration incomplete, skipping initialization');
        return;
      }

      const options: apn.ProviderOptions = {
        token: {
          key: readFileSync(config.apns.privateKeyPath, 'utf8'),
          keyId: config.apns.keyId,
          teamId: config.apns.teamId
        },
        production: config.apns.production
      };

      this.provider = new apn.Provider(options);
      logger.info('Apple Push Notification service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize APNs:', error);
      // Don't throw error, allow service to run without APNs
    }
  }

  async sendToToken(deviceToken: string, message: APNSMessage): Promise<NotificationDeliveryResult> {
    if (!this.provider) {
      return {
        deviceTokenId: '',
        userId: '',
        status: 'FAILED',
        errorMessage: 'APNs not configured'
      };
    }

    try {
      const notification = new apn.Notification();
      
      // Set basic properties
      notification.alert = message.aps.alert;
      notification.sound = message.aps.sound || 'default';
      if (message.aps.badge !== undefined) {
        notification.badge = message.aps.badge;
      }
      if (message.aps.category) {
        (notification as any).category = message.aps.category;
      }
      notification.contentAvailable = message.aps['content-available'] === 1;
      notification.mutableContent = message.aps['mutable-content'] === 1;
      
      // Set custom payload
      if (message.deepLink) {
        notification.payload.deepLink = message.deepLink;
      }
      
      if (message.customData) {
        Object.assign(notification.payload, message.customData);
      }

      // Set bundle ID
      notification.topic = config.apns.bundleId;
      
      // Set expiry (24 hours by default)
      notification.expiry = Math.floor(Date.now() / 1000) + 86400;

      const result = await this.provider.send(notification, deviceToken);
      
      if (result.sent.length > 0) {
        logger.info('APNs message sent successfully', {
          deviceToken: deviceToken.substring(0, 20) + '...',
          messageId: (result.sent[0] as any).messageId || 'unknown'
        });

        return {
          deviceTokenId: '',
          userId: '',
          status: 'SENT',
          messageId: (result.sent[0] as any).messageId || 'unknown'
        };
      } else if (result.failed.length > 0) {
        const failure = result.failed[0];
        logger.error('APNs send failed:', {
          deviceToken: deviceToken.substring(0, 20) + '...',
          error: failure.error,
          status: failure.status,
          response: failure.response
        });

        return {
          deviceTokenId: '',
          userId: '',
          status: 'FAILED',
          errorMessage: failure.error?.toString() || `Status: ${failure.status}`
        };
      } else {
        return {
          deviceTokenId: '',
          userId: '',
          status: 'FAILED',
          errorMessage: 'Unknown APNs error'
        };
      }

    } catch (error: any) {
      logger.error('APNs send exception:', {
        error: error.message,
        deviceToken: deviceToken.substring(0, 20) + '...'
      });

      return {
        deviceTokenId: '',
        userId: '',
        status: 'FAILED',
        errorMessage: error.message
      };
    }
  }

  async sendToMultipleTokens(deviceTokens: string[], message: APNSMessage): Promise<NotificationDeliveryResult[]> {
    if (!this.provider) {
      return deviceTokens.map(() => ({
        deviceTokenId: '',
        userId: '',
        status: 'FAILED' as const,
        errorMessage: 'APNs not configured'
      }));
    }

    try {
      const notification = new apn.Notification();
      
      // Set notification properties (same as single send)
      notification.alert = message.aps.alert;
      notification.sound = message.aps.sound || 'default';
      if (message.aps.badge !== undefined) {
        notification.badge = message.aps.badge;
      }
      if (message.aps.category) {
        (notification as any).category = message.aps.category;
      }
      notification.contentAvailable = message.aps['content-available'] === 1;
      notification.mutableContent = message.aps['mutable-content'] === 1;
      notification.topic = config.apns.bundleId;
      notification.expiry = Math.floor(Date.now() / 1000) + 86400;

      if (message.deepLink) {
        notification.payload.deepLink = message.deepLink;
      }
      
      if (message.customData) {
        Object.assign(notification.payload, message.customData);
      }

      const result = await this.provider.send(notification, deviceTokens);
      const results: NotificationDeliveryResult[] = [];

      // Process successful sends
      result.sent.forEach((sent: { device: string; }) => {
        results.push({
          deviceTokenId: '',
          userId: '',
          status: 'SENT',
          messageId: (sent as any).messageId || 'unknown'
        });
      });

      // Process failed sends
      result.failed.forEach((failed: { device: string; error: Error; status: string; response: any; }) => {
        results.push({
          deviceTokenId: '',
          userId: '',
          status: 'FAILED',
          errorMessage: failed.error?.toString() || `Status: ${failed.status}`
        });
      });

      logger.info('APNs batch send completed', {
        total: deviceTokens.length,
        sent: result.sent.length,
        failed: result.failed.length
      });

      return results;

    } catch (error: any) {
      logger.error('APNs batch send exception:', error);
      
      return deviceTokens.map(() => ({
        deviceTokenId: '',
        userId: '',
        status: 'FAILED' as const,
        errorMessage: error.message
      }));
    }
  }

  async validateToken(deviceToken: string): Promise<boolean> {
    if (!this.provider) {
      return false;
    }

    try {
      // Create a minimal test notification
      const testNotification = new apn.Notification();
      testNotification.alert = 'Test';
      testNotification.topic = config.apns.bundleId;
      testNotification.expiry = Math.floor(Date.now() / 1000) + 60; // 1 minute

      const result = await this.provider.send(testNotification, deviceToken);
      
      // If it was sent successfully, token is valid
      return result.sent.length > 0;
    } catch (error) {
      logger.debug('APNs token validation failed:', error);
      return false;
    }
  }

  shutdown(): void {
    if (this.provider) {
      this.provider.shutdown();
      logger.info('APNs provider shut down');
    }
  }

  private formatMessageForAPNs(payload: any): APNSMessage {
    return {
      aps: {
        alert: {
          title: payload.iosTitle || payload.title,
          body: payload.iosBody || payload.body
        },
        sound: payload.sound || 'default',
        badge: payload.badge,
        'content-available': payload.contentAvailable ? 1 : 0,
        'mutable-content': payload.mutableContent ? 1 : 0,
        category: payload.category
      },
      deepLink: payload.deepLink,
      customData: payload.customData
    };
  }
}