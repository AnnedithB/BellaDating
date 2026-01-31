import Queue from 'bull';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { FCMService } from './fcmService';
import { APNSService } from './apnsService';
import { EngagementService } from './engagementService';
import { LimitService } from './limitService';
import { MatchFilterService } from './matchFilterService';
import { PriorityQueueService } from './priorityQueueService';
import Redis from 'ioredis';
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
  private redis: Redis;
  private engagementService: EngagementService;
  private limitService: LimitService;
  private matchFilterService: MatchFilterService;
  private priorityQueueService: PriorityQueueService;
  // Track last notification timestamps per user for rate-limiting/coalescing
  private lastNotificationTs: Map<string, number> = new Map();
  // Default rate limit for message pushes (ms)
  private MESSAGE_RATE_LIMIT_MS: number = 15000;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.fcmService = new FCMService();
    this.apnsService = new APNSService();
    
    // Initialize Redis
    this.redis = new Redis(config.redis.url, {
      password: config.redis.password || undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    // Initialize services
    this.engagementService = new EngagementService(prisma, this.redis);
    this.limitService = new LimitService(this.redis);
    this.matchFilterService = new MatchFilterService();
    this.priorityQueueService = new PriorityQueueService(this.engagementService);
    
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
    // Get notification type from notification record or payload data
    let notificationType = 'NEW_MESSAGE';
    try {
      const notification = await this.prisma.notification.findUnique({
        where: { id: job.notificationId },
        select: { type: true }
      });
      notificationType = notification?.type || job.payload.data?.type || 'NEW_MESSAGE';
    } catch (error: any) {
      // Fallback to data field
      notificationType = job.payload.data?.type || 'NEW_MESSAGE';
    }
    
    const isSystemNotification = notificationType === 'SYSTEM_UPDATE' || 
                                  notificationType === 'MARKETING' || 
                                  notificationType === 'REMINDER';

    // Group device tokens by user
    const tokensByUser = new Map<string, typeof job.deviceTokens>();
    for (const token of job.deviceTokens) {
      if (!tokensByUser.has(token.userId)) {
        tokensByUser.set(token.userId, []);
      }
      tokensByUser.get(token.userId)!.push(token);
    }

    // Process each user separately for prioritization and limits
    for (const [userId, userTokens] of tokensByUser.entries()) {
      try {
        // 1. Match filtering (skip for system notifications)
        if (!isSystemNotification) {
          const senderId = this.matchFilterService.extractSenderId(job.payload.data);
          const shouldSend = await this.matchFilterService.shouldSendNotification(
            notificationType,
            userId,
            senderId
          );

          if (!shouldSend) {
            logger.info('Notification filtered out - users not matched', {
              notificationId: job.notificationId,
              userId,
              senderId,
              type: notificationType
            });
            continue; // Skip this user
          }
        }

        // 2. Check daily limits (for calls+chats, not system notifications)
        if (!isSystemNotification) {
          const canSend = await this.limitService.canSendDailyNotification(userId);
          if (!canSend) {
            logger.info('Daily notification limit reached, skipping', {
              notificationId: job.notificationId,
              userId,
              type: notificationType,
              currentCount: await this.limitService.getDailyCount(userId)
            });
            
            // Add to priority queue for later (if limit allows later)
            await this.priorityQueueService.addToQueue(
              job.notificationId,
              userId,
              job.payload,
              Date.now()
            );
            continue; // Skip for now, will be processed later if queue allows
          }
        }

        // 3. Calculate priority score
        const priorityScore = await this.priorityQueueService.calculatePriorityScore(
          notificationType,
          userId,
          Date.now()
        );

        // 4. Queue the notification with calculated priority
        const priority = this.getPriorityValue(job.priority);
        
        // Create user-specific job
        const userJob: BatchNotificationJob = {
          ...job,
          deviceTokens: userTokens,
          priority: job.priority || (priorityScore > 80 ? 'HIGH' : priorityScore > 50 ? 'NORMAL' : 'LOW')
        };

        await this.notificationQueue.add('send-notification', userJob, {
          priority,
          delay: 0,
          attempts: config.notification.maxRetryAttempts
        });

        logger.info(`Notification job queued with prioritization`, {
          jobId: job.id,
          notificationId: job.notificationId,
          userId,
          deviceCount: userTokens.length,
          priority: userJob.priority,
          priorityScore
        });
      } catch (error: any) {
        logger.error('Error processing notification for user', {
          userId,
          notificationId: job.notificationId,
          error: error.message
        });
        // Continue with other users even if one fails
      }
    }
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
      // Sanitize payload for privacy (e.g., chat pushes should not include message text)
      const sanitizedPayload = this.sanitizePayloadForPrivacy(payload);

      // Rate-limiting for message-type notifications: if a recent notification was sent to the same user,
      // requeue the job with a delay so we avoid spamming.
      if ((sanitizedPayload.type === 'NEW_MESSAGE' || sanitizedPayload.data?.type === 'NEW_MESSAGE') && Array.isArray(deviceTokens)) {
        const now = Date.now();
        let minDelay = 0;
        const userIds = Array.from(new Set(deviceTokens.map(dt => dt.userId)));
        for (const userId of userIds) {
          const lastTs = this.lastNotificationTs.get(userId) || 0;
          const elapsed = now - lastTs;
          if (elapsed < this.MESSAGE_RATE_LIMIT_MS) {
            const needed = this.MESSAGE_RATE_LIMIT_MS - elapsed;
            if (needed > minDelay) minDelay = needed;
          }
        }
        if (minDelay > 0) {
          logger.info('Rate limit hit for NEW_MESSAGE notifications, requeuing job', { notificationId, jobId: job.id, delayMs: minDelay });
          // Requeue the same job with a delay to coalesce bursts
          await this.notificationQueue.add('send-notification', job.data, {
            priority: job.opts?.priority,
            delay: minDelay,
            attempts: Math.max(1, job.attemptsMade || 1)
          });
          return [];
        }
      }

      // Group device tokens by platform
      const tokensByPlatform = this.groupTokensByPlatform(deviceTokens);

      // Send to Android devices via FCM
      if (tokensByPlatform.android.length > 0) {
        const androidResults = await this.sendToAndroidDevices(
          tokensByPlatform.android,
          sanitizedPayload
        );
        results.push(...androidResults);
      }

      // Send to iOS devices via FCM (preferred) or APNs
      if (tokensByPlatform.ios.length > 0) {
        const iosResults = await this.sendToiOSDevices(
          tokensByPlatform.ios,
          sanitizedPayload
        );
        results.push(...iosResults);
      }

      // Send to Web devices via FCM
      if (tokensByPlatform.web.length > 0) {
        const webResults = await this.sendToWebDevices(
          tokensByPlatform.web,
          sanitizedPayload
        );
        results.push(...webResults);
      }

      // Update delivery records in database
      await this.updateDeliveryRecords(notificationId, results);

      // Update notification statistics
      await this.updateNotificationStats(notificationId, results);

      // Update limits and engagement cache after successful send
      if (results.length > 0) {
        const notificationType = sanitizedPayload.data?.type || sanitizedPayload.data?.notificationType || 'NEW_MESSAGE';
        const isSystemNotification = notificationType === 'SYSTEM_UPDATE' || 
                                     notificationType === 'MARKETING' || 
                                     notificationType === 'REMINDER';
        
        const userIds = Array.from(new Set(deviceTokens.map(dt => dt.userId)));
        const now = Date.now();

        for (const userId of userIds) {
          const userIdStr = String(userId);
          // Update lastNotificationTs for NEW_MESSAGE
          if (notificationType === 'NEW_MESSAGE' || sanitizedPayload.data?.type === 'NEW_MESSAGE') {
            this.lastNotificationTs.set(userIdStr, now);
          }

          // Increment daily count for non-system notifications
          if (!isSystemNotification) {
            await this.limitService.incrementDailyCount(userIdStr);
          } else {
            // Increment weekly system count
            await this.limitService.incrementWeeklySystemCount(userIdStr);
          }

          // Invalidate engagement cache so it recalculates
          await this.engagementService.invalidateCache(userIdStr);
        }
      }

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

  /**
   * Sanitize payload to remove message text for chat pushes and enforce privacy rules.
   * Returns a shallow-cloned sanitized payload.
   */
  private sanitizePayloadForPrivacy(payload: any) {
    const p = { ...payload };
    try {
      const pdata: any = p.data || {};
      const isNewMessage = p.type === 'NEW_MESSAGE' || pdata.type === 'NEW_MESSAGE' || (pdata && pdata.notificationType === 'NEW_MESSAGE');
      if (isNewMessage) {
        const senderName = pdata.senderName || pdata.fromName || (pdata.sender && pdata.sender.name) || 'Someone';
        const safeBody = `${senderName} sent a message`;
        p.body = safeBody;
        // Platform specific overrides
        p.iosBody = p.iosBody || safeBody;
        p.androidBody = p.androidBody || safeBody;
        // Remove any raw message content from data payload to avoid leaks
        if (p.data && typeof p.data === 'object') {
          const cleanedData = { ...(p.data as any) };
          delete cleanedData.content;
          delete cleanedData.message;
          delete cleanedData.text;
          p.data = cleanedData;
        }
      }
    } catch (e) {
      logger.warn('Failed to sanitize payload for privacy:', e);
    }
    return p;
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
    await this.redis.quit();
    logger.info('Notification queue service shut down');
  }
}