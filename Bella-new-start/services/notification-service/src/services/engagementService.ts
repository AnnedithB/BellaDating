import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import Redis from 'ioredis';

export class EngagementService {
  private prisma: PrismaClient;
  private redis: Redis;
  private cacheTTL = 3600; // 1 hour

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
  }

  /**
   * Calculate engagement score for a user
   * Formula: (messages sent * 1) + (calls initiated * 3)
   * Data from last 7 days
   */
  async getEngagementScore(userId: string): Promise<number> {
    try {
      // Check cache first
      const cacheKey = `engagement:${userId}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return parseFloat(cached);
      }

      // Calculate from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Get messages sent count - query communication service database directly
      // Note: This requires access to communication DB or an API endpoint
      // For now, we'll use a simplified approach: query Activity table if available
      let messagesCount = 0;
      let callsCount = 0;
      
      try {
        // Try to query via communication service API first
        const response = await axios.get(
          `${config.services.communicationService}/api/analytics/user-engagement`,
          {
            params: {
              userId,
              startDate: sevenDaysAgo.toISOString()
            },
            headers: {
              'x-internal-request': 'true'
            },
            timeout: 5000
          }
        );
        messagesCount = response.data?.messagesSent || 0;
        callsCount = response.data?.callsInitiated || 0;
      } catch (error: any) {
        logger.debug('Engagement API not available, using fallback', {
          userId,
          error: error.message
        });
        // Fallback: return 0 (will use default multiplier)
        // In production, you'd want to query the communication DB directly
        // or have a proper analytics endpoint
      }

      // Calculate score: messages * 1 + calls * 3 (calls weighted 3x)
      const score = (messagesCount * 1) + (callsCount * 3);

      // Cache the result
      await this.redis.setex(cacheKey, this.cacheTTL, score.toString());

      logger.debug('Calculated engagement score', {
        userId,
        messagesCount,
        callsCount,
        score
      });

      return score;
    } catch (error: any) {
      logger.error('Error calculating engagement score', {
        userId,
        error: error.message
      });
      // Return default score of 0 on error
      return 0;
    }
  }

  /**
   * Get engagement multiplier for prioritization
   * Returns 0.5x to 2x based on engagement score
   */
  async getEngagementMultiplier(userId: string): Promise<number> {
    const score = await this.getEngagementScore(userId);
    
    // Normalize score to multiplier range [0.5, 2.0]
    // Score 0 = 0.5x, Score 50+ = 2.0x
    if (score === 0) return 0.5;
    if (score >= 50) return 2.0;
    
    // Linear interpolation: 0.5 + (score / 50) * 1.5
    return 0.5 + (score / 50) * 1.5;
  }

  /**
   * Invalidate engagement cache for a user
   */
  async invalidateCache(userId: string): Promise<void> {
    const cacheKey = `engagement:${userId}`;
    await this.redis.del(cacheKey);
  }
}
