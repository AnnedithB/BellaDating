import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

export class MatchFilterService {
  /**
   * Check if two users are matched (mutual like/heart accepted)
   * Returns true if matched, false otherwise
   */
  async areUsersMatched(userId1: string, userId2: string): Promise<boolean> {
    try {
      // Query interaction service for match status
      const response = await axios.get(
        `${config.services.interactionService}/api/matches/check`,
        {
          params: {
            userId1,
            userId2
          },
          headers: {
            'x-internal-request': 'true'
          },
          timeout: 5000
        }
      );

      // Match exists if both users have accepted each other's like/heart
      const isMatched = response.data?.matched === true || 
                       response.data?.mutualLike === true ||
                       response.data?.status === 'ACCEPTED';

      return isMatched || false;
    } catch (error: any) {
      // If service unavailable or error, log and default to false (filter out)
      logger.warn('Failed to check match status, filtering out notification', {
        userId1,
        userId2,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Filter notification based on match status
   * For NEW_MESSAGE and CALL_STARTING, check if sender and recipient are matched
   */
  async shouldSendNotification(
    notificationType: string,
    recipientUserId: string,
    senderUserId?: string
  ): Promise<boolean> {
    // System notifications and matches don't need filtering
    if (
      notificationType === 'SYSTEM_UPDATE' ||
      notificationType === 'MARKETING' ||
      notificationType === 'REMINDER' ||
      notificationType === 'NEW_MATCH'
    ) {
      return true;
    }

    // For messages and calls, require match
    if (
      notificationType === 'NEW_MESSAGE' ||
      notificationType === 'CALL_STARTING' ||
      notificationType === 'CALL_REQUEST' ||
      notificationType === 'CALL_MISSED'
    ) {
      if (!senderUserId) {
        // No sender means we can't check match, filter out to be safe
        logger.warn('No senderUserId provided for match-filtered notification', {
          notificationType,
          recipientUserId
        });
        return false;
      }

      return await this.areUsersMatched(recipientUserId, senderUserId);
    }

    // For other types (CALL_ACCEPTED, CALL_DECLINED), allow by default
    return true;
  }

  /**
   * Extract sender ID from notification data
   */
  extractSenderId(data: any): string | undefined {
    if (!data) return undefined;
    
    // Try common field names
    return data.senderId || 
           data.fromUserId || 
           data.userId || 
           data.sender?.id ||
           data.fromUser?.id;
  }
}
