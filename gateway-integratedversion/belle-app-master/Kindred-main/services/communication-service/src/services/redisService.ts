import { createClient, RedisClientType } from 'redis';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

export class RedisService {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    try {
      this.client = createClient({
        socket: {
          host: config.redis.host,
          port: config.redis.port
        },
        password: config.redis.password,
        database: config.redis.db
      });

      this.client.on('error', (err: any) => {
        logger.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis Client Connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        logger.warn('Redis Client Disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      this.isConnected = true;
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  // Cache user connection info
  async setUserConnection(userId: string, socketId: string, roomId?: string): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      const key = `${config.redis.keyPrefix}user:${userId}`;
      const data = {
        socketId,
        isOnline: true,
        lastSeen: new Date().toISOString(),
        currentRoomId: roomId || null
      };

      await this.client.setEx(key, config.cache.ttl, JSON.stringify(data));
    } catch (error) {
      logger.error('Redis setUserConnection error:', error);
    }
  }

  async getUserConnection(userId: string): Promise<any | null> {
    if (!this.client || !this.isConnected) return null;

    try {
      const key = `${config.redis.keyPrefix}user:${userId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Redis getUserConnection error:', error);
      return null;
    }
  }

  async removeUserConnection(userId: string): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      const key = `${config.redis.keyPrefix}user:${userId}`;
      await this.client.del(key);
    } catch (error) {
      logger.error('Redis removeUserConnection error:', error);
    }
  }

  // Cache room participants
  async addUserToRoom(roomId: string, userId: string): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      const key = `${config.redis.keyPrefix}room:${roomId}:users`;
      await this.client.sAdd(key, userId);
      await this.client.expire(key, config.cache.ttl);
    } catch (error) {
      logger.error('Redis addUserToRoom error:', error);
    }
  }

  async removeUserFromRoom(roomId: string, userId: string): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      const key = `${config.redis.keyPrefix}room:${roomId}:users`;
      await this.client.sRem(key, userId);
    } catch (error) {
      logger.error('Redis removeUserFromRoom error:', error);
    }
  }

  async getRoomUsers(roomId: string): Promise<string[]> {
    if (!this.client || !this.isConnected) return [];

    try {
      const key = `${config.redis.keyPrefix}room:${roomId}:users`;
      return await this.client.sMembers(key);
    } catch (error) {
      logger.error('Redis getRoomUsers error:', error);
      return [];
    }
  }

  // Cache recent messages
  async cacheMessage(roomId: string, message: any): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      const key = `${config.redis.keyPrefix}room:${roomId}:messages`;
      await this.client.lPush(key, JSON.stringify(message));
      await this.client.lTrim(key, 0, 49); // Keep last 50 messages
      await this.client.expire(key, config.cache.ttl);
    } catch (error) {
      logger.error('Redis cacheMessage error:', error);
    }
  }

  async getCachedMessages(roomId: string, limit: number = 20): Promise<any[]> {
    if (!this.client || !this.isConnected) return [];

    try {
      const key = `${config.redis.keyPrefix}room:${roomId}:messages`;
      const messages = await this.client.lRange(key, 0, limit - 1);
      return messages.map((msg: string) => JSON.parse(msg)).reverse();
    } catch (error) {
      logger.error('Redis getCachedMessages error:', error);
      return [];
    }
  }

  // Typing indicators
  async setTypingStatus(roomId: string, userId: string, isTyping: boolean): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      const key = `${config.redis.keyPrefix}room:${roomId}:typing`;
      
      if (isTyping) {
        await this.client.setEx(`${key}:${userId}`, 10, 'true'); // 10 second timeout
      } else {
        await this.client.del(`${key}:${userId}`);
      }
    } catch (error) {
      logger.error('Redis setTypingStatus error:', error);
    }
  }

  async getTypingUsers(roomId: string): Promise<string[]> {
    if (!this.client || !this.isConnected) return [];

    try {
      const pattern = `${config.redis.keyPrefix}room:${roomId}:typing:*`;
      const keys = await this.client.keys(pattern);
      return keys.map((key: string) => key.split(':').pop()!);
    } catch (error) {
      logger.error('Redis getTypingUsers error:', error);
      return [];
    }
  }

  // General cache operations
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      const prefixedKey = `${config.redis.keyPrefix}${key}`;
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ttl) {
        await this.client.setEx(prefixedKey, ttl, serializedValue);
      } else {
        await this.client.set(prefixedKey, serializedValue);
      }
    } catch (error) {
      logger.error('Redis set error:', error);
    }
  }

  async get(key: string): Promise<any | null> {
    if (!this.client || !this.isConnected) return null;

    try {
      const prefixedKey = `${config.redis.keyPrefix}${key}`;
      const value = await this.client.get(prefixedKey);
      
      if (!value) return null;
      
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.error('Redis get error:', error);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      const prefixedKey = `${config.redis.keyPrefix}${key}`;
      await this.client.del(prefixedKey);
    } catch (error) {
      logger.error('Redis del error:', error);
    }
  }

  isHealthy(): boolean {
    return this.isConnected && this.client !== null;
  }
}