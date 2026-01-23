import { PrismaClient, DatingGender } from '@prisma/client';
import Redis from 'ioredis';
import { AdvancedMatchingAlgorithm } from '../algorithms/advancedMatching';
import { createLogger } from '../utils/logger';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const logger = createLogger('queue-manager');

export interface QueueUserData {
  userId: string;
  intent: 'CASUAL' | 'FRIENDS' | 'SERIOUS' | 'NETWORKING';
  gender: DatingGender;
  age?: number;
  latitude?: number;
  longitude?: number;
  interests: string[];
  languages: string[];
  ethnicity?: string;
}

export class QueueManager {
  private static matchingInterval: NodeJS.Timeout | null = null;
  private static readonly QUEUE_KEY = 'matching_queue';
  private static readonly MATCH_BATCH_SIZE = parseInt(process.env.MATCH_BATCH_SIZE || '50');
  private static readonly MATCHING_INTERVAL = parseInt(process.env.MATCHING_INTERVAL_SECONDS || '5') * 1000;

  /**
   * Start the matching process
   */
  static startMatching() {
    if (this.matchingInterval) return;

    logger.info('Starting queue matching process');
    this.matchingInterval = setInterval(async () => {
      try {
        await this.processMatching();
      } catch (error) {
        logger.error('Error in matching process:', error as Error);
      }
    }, this.MATCHING_INTERVAL);
  }

  /**
   * Stop the matching process
   */
  static stopMatching() {
    if (this.matchingInterval) {
      clearInterval(this.matchingInterval);
      this.matchingInterval = null;
      logger.info('Stopped queue matching process');
    }
  }

  /**
   * Add user to queue
   */
  static async addUserToQueue(userData: QueueUserData): Promise<boolean> {
    try {
      // Check if user is already in queue
      const existingEntry = await prisma.queueEntry.findFirst({
        where: {
          userId: userData.userId,
          status: 'WAITING'
        }
      });

      if (existingEntry) {
        logger.warn(`User ${userData.userId} already in queue`);
        return false;
      }

      // Create queue entry
      const queueEntry = await prisma.queueEntry.create({
        data: {
          userId: userData.userId,
          intent: userData.intent,
          gender: userData.gender,
          age: userData.age,
          latitude: userData.latitude,
          longitude: userData.longitude,
          interests: userData.interests,
          languages: userData.languages,
          ethnicity: userData.ethnicity,
          status: 'WAITING',
          priority: 0,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        }
      });

      // Add to Redis queue for faster processing
      await redis.zadd(this.QUEUE_KEY, Date.now(), userData.userId);

      logger.info(`User ${userData.userId} added to queue`, { queueEntryId: queueEntry.id });
      return true;
    } catch (error) {
      logger.error(`Error adding user ${userData.userId} to queue:`, error as Error);
      return false;
    }
  }

  /**
   * Remove user from queue
   */
  static async removeUserFromQueue(userId: string): Promise<boolean> {
    try {
      // Update database
      await prisma.queueEntry.updateMany({
        where: {
          userId,
          status: 'WAITING'
        },
        data: {
          status: 'REMOVED'
        }
      });

      // Remove from Redis queue
      await redis.zrem(this.QUEUE_KEY, userId);

      logger.info(`User ${userId} removed from queue`);
      return true;
    } catch (error) {
      logger.error(`Error removing user ${userId} from queue:`, error as Error);
      return false;
    }
  }

  /**
   * Get queue status for user
   */
  static async getQueueStatus(userId: string) {
    try {
      const queueEntry = await prisma.queueEntry.findFirst({
        where: {
          userId,
          status: 'WAITING'
        }
      });

      if (!queueEntry) {
        return { inQueue: false };
      }

      // Get position in queue
      const position = await redis.zrank(this.QUEUE_KEY, userId);
      const totalInQueue = await redis.zcard(this.QUEUE_KEY);

      return {
        inQueue: true,
        position: position !== null ? position + 1 : null,
        totalInQueue,
        enteredAt: queueEntry.enteredAt,
        attempts: queueEntry.attempts,
        intent: queueEntry.intent
      };
    } catch (error) {
      logger.error(`Error getting queue status for ${userId}:`, error as Error);
      return { inQueue: false, error: 'Unable to check queue status' };
    }
  }

  /**
   * Process matching for users in queue
   */
  private static async processMatching() {
    try {
      // Get users to process from Redis queue
      const userIds = await redis.zrange(this.QUEUE_KEY, 0, this.MATCH_BATCH_SIZE - 1);
      
      if (userIds.length < 2) {
        logger.debug('Not enough users in queue for matching');
        return;
      }

      logger.info(`Processing matching for ${userIds.length} users`);

      // Group users by intent and gender for efficient matching
      const queueEntries = await prisma.queueEntry.findMany({
        where: {
          userId: { in: userIds },
          status: 'WAITING'
        }
      });

      // Group by intent for better matching
      const intentGroups = this.groupByIntent(queueEntries);

      // Process each intent group
      for (const [intent, users] of Object.entries(intentGroups)) {
        await this.processIntentGroup(intent, users as any[]);
      }

      // Clean up expired entries
      await this.cleanupExpiredEntries();

    } catch (error) {
      logger.error('Error in processMatching:', error as Error);
    }
  }

  /**
   * Group queue entries by intent
   */
  private static groupByIntent(entries: any[]) {
    return entries.reduce((groups, entry) => {
      const intent = entry.intent;
      if (!groups[intent]) groups[intent] = [];
      groups[intent].push(entry);
      return groups;
    }, {} as Record<string, any[]>);
  }

  /**
   * Process matching within an intent group
   * Uses database transactions with row locking to prevent race conditions
   */
  private static async processIntentGroup(intent: string, users: any[]) {
    try {
      // Separate by gender for female-centric matching
      const males = users.filter(u => u.gender === DatingGender.MAN);
      const females = users.filter(u => u.gender === DatingGender.WOMAN);
      const others = users.filter(u => u.gender === DatingGender.NONBINARY);

      // Prioritize female users (they get matched first)
      const prioritizedUsers = [...females, ...others, ...males];

      for (let i = 0; i < prioritizedUsers.length - 1; i++) {
        const user1 = prioritizedUsers[i];

        // Find potential matches for this user
        const candidates = prioritizedUsers.slice(i + 1).map(u => u.userId);
        const matches = await AdvancedMatchingAlgorithm.findBestMatches(
          user1.userId,
          candidates,
          5
        );

        if (matches.length > 0) {
          const bestMatch = matches[0];

          // Ensure minimum compatibility score
          if (bestMatch.score.totalScore >= 0.4) {
            // Use transaction with row locking to prevent race condition
            const matchCreated = await this.createMatchWithLock(
              user1.userId,
              bestMatch.userId,
              bestMatch.score
            );

            // If match was created, skip to next iteration
            // (both users are now matched and removed from queue)
            if (matchCreated) {
              continue;
            }
          }
        }

        // Update attempt count (only if not matched)
        try {
          await prisma.queueEntry.updateMany({
            where: {
              userId: user1.userId,
              status: 'WAITING'
            },
            data: {
              attempts: { increment: 1 },
              lastMatchAttempt: new Date()
            }
          });
        } catch (updateError) {
          // Entry may have been matched by another process, ignore
          logger.debug(`Could not update attempts for ${user1.userId}, may have been matched`);
        }
      }
    } catch (error) {
      logger.error(`Error processing intent group ${intent}:`, error as Error);
    }
  }

  /**
   * Create a match between two users with transaction and row locking
   * Returns true if match was created, false if users were already matched
   */
  private static async createMatchWithLock(
    user1Id: string,
    user2Id: string,
    score: any
  ): Promise<boolean> {
    try {
      // Use a transaction with row locking to prevent race conditions
      const result = await prisma.$transaction(async (tx) => {
        // Lock and check both users are still waiting
        // Using raw query for SELECT FOR UPDATE (row locking)
        const waitingUsers = await tx.queueEntry.findMany({
          where: {
            userId: { in: [user1Id, user2Id] },
            status: 'WAITING'
          }
        });

        // If either user is no longer waiting, abort
        if (waitingUsers.length !== 2) {
          logger.debug(`Match aborted: one or both users no longer waiting`, {
            user1Id,
            user2Id,
            waitingCount: waitingUsers.length
          });
          return null;
        }

        // Create match attempt record
        const matchAttempt = await tx.matchAttempt.create({
          data: {
            user1Id,
            user2Id,
            totalScore: score.totalScore,
            ageScore: score.ageScore,
            locationScore: score.locationScore,
            interestScore: score.interestScore,
            languageScore: score.languageScore,
            ethnicityScore: score.ethnicityScore,
            genderCompatScore: score.genderCompatScore || 0,
            relationshipIntentScore: score.relationshipIntentScore || 0,
            familyPlansScore: score.familyPlansScore || 0,
            religionScore: score.religionScore || 0,
            educationScore: score.educationScore || 0,
            politicalScore: score.politicalScore || 0,
            lifestyleScore: score.lifestyleScore || 0,
            premiumBonus: score.premiumBonus || 0,
            status: 'PROPOSED',
            algorithm: 'advanced_v1'
          }
        });

        // Update both users' queue entries to MATCHED
        await tx.queueEntry.updateMany({
          where: {
            userId: { in: [user1Id, user2Id] },
            status: 'WAITING'
          },
          data: { status: 'MATCHED' }
        });

        return matchAttempt;
      }, {
        // Set isolation level and timeout for the transaction
        isolationLevel: 'Serializable',
        timeout: 5000, // 5 second timeout
      });

      if (!result) {
        return false;
      }

      // Remove from Redis queue (outside transaction - idempotent)
      await redis.zrem(this.QUEUE_KEY, user1Id, user2Id);

      // Emit match event
      await this.emitMatchEvent(user1Id, user2Id, result.id, score.totalScore);

      logger.info(`Match created between ${user1Id} and ${user2Id}`, {
        matchAttemptId: result.id,
        score: score.totalScore
      });

      return true;
    } catch (error: any) {
      // Handle serialization failures (concurrent modification)
      if (error.code === 'P2034' || error.message?.includes('serialization')) {
        logger.debug(`Match creation failed due to concurrent modification`, {
          user1Id,
          user2Id
        });
        return false;
      }
      logger.error(`Error creating match between ${user1Id} and ${user2Id}:`, error);
      return false;
    }
  }

  /**
   * Create a match between two users (legacy - kept for compatibility)
   * @deprecated Use createMatchWithLock instead
   */
  private static async createMatch(user1Id: string, user2Id: string, score: any) {
    return this.createMatchWithLock(user1Id, user2Id, score);
  }

  /**
   * Emit match event to other services
   */
  private static async emitMatchEvent(user1Id: string, user2Id: string, matchId: string, score: number) {
    try {
      // Publish to Redis for other services to pick up
      const matchData = {
        user1Id,
        user2Id,
        matchId,
        score,
        timestamp: new Date().toISOString()
      };

      await redis.publish('user_matched', JSON.stringify(matchData));
      logger.debug('Match event emitted', matchData);
    } catch (error) {
      logger.error('Error emitting match event:', error as Error);
    }
  }

  /**
   * Clean up expired queue entries
   */
  private static async cleanupExpiredEntries() {
    try {
      const now = new Date();
      
      // Get expired entries
      const expiredEntries = await prisma.queueEntry.findMany({
        where: {
          status: 'WAITING',
          expiresAt: { lt: now }
        }
      });

      if (expiredEntries.length > 0) {
        const userIds = expiredEntries.map((e: any) => e.userId);
        
        // Update status in database
        await prisma.queueEntry.updateMany({
          where: {
            id: { in: expiredEntries.map((e: any) => e.id) }
          },
          data: { status: 'EXPIRED' }
        });

        // Remove from Redis queue
        if (userIds.length > 0) {
          await redis.zrem(this.QUEUE_KEY, ...userIds);
        }

        logger.info(`Cleaned up ${expiredEntries.length} expired queue entries`);
      }
    } catch (error) {
      logger.error('Error cleaning up expired entries:', error as Error);
    }
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats() {
    try {
      const totalWaiting = await prisma.queueEntry.count({
        where: { status: 'WAITING' }
      });

      const byIntent = await prisma.queueEntry.groupBy({
        by: ['intent'],
        where: { status: 'WAITING' },
        _count: { id: true }
      });

      const byGender = await prisma.queueEntry.groupBy({
        by: ['gender'],
        where: { status: 'WAITING' },
        _count: { id: true }
      });

      const totalMatches = await prisma.matchAttempt.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      return {
        totalWaiting,
        byIntent: byIntent.reduce((acc: any, item: any) => ({ ...acc, [item.intent]: item._count.id }), {}),
        byGender: byGender.reduce((acc: any, item: any) => ({ ...acc, [item.gender]: item._count.id }), {}),
        totalMatchesToday: totalMatches
      };
    } catch (error) {
      logger.error('Error getting queue stats:', error as Error);
      return null;
    }
  }
}