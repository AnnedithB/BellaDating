import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { NotificationQueueService } from './queueService';
import { LimitService } from './limitService';
import { logger } from '../utils/logger';
import axios from 'axios';
import { config } from '../utils/config';

export class SystemNotificationScheduler {
  private prisma: PrismaClient;
  private queueService: NotificationQueueService;
  private limitService: LimitService;
  private cronJob: cron.ScheduledTask | null = null;

  // Re-engagement messages
  private readonly messages = {
    3: [
      "It's been 3 days... your person is out there! 💕",
      "Come back! Your love life is waiting ✨",
      "3 days without you... find your match today 🌟"
    ],
    5: [
      "Come back! Your love life is waiting 💖",
      "Your person is out there... don't miss them! 💫",
      "5 days and counting... your match is waiting! ❤️"
    ],
    7: [
      "A week without you... find your match today 💝",
      "Your love story is waiting to begin... come back! 💕",
      "7 days... your person is still out there! ✨"
    ]
  };

  constructor(
    prisma: PrismaClient,
    queueService: NotificationQueueService,
    limitService: LimitService
  ) {
    this.prisma = prisma;
    this.queueService = queueService;
    this.limitService = limitService;
  }

  /**
   * Start the scheduler (runs every hour to check for inactive users)
   */
  start(): void {
    // Run every hour at minute 0
    this.cronJob = cron.schedule('0 * * * *', async () => {
      await this.checkAndSendReEngagementNotifications();
    });

    logger.info('System notification scheduler started');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    logger.info('System notification scheduler stopped');
  }

  /**
   * Check for inactive users and send re-engagement notifications
   */
  private async checkAndSendReEngagementNotifications(): Promise<void> {
    try {
      // Only run at peak times (evening 6-10 PM) or weekends
      if (!this.limitService.isPeakTimeOrWeekend()) {
        logger.debug('Skipping re-engagement check - not peak time');
        return;
      }

      const now = new Date();
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const fiveDaysAgo = new Date(now);
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get inactive users (no login for 3+ days)
      // Query user service for last login dates
      let inactiveUsers: Array<{ id: string; lastLogin: Date }> = [];

      try {
        const response = await axios.get(
          `${config.services.userService}/api/users/inactive`,
          {
            params: {
              daysSinceLogin: 3
            },
            headers: {
              'x-internal-request': 'true'
            },
            timeout: 10000
          }
        );
        inactiveUsers = response.data?.data || [];
      } catch (error: any) {
        logger.warn('Failed to fetch inactive users from user service', {
          error: error.message
        });
        // Fallback: query notification service DB for users with no recent activity
        // This is a simplified fallback - ideally user service should provide this
        return;
      }

      for (const user of inactiveUsers) {
        try {
          // Check weekly limit
          if (!(await this.limitService.canSendSystemNotification(user.id))) {
            continue;
          }

          const daysSinceLogin = Math.floor(
            (now.getTime() - new Date(user.lastLogin).getTime()) / (1000 * 60 * 60 * 24)
          );

          let message: string | null = null;
          let notificationType = 'REMINDER';

          // Determine which message to send based on days inactive
          if (daysSinceLogin >= 7) {
            const messages = this.messages[7];
            message = messages[Math.floor(Math.random() * messages.length)];
            notificationType = 'REMINDER';
          } else if (daysSinceLogin >= 5) {
            const messages = this.messages[5];
            message = messages[Math.floor(Math.random() * messages.length)];
            notificationType = 'REMINDER';
          } else if (daysSinceLogin >= 3) {
            const messages = this.messages[3];
            message = messages[Math.floor(Math.random() * messages.length)];
            notificationType = 'REMINDER';
          }

          if (!message) continue;

          // Get user's device tokens
          const deviceTokens = await this.prisma.deviceToken.findMany({
            where: {
              userId: user.id,
              isActive: true
            }
          });

          if (deviceTokens.length === 0) continue;

          // Create notification record
          const notification = await this.prisma.notification.create({
            data: {
              type: notificationType,
              userId: user.id,
              title: 'Come Back to Belle',
              body: message,
              data: {
                daysInactive: daysSinceLogin,
                type: 'RE_ENGAGEMENT'
              },
              priority: 'LOW',
              status: 'PENDING'
            }
          });

          // Queue for sending
          await this.queueService.queueNotification({
            id: `system_${Date.now()}_${user.id}`,
            notificationId: notification.id,
            deviceTokens: deviceTokens.map(token => ({
              id: token.id,
              token: token.token,
              platform: token.platform,
              userId: token.userId
            })),
            payload: {
              title: 'Come Back to Belle',
              body: message,
              data: {
                notificationType: notificationType,
                daysInactive: daysSinceLogin,
                type: 'RE_ENGAGEMENT'
              }
            },
            retryCount: 0,
            priority: 'LOW'
          });

          // Increment weekly system count
          await this.limitService.incrementWeeklySystemCount(user.id);

          logger.info('Scheduled re-engagement notification', {
            userId: user.id,
            daysInactive: daysSinceLogin
          });
        } catch (error: any) {
          logger.error('Error sending re-engagement notification', {
            userId: user.id,
            error: error.message
          });
        }
      }
    } catch (error: any) {
      logger.error('Error in re-engagement notification check', {
        error: error.message
      });
    }
  }
}
