import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { NotificationQueueService } from './queueService';

interface MatchEventData {
  user1Id: string;
  user2Id: string;
  matchId: string;
  score: number;
  timestamp: string;
}

interface UserServiceResponse {
  data?: {
    name?: string;
    displayName?: string;
    profilePicture?: string;
  };
}

export class MatchNotificationListener {
  private redis: Redis;
  private prisma: PrismaClient;
  private queueService: NotificationQueueService;
  private subscriber: Redis | null = null;
  private isListening: boolean = false;

  constructor(prisma: PrismaClient, queueService: NotificationQueueService) {
    this.prisma = prisma;
    this.queueService = queueService;
    this.redis = new Redis(config.redis.url, {
      password: config.redis.password || undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3
    });
  }

  /**
   * Start listening for match events
   */
  async start(): Promise<void> {
    if (this.isListening) {
      logger.warn('Match notification listener is already running');
      console.log('[MatchNotificationListener] Already listening, skipping start');
      return;
    }

    try {
      console.log('[MatchNotificationListener] Starting match notification listener...');
      console.log('[MatchNotificationListener] Redis URL:', config.redis.url);
      
      // Create a separate Redis client for subscribing (required by Redis)
      this.subscriber = new Redis(config.redis.url, {
        password: config.redis.password || undefined,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          console.log(`[MatchNotificationListener] Redis retry attempt ${times}, delay: ${delay}ms`);
          return delay;
        },
        maxRetriesPerRequest: 3
      });

      // Handle connection events
      this.subscriber.on('connect', () => {
        console.log('[MatchNotificationListener] Redis subscriber connected');
        logger.info('Redis subscriber connected');
      });

      this.subscriber.on('ready', () => {
        console.log('[MatchNotificationListener] Redis subscriber ready');
        logger.info('Redis subscriber ready');
      });

      // Subscribe to the match event channel
      await this.subscriber.subscribe('user_matched');
      console.log('[MatchNotificationListener] Subscribed to user_matched channel');
      logger.info('Subscribed to user_matched channel');

      // Listen for messages
      this.subscriber.on('message', async (channel: string, message: string) => {
        console.log(`[MatchNotificationListener] Received message on channel: ${channel}`);
        console.log(`[MatchNotificationListener] Message content:`, message);
        if (channel === 'user_matched') {
          console.log('[MatchNotificationListener] Processing user_matched event...');
          await this.handleMatchEvent(message);
        } else {
          console.log(`[MatchNotificationListener] Ignoring message on channel: ${channel}`);
        }
      });

      // Handle connection errors
      this.subscriber.on('error', (error) => {
        console.error('[MatchNotificationListener] Redis subscriber error:', error);
        logger.error('Redis subscriber error:', error);
      });

      this.isListening = true;
      console.log('[MatchNotificationListener] Match notification listener started successfully');
      logger.info('Match notification listener started');
    } catch (error) {
      console.error('[MatchNotificationListener] Failed to start match notification listener:', error);
      logger.error('Failed to start match notification listener:', error);
      throw error;
    }
  }

  /**
   * Stop listening for match events
   */
  async stop(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    try {
      if (this.subscriber) {
        await this.subscriber.unsubscribe('user_matched');
        await this.subscriber.quit();
        this.subscriber = null;
      }
      await this.redis.quit();
      this.isListening = false;
      logger.info('Match notification listener stopped');
    } catch (error) {
      logger.error('Error stopping match notification listener:', error);
    }
  }

  /**
   * Handle incoming match event
   */
  private async handleMatchEvent(message: string): Promise<void> {
    try {
      console.log('[MatchNotificationListener] Parsing match event message...');
      const matchData: MatchEventData = JSON.parse(message);
      console.log('[MatchNotificationListener] Match event data:', JSON.stringify(matchData, null, 2));
      
      logger.info('Received match event', {
        matchId: matchData.matchId,
        user1Id: matchData.user1Id,
        user2Id: matchData.user2Id,
        score: matchData.score
      });

      // Check user notification preferences before sending
      console.log('[MatchNotificationListener] Getting user notification preferences...');
      const [user1Prefs, user2Prefs] = await Promise.all([
        this.getUserNotificationPreferences(matchData.user1Id),
        this.getUserNotificationPreferences(matchData.user2Id)
      ]);
      console.log('[MatchNotificationListener] User1 prefs:', JSON.stringify(user1Prefs, null, 2));
      console.log('[MatchNotificationListener] User2 prefs:', JSON.stringify(user2Prefs, null, 2));

      // Get partner information for notification
      console.log('[MatchNotificationListener] Getting user info...');
      const [user1Info, user2Info] = await Promise.all([
        this.getUserInfo(matchData.user1Id),
        this.getUserInfo(matchData.user2Id)
      ]);
      console.log('[MatchNotificationListener] User1 info:', JSON.stringify(user1Info, null, 2));
      console.log('[MatchNotificationListener] User2 info:', JSON.stringify(user2Info, null, 2));

      // Send notification to user1
      const user1ShouldNotify = user1Prefs?.newMatchEnabled !== false && user1Prefs?.globalEnabled !== false;
      console.log(`[MatchNotificationListener] User1 should be notified: ${user1ShouldNotify}`);
      if (user1ShouldNotify) {
        console.log(`[MatchNotificationListener] Sending notification to user1: ${matchData.user1Id}`);
        await this.sendMatchNotification(
          matchData.user1Id,
          matchData.matchId,
          user2Info,
          matchData.score
        );
        console.log(`[MatchNotificationListener] Notification sent to user1: ${matchData.user1Id}`);
      } else {
        console.log(`[MatchNotificationListener] Skipping notification to user1 (preferences disabled)`);
      }

      // Send notification to user2
      const user2ShouldNotify = user2Prefs?.newMatchEnabled !== false && user2Prefs?.globalEnabled !== false;
      console.log(`[MatchNotificationListener] User2 should be notified: ${user2ShouldNotify}`);
      if (user2ShouldNotify) {
        console.log(`[MatchNotificationListener] Sending notification to user2: ${matchData.user2Id}`);
        await this.sendMatchNotification(
          matchData.user2Id,
          matchData.matchId,
          user1Info,
          matchData.score
        );
        console.log(`[MatchNotificationListener] Notification sent to user2: ${matchData.user2Id}`);
      } else {
        console.log(`[MatchNotificationListener] Skipping notification to user2 (preferences disabled)`);
      }

      logger.info('Match notifications sent', {
        matchId: matchData.matchId,
        user1Notified: user1ShouldNotify,
        user2Notified: user2ShouldNotify
      });
      console.log('[MatchNotificationListener] Match notification handling completed');
    } catch (error) {
      logger.error('Error handling match event:', error);
    }
  }

  /**
   * Get user notification preferences
   */
  private async getUserNotificationPreferences(userId: string): Promise<any> {
    try {
      const prefs = await this.prisma.notificationPreference.findUnique({
        where: { userId }
      });

      if (!prefs) {
        // Return default preferences (enabled)
        return {
          globalEnabled: true,
          newMatchEnabled: true
        };
      }

      return prefs;
    } catch (error) {
      logger.error(`Error getting notification preferences for user ${userId}:`, error);
      // Default to enabled if error
      return {
        globalEnabled: true,
        newMatchEnabled: true
      };
    }
  }

  /**
   * Get user info for notification
   */
  private async getUserInfo(userId: string): Promise<{ name?: string; profilePicture?: string }> {
    try {
      // Get user info from user service via HTTP
      // Use internal endpoint for service-to-service calls (no auth required)
      const userServiceUrl = config.services.userService;
      const url = `${userServiceUrl}/profile/internal/users/${userId}`;
      
      console.log(`[MatchNotificationListener] Fetching user info from: ${url}`);
      
      // Use Node.js built-in fetch (available in Node 18+)
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true' // Mark as internal service call
        }
      });

      if (response.ok) {
        const result = await response.json() as any;
        console.log(`[MatchNotificationListener] User service response:`, JSON.stringify(result, null, 2));
        
        const user = result.data?.user;
        
        if (user) {
          const userName = user.name || user.displayName || user.email?.split('@')[0] || 'Someone';
          const userPicture = user.profilePicture || user.avatar || null;
          
          console.log(`[MatchNotificationListener] User info fetched successfully:`, { 
            userId, 
            name: userName, 
            hasPicture: !!userPicture 
          });
          
          return {
            name: userName,
            profilePicture: userPicture
          };
        } else {
          console.warn(`[MatchNotificationListener] User data not found in response for ${userId}`);
        }
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.warn(`[MatchNotificationListener] Failed to fetch user info: ${response.status} ${response.statusText}`, errorText);
      }
    } catch (error: any) {
      console.error(`[MatchNotificationListener] Error fetching user info for ${userId}:`, error.message || error);
      logger.warn(`Could not fetch user info for ${userId}, using defaults:`, error);
    }

    return {
      name: 'Someone',
      profilePicture: null
    };
  }

  /**
   * Send match notification to a user
   */
  private async sendMatchNotification(
    userId: string,
    matchId: string,
    partnerInfo: { name?: string; profilePicture?: string },
    matchScore: number
  ): Promise<void> {
    try {
      console.log(`[MatchNotificationListener] sendMatchNotification called for user ${userId}, match ${matchId}`);
      
      // Get user's device tokens
      console.log(`[MatchNotificationListener] Fetching device tokens for user ${userId}...`);
      const deviceTokens = await this.prisma.deviceToken.findMany({
        where: {
          userId,
          isActive: true
        }
      });
      console.log(`[MatchNotificationListener] Found ${deviceTokens.length} active device tokens for user ${userId}`);

      // Always create notification record (for in-app notifications even without push tokens)
      console.log(`[MatchNotificationListener] Creating notification record for user ${userId}...`);
      const notification = await this.prisma.notification.create({
        data: {
          type: 'NEW_MATCH',
          userId,
          title: 'New Match! 🎉',
          body: `You have a new match with ${partnerInfo.name || 'someone'}!`,
          data: {
            matchId,
            matchScore,
            partnerName: partnerInfo.name,
            partnerProfilePicture: partnerInfo.profilePicture,
            type: 'NEW_MATCH'
          },
          totalTargets: deviceTokens.length,
          priority: 'HIGH',
          status: deviceTokens.length > 0 ? 'PENDING' : 'SENT' // Mark as sent if no push tokens
        }
      });
      console.log(`[MatchNotificationListener] Notification record created: ${notification.id}`);

      // Only queue push notification if device tokens exist
      if (deviceTokens.length > 0) {
        console.log(`[MatchNotificationListener] Queueing push notification for delivery...`);
        await this.queueService.queueNotification({
          id: `match_${matchId}_${userId}_${Date.now()}`,
          notificationId: notification.id,
          deviceTokens: deviceTokens.map((token: any) => ({
            id: token.id,
            token: token.token,
            platform: token.platform,
            userId: token.userId
          })),
          payload: {
            title: 'New Match! 🎉',
            body: `You have a new match with ${partnerInfo.name || 'someone'}!`,
            data: {
              matchId,
              matchScore,
              partnerName: partnerInfo.name,
              partnerProfilePicture: partnerInfo.profilePicture,
              type: 'NEW_MATCH'
            },
            imageUrl: partnerInfo.profilePicture || undefined
          },
          retryCount: 0,
          priority: 'HIGH'
        });

        logger.info(`Match notification queued for user ${userId}`, {
          notificationId: notification.id,
          matchId
        });
        console.log(`[MatchNotificationListener] Match notification successfully queued for user ${userId}`);
      } else {
        console.log(`[MatchNotificationListener] No device tokens for user ${userId}, notification saved for in-app display`);
        logger.info(`Match notification saved (no push tokens) for user ${userId}`, {
          notificationId: notification.id,
          matchId
        });
      }
    } catch (error) {
      console.error(`[MatchNotificationListener] Error sending match notification to user ${userId}:`, error);
      logger.error(`Error sending match notification to user ${userId}:`, error);
    }
  }

  /**
   * Manually trigger notifications for existing PROPOSED matches
   * This is useful for testing or for matches created before the listener was running
   */
  async notifyExistingMatches(): Promise<void> {
    try {
      console.log('[MatchNotificationListener] Notifying existing PROPOSED matches...');
      
      // This would require access to the queuing service database
      // For now, we'll just log that this method exists
      // In production, you might want to add an endpoint to trigger this
      console.log('[MatchNotificationListener] notifyExistingMatches called - this would query match_attempts table');
      logger.info('notifyExistingMatches called - requires database access to queuing service');
    } catch (error) {
      console.error('[MatchNotificationListener] Error in notifyExistingMatches:', error);
      logger.error('Error in notifyExistingMatches:', error);
    }
  }
}

