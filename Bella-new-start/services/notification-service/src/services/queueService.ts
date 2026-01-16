import Queue from 'bull';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { FCMService } from './fcmService';
import { APNSService } from './apnsService';
import { 
  BatchNotificationJob, 
  NotificationDeliveryResult, 
  NotificationPayload,
  NotificationPreferences 
} from '../types';

export class NotificationQueueService {
  private notificationQueue!: Queue.Queue;
  private prisma: PrismaClient;
  private fcmService: FCMService;
  private apnsService: APNSService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.fcmService = new FCMService();
    this.apnsService = new APNSService();
    this.initializeQueue();
  }

  private initializeQueue(): void {
    this.notificationQueue = new Queue('notification processing', config.redis.url, {
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: config.notification.maxRetryAttempts,
        backoff: {
          type: 'exponential',
          delay: config.notification.retryDelayMs
        }
      }
    });

    // Process notification jobs
    this.notificationQueue.process('send-notification', config.notification.queueConcurrency, this.processNotificationJob.bind(this));

    // Queue event handlers
    this.notificationQueue.on('completed', (job, result) => {
      logger.info(`Notification job completed`, {
        jobId: job.id,
        notificationId: job.data.notificationId,
        results: result
      });
    });

    this.notificationQueue.on('failed', (job, err) => {
      logger.error(`Notification job failed`, {
        jobId: job.id,
        notificationId: job.data.notificationId,
        error: err.message,
        attempts: job.attemptsMade
      });
    });

    this.notificationQueue.on('stalled', (job) => {
      logger.warn(`Notification job stalled`, {
        jobId: job.id,
        notificationId: job.data.notificationId
      });
    });

    logger.info('Notification queue service initialized');
  }

  async queueNotification(job: BatchNotificationJob): Promise<void> {
    const priority = this.getPriorityValue(job.priority);
    
    await this.notificationQueue.add('send-notification', job, {
      priority,
      delay: 0,
      attempts: config.notification.maxRetryAttempts
    });

    logger.info(`Notification job queued`, {
      jobId: job.id,
      notificationId: job.notificationId,
      deviceCount: job.deviceTokens.length,
      priority: job.priority
    });
  }

  private async processNotificationJob(job: Queue.Job<BatchNotificationJob>): Promise<NotificationDeliveryResult[]> {
    const { notificationId, deviceTokens, payload, retryCount } = job.data;
    
    logger.info(`Processing notification job`, {
      jobId: job.id,
      notificationId,
      deviceCount: deviceTokens.length,
      retryCount
    });

    const results: NotificationDeliveryResult[] = [];

    try {
      // Group device tokens by platform
      const tokensByPlatform = this.groupTokensByPlatform(deviceTokens);

      // Send to Android devices via FCM
      if (tokensByPlatform.android.length > 0) {
        const androidResults = await this.sendToAndroidDevices(
          tokensByPlatform.android,
          payload
        );
        results.push(...androidResults);
      }

      // Send to iOS devices via FCM (preferred) or APNs
      if (tokensByPlatform.ios.length > 0) {
        const iosResults = await this.sendToiOSDevices(
          tokensByPlatform.ios,
          payload
        );
        results.push(...iosResults);
      }

      // Send to Web devices via FCM
      if (tokensByPlatform.web.length > 0) {
        const webResults = await this.sendToWebDevices(
          tokensByPlatform.web,
          payload
        );
        results.push(...webResults);
      }

      // Update delivery records in database
      await this.updateDeliveryRecords(notificationId, results);

      // Update notification statistics
      await this.updateNotificationStats(notificationId, results);

      return results;

    } catch (error: any) {
      logger.error(`Notification job processing failed`, {
        jobId: job.id,
        notificationId,
        error: error.message
      });

      // Mark all as failed
      const failedResults = deviceTokens.map(token => ({
        deviceTokenId: token.id,
        userId: token.userId,
        status: 'FAILED' as const,
        errorMessage: error.message
      }));

      await this.updateDeliveryRecords(notificationId, failedResults);
      return failedResults;
    }
  }

  private groupTokensByPlatform(deviceTokens: Array<{
    id: string;
    token: string;
    platform: 'IOS' | 'ANDROID' | 'WEB';
    userId: string;
  }>) {
    return {
      android: deviceTokens.filter(t => t.platform === 'ANDROID'),
      ios: deviceTokens.filter(t => t.platform === 'IOS'),
      web: deviceTokens.filter(t => t.platform === 'WEB')
    };
  }

  private async sendToAndroidDevices(
    devices: Array<{ id: string; token: string; userId: string }>,
    payload: NotificationPayload
  ): Promise<NotificationDeliveryResult[]> {
    const tokens = devices.map(d => d.token);
    
    const fcmMessage = {
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl
      },
      data: payload.data ? this.convertDataToStringMap(payload.data) : undefined,
      android: {
        priority: payload.sound === 'critical' ? 'high' : 'normal' as 'high' | 'normal',
        notification: {
          sound: payload.sound || 'default',
          clickAction: payload.clickAction || 'FLUTTER_NOTIFICATION_CLICK',
          channelId: 'default'
        }
      }
    };

    const results = await this.fcmService.sendToMultipleTokens(tokens, fcmMessage);

    // Map results back to device info
    return results.map((result, index) => ({
      ...result,
      deviceTokenId: devices[index].id,
      userId: devices[index].userId
    }));
  }

  private async sendToiOSDevices(
    devices: Array<{ id: string; token: string; userId: string }>,
    payload: NotificationPayload
  ): Promise<NotificationDeliveryResult[]> {
    // Use FCM for iOS (unified approach)
    const tokens = devices.map(d => d.token);
    
    const fcmMessage = {
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl
      },
      data: payload.data ? this.convertDataToStringMap(payload.data) : undefined,
      apns: {
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body
            },
            sound: payload.sound || 'default',
            badge: payload.badge,
            'content-available': 0
          },
          deepLink: payload.deepLink
        }
      }
    };

    const results = await this.fcmService.sendToMultipleTokens(tokens, fcmMessage);

    // Map results back to device info
    return results.map((result, index) => ({
      ...result,
      deviceTokenId: devices[index].id,
      userId: devices[index].userId
    }));
  }

  private async sendToWebDevices(
    devices: Array<{ id: string; token: string; userId: string }>,
    payload: NotificationPayload
  ): Promise<NotificationDeliveryResult[]> {
    const tokens = devices.map(d => d.token);
    
    const fcmMessage = {
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl
      },
      data: payload.data ? this.convertDataToStringMap(payload.data) : undefined,
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: '/icon-192x192.png',
          image: payload.imageUrl,
          badge: payload.badge ? '/badge-72x72.png' : undefined
        },
        fcmOptions: {
          link: payload.clickAction || payload.deepLink || '/'
        }
      }
    };

    const results = await this.fcmService.sendToMultipleTokens(tokens, fcmMessage);

    // Map results back to device info
    return results.map((result, index) => ({
      ...result,
      deviceTokenId: devices[index].id,
      userId: devices[index].userId
    }));
  }

  private async updateDeliveryRecords(
    notificationId: string,
    results: NotificationDeliveryResult[]
  ): Promise<void> {
    try {
      const updates = results.map(result => 
        this.prisma.notificationDelivery.updateMany({
          where: {
            notificationId,
            deviceTokenId: result.deviceTokenId
          },
          data: {
            status: result.status,
            errorMessage: result.errorMessage,
            sentAt: result.status === 'SENT' ? new Date() : undefined
          }
        })
      );

      await this.prisma.$transaction(updates);
      
    } catch (error) {
      logger.error('Failed to update delivery records:', error);
    }
  }

  private async updateNotificationStats(
    notificationId: string,
    results: NotificationDeliveryResult[]
  ): Promise<void> {
    try {
      const successfulSends = results.filter(r => r.status === 'SENT').length;
      const failedSends = results.filter(r => r.status === 'FAILED').length;

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          successfulSends: { increment: successfulSends },
          failedSends: { increment: failedSends },
          status: successfulSends > 0 ? 'SENT' : 'FAILED',
          sentAt: successfulSends > 0 ? new Date() : undefined
        }
      });

    } catch (error) {
      logger.error('Failed to update notification stats:', error);
    }
  }

  private convertDataToStringMap(data: Record<string, any>): Record<string, string> {
    const stringMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      stringMap[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return stringMap;
  }

  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'CRITICAL': return 10;
      case 'HIGH': return 5;
      case 'NORMAL': return 0;
      case 'LOW': return -5;
      default: return 0;
    }
  }

  async getQueueStats() {
    const waiting = await this.notificationQueue.getWaiting();
    const active = await this.notificationQueue.getActive();
    const completed = await this.notificationQueue.getCompleted();
    const failed = await this.notificationQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    };
  }

  async cleanupQueue(): Promise<void> {
    await this.notificationQueue.clean(24 * 60 * 60 * 1000, 'completed'); // Remove completed jobs older than 24 hours
    await this.notificationQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'); // Remove failed jobs older than 7 days
  }

  async shutdown(): Promise<void> {
    await this.notificationQueue.close();
    this.apnsService.shutdown();
    logger.info('Notification queue service shut down');
  }
}