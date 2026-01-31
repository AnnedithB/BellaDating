import Redis from 'ioredis';
import { logger } from '../utils/logger';

export class LimitService {
  private redis: Redis;
  private dailyLimitMin = 5;
  private dailyLimitMax = 10;
  private weeklySystemLimit = 4;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Get today's date string (YYYY-MM-DD)
   */
  private getTodayKey(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  /**
   * Get current week key (YYYY-WW format)
   */
  private getWeekKey(): string {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${week}`;
  }

  /**
   * Check if user can receive a notification (daily limit for calls+chats)
   * Returns true if under limit, false if limit reached
   */
  async canSendDailyNotification(userId: string): Promise<boolean> {
    try {
      const today = this.getTodayKey();
      const key = `notif:daily:${userId}:${today}`;
      const count = await this.redis.get(key);
      const currentCount = count ? parseInt(count, 10) : 0;

      // Randomize between min and max for each user (consistent per day)
      const userSeed = parseInt(userId.slice(-4), 16) || 0;
      const daySeed = parseInt(today.replace(/-/g, ''), 10);
      const limit = this.dailyLimitMin + ((userSeed + daySeed) % (this.dailyLimitMax - this.dailyLimitMin + 1));

      return currentCount < limit;
    } catch (error: any) {
      logger.error('Error checking daily limit', {
        userId,
        error: error.message
      });
      // On error, allow notification (fail open)
      return true;
    }
  }

  /**
   * Increment daily notification count
   */
  async incrementDailyCount(userId: string): Promise<number> {
    try {
      const today = this.getTodayKey();
      const key = `notif:daily:${userId}:${today}`;
      const count = await this.redis.incr(key);
      
      // Set expiry to end of day (midnight)
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const secondsUntilMidnight = Math.floor((midnight.getTime() - now.getTime()) / 1000);
      await this.redis.expire(key, secondsUntilMidnight);

      return count;
    } catch (error: any) {
      logger.error('Error incrementing daily count', {
        userId,
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Get current daily count
   */
  async getDailyCount(userId: string): Promise<number> {
    try {
      const today = this.getTodayKey();
      const key = `notif:daily:${userId}:${today}`;
      const count = await this.redis.get(key);
      return count ? parseInt(count, 10) : 0;
    } catch (error: any) {
      logger.error('Error getting daily count', {
        userId,
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Check if user can receive a system notification (weekly limit)
   */
  async canSendSystemNotification(userId: string): Promise<boolean> {
    try {
      const week = this.getWeekKey();
      const key = `notif:weekly:${userId}:${week}`;
      const count = await this.redis.get(key);
      const currentCount = count ? parseInt(count, 10) : 0;

      return currentCount < this.weeklySystemLimit;
    } catch (error: any) {
      logger.error('Error checking weekly system limit', {
        userId,
        error: error.message
      });
      // On error, allow notification (fail open)
      return true;
    }
  }

  /**
   * Increment weekly system notification count
   */
  async incrementWeeklySystemCount(userId: string): Promise<number> {
    try {
      const week = this.getWeekKey();
      const key = `notif:weekly:${userId}:${week}`;
      const count = await this.redis.incr(key);
      
      // Set expiry to end of week (Sunday midnight)
      const now = new Date();
      const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
      const nextSunday = new Date(now);
      nextSunday.setDate(now.getDate() + daysUntilSunday);
      nextSunday.setHours(0, 0, 0, 0);
      const secondsUntilSunday = Math.floor((nextSunday.getTime() - now.getTime()) / 1000);
      await this.redis.expire(key, secondsUntilSunday);

      return count;
    } catch (error: any) {
      logger.error('Error incrementing weekly system count', {
        userId,
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Get current weekly system count
   */
  async getWeeklySystemCount(userId: string): Promise<number> {
    try {
      const week = this.getWeekKey();
      const key = `notif:weekly:${userId}:${week}`;
      const count = await this.redis.get(key);
      return count ? parseInt(count, 10) : 0;
    } catch (error: any) {
      logger.error('Error getting weekly system count', {
        userId,
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Check if it's a weekend
   */
  isWeekend(): boolean {
    const day = new Date().getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  /**
   * Check if it's peak time (evening 6-10 PM)
   */
  isPeakTime(): boolean {
    const hour = new Date().getHours();
    return hour >= 18 && hour < 22; // 6 PM to 10 PM
  }

  /**
   * Check if it's peak time OR weekend
   */
  isPeakTimeOrWeekend(): boolean {
    return this.isPeakTime() || this.isWeekend();
  }
}
