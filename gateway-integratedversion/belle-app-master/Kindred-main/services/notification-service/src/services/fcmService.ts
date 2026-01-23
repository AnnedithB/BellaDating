import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { FCMMessage, NotificationDeliveryResult } from '../types';

export class FCMService {
  private app!: admin.app.App;
  private messaging!: admin.messaging.Messaging;

  constructor() {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    try {
      // Check if Firebase is already initialized
      if (admin.apps.length === 0) {
        const serviceAccount = {
          projectId: config.firebase.projectId,
          clientEmail: config.firebase.clientEmail,
          privateKey: config.firebase.privateKey
        } as admin.ServiceAccount;

        this.app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: config.firebase.databaseURL
        });
      } else {
        this.app = admin.apps[0] as admin.app.App;
      }

      this.messaging = admin.messaging(this.app);
      logger.info('Firebase Cloud Messaging initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Firebase:', error);
      throw new Error('Firebase initialization failed');
    }
  }

  async sendToToken(token: string, message: FCMMessage): Promise<NotificationDeliveryResult> {
    try {
      const fcmMessage: admin.messaging.Message = {
        token,
        notification: message.notification,
        data: message.data,
        android: message.android ? {
          priority: message.android.priority,
          notification: {
            sound: message.android.notification.sound,
            clickAction: message.android.notification.clickAction,
            channelId: message.android.notification.channelId
          }
        } : undefined,
        apns: message.apns ? {
          payload: message.apns.payload
        } : undefined,
        webpush: message.webpush
      };

      const response = await this.messaging.send(fcmMessage);
      
      logger.info(`FCM message sent successfully`, {
        messageId: response,
        token: token.substring(0, 20) + '...'
      });

      return {
        deviceTokenId: '', // Will be set by caller
        userId: '', // Will be set by caller
        status: 'SENT',
        messageId: response
      };

    } catch (error: any) {
      logger.error('FCM send failed:', {
        error: error.message,
        code: error.code,
        token: token.substring(0, 20) + '...'
      });

      // Handle specific FCM errors
      let errorMessage = error.message;
      if (error.code === 'messaging/registration-token-not-registered') {
        errorMessage = 'Token not registered - device may have uninstalled app';
      } else if (error.code === 'messaging/invalid-registration-token') {
        errorMessage = 'Invalid registration token format';
      } else if (error.code === 'messaging/message-rate-exceeded') {
        errorMessage = 'Message rate exceeded for this token';
      }

      return {
        deviceTokenId: '', // Will be set by caller
        userId: '', // Will be set by caller
        status: 'FAILED',
        errorMessage
      };
    }
  }

  async sendToMultipleTokens(tokens: string[], message: FCMMessage): Promise<NotificationDeliveryResult[]> {
    try {
      if (tokens.length === 0) {
        return [];
      }

      // FCM supports up to 500 tokens per batch
      const batchSize = 500;
      const results: NotificationDeliveryResult[] = [];

      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        
        const multicastMessage: admin.messaging.MulticastMessage = {
          tokens: batch,
          notification: message.notification,
          data: message.data,
          android: message.android,
          apns: message.apns,
          webpush: message.webpush
        };

        const response = await this.messaging.sendEachForMulticast(multicastMessage);
        
        // Process individual results
        response.responses.forEach((result: any, index: number) => {
          if (result.success) {
            results.push({
              deviceTokenId: '', // Will be set by caller
              userId: '', // Will be set by caller
              status: 'SENT',
              messageId: result.messageId
            });
          } else {
            let errorMessage = result.error?.message || 'Unknown error';
            if (result.error?.code === 'messaging/registration-token-not-registered') {
              errorMessage = 'Token not registered - device may have uninstalled app';
            } else if (result.error?.code === 'messaging/invalid-registration-token') {
              errorMessage = 'Invalid registration token format';
            }

            results.push({
              deviceTokenId: '', // Will be set by caller
              userId: '', // Will be set by caller
              status: 'FAILED',
              errorMessage
            });
          }
        });

        logger.info(`FCM batch sent`, {
          batchSize: batch.length,
          successCount: response.successCount,
          failureCount: response.failureCount
        });
      }

      return results;

    } catch (error: any) {
      logger.error('FCM batch send failed:', error);
      
      // Return failure results for all tokens
      return tokens.map(() => ({
        deviceTokenId: '',
        userId: '',
        status: 'FAILED' as const,
        errorMessage: error.message
      }));
    }
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      // Send a dry-run message to validate the token
      await this.messaging.send({
        token,
        notification: {
          title: 'Test',
          body: 'Test'
        }
      }); // Test send without dry-run

      return true;
    } catch (error: any) {
      if (error.code === 'messaging/registration-token-not-registered' ||
          error.code === 'messaging/invalid-registration-token') {
        return false;
      }
      // For other errors, assume token is valid
      return true;
    }
  }

  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    try {
      await this.messaging.subscribeToTopic(tokens, topic);
      logger.info(`Subscribed ${tokens.length} tokens to topic: ${topic}`);
    } catch (error) {
      logger.error(`Failed to subscribe to topic ${topic}:`, error);
      throw error;
    }
  }

  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
    try {
      await this.messaging.unsubscribeFromTopic(tokens, topic);
      logger.info(`Unsubscribed ${tokens.length} tokens from topic: ${topic}`);
    } catch (error) {
      logger.error(`Failed to unsubscribe from topic ${topic}:`, error);
      throw error;
    }
  }

  async sendToTopic(topic: string, message: Omit<FCMMessage, 'token' | 'tokens'>): Promise<string> {
    try {
      const topicMessage: admin.messaging.Message = {
        topic,
        notification: message.notification,
        data: message.data,
        android: message.android,
        apns: message.apns,
        webpush: message.webpush
      };

      const messageId = await this.messaging.send(topicMessage);
      logger.info(`Message sent to topic ${topic}`, { messageId });
      return messageId;
    } catch (error) {
      logger.error(`Failed to send to topic ${topic}:`, error);
      throw error;
    }
  }

  private formatNotificationForPlatform(
    payload: any, 
    platform: 'android' | 'ios' | 'web'
  ): Partial<FCMMessage> {
    const base = {
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl
      },
      data: payload.data || {}
    };

    switch (platform) {
      case 'android':
        return {
          ...base,
          android: {
            priority: payload.priority === 'CRITICAL' ? 'high' : 'normal',
            notification: {
              sound: payload.sound || 'default',
              clickAction: payload.clickAction || 'FLUTTER_NOTIFICATION_CLICK',
              channelId: 'default'
            }
          }
        };

      case 'ios':
        return {
          ...base,
          apns: {
            payload: {
              aps: {
                alert: {
                  title: payload.iosTitle || payload.title,
                  body: payload.iosBody || payload.body
                },
                sound: payload.sound || 'default',
                badge: payload.badge,
                'content-available': payload.contentAvailable ? 1 : 0,
                category: payload.category
              },
              deepLink: payload.deepLink
            }
          }
        };

      case 'web':
        return {
          ...base,
          webpush: {
            notification: {
              title: payload.title,
              body: payload.body,
              icon: payload.icon || '/icon-192x192.png',
              image: payload.imageUrl,
              badge: payload.badge ? '/badge-72x72.png' : undefined,
              actions: payload.actionButtons
            },
            fcmOptions: {
              link: payload.clickAction || payload.deepLink || '/'
            }
          }
        };

      default:
        return base;
    }
  }
}