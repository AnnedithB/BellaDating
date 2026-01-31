import { EngagementService } from './engagementService';
import { NotificationPayload } from '../types';

export interface PrioritizedNotification {
  notificationId: string;
  userId: string;
  payload: NotificationPayload;
  priorityScore: number;
  timestamp: number;
}

export class PriorityQueueService {
  private engagementService: EngagementService;
  private notificationQueues: Map<string, PrioritizedNotification[]> = new Map();

  constructor(engagementService: EngagementService) {
    this.engagementService = engagementService;
  }

  /**
   * Calculate priority score for a notification
   * Base score + engagement multiplier + recency bonus
   */
  async calculatePriorityScore(
    notificationType: string,
    userId: string,
    timestamp: number = Date.now()
  ): Promise<number> {
    // Base priority by type (calls weighted higher)
    let baseScore = 50; // Default for NEW_MESSAGE
    if (notificationType === 'CALL_STARTING' || notificationType === 'CALL_REQUEST') {
      baseScore = 100; // Calls are MORE IMPORTANT
    } else if (notificationType === 'CALL_MISSED') {
      baseScore = 90;
    } else if (notificationType === 'NEW_MATCH') {
      baseScore = 80;
    } else if (notificationType === 'CALL_ACCEPTED') {
      baseScore = 70;
    }

    // Get engagement multiplier (0.5x to 2x)
    const engagementMultiplier = await this.engagementService.getEngagementMultiplier(userId);

    // Recency bonus (newer = higher, max 20 points)
    const now = Date.now();
    const ageMs = now - timestamp;
    const ageMinutes = ageMs / (1000 * 60);
    const recencyBonus = Math.max(0, 20 - ageMinutes); // 20 points for immediate, 0 after 20 min

    // Calculate final score
    const score = (baseScore * engagementMultiplier) + recencyBonus;

    return Math.round(score * 100) / 100; // Round to 2 decimals
  }

  /**
   * Add notification to user's priority queue
   */
  async addToQueue(
    notificationId: string,
    userId: string,
    payload: NotificationPayload,
    timestamp: number = Date.now()
  ): Promise<void> {
    const priorityScore = await this.calculatePriorityScore(
      payload.type || 'NEW_MESSAGE',
      userId,
      timestamp
    );

    const notification: PrioritizedNotification = {
      notificationId,
      userId,
      payload,
      priorityScore,
      timestamp
    };

    if (!this.notificationQueues.has(userId)) {
      this.notificationQueues.set(userId, []);
    }

    const queue = this.notificationQueues.get(userId)!;
    queue.push(notification);

    // Sort by priority (highest first)
    queue.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Get top N notifications from user's queue
   */
  getTopNotifications(userId: string, limit: number): PrioritizedNotification[] {
    const queue = this.notificationQueues.get(userId);
    if (!queue) return [];

    return queue.slice(0, limit);
  }

  /**
   * Remove notification from queue
   */
  removeFromQueue(userId: string, notificationId: string): void {
    const queue = this.notificationQueues.get(userId);
    if (!queue) return;

    const index = queue.findIndex(n => n.notificationId === notificationId);
    if (index !== -1) {
      queue.splice(index, 1);
    }
  }

  /**
   * Clear user's queue
   */
  clearQueue(userId: string): void {
    this.notificationQueues.delete(userId);
  }

  /**
   * Get queue size for user
   */
  getQueueSize(userId: string): number {
    const queue = this.notificationQueues.get(userId);
    return queue ? queue.length : 0;
  }
}
