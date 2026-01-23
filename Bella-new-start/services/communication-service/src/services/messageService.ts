import { PrismaClient } from '@prisma/client';
import { RedisService } from './redisService';
import { SocketService } from './socketService';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { MessageData } from '../types';

export class MessageService {
  constructor(
    private prisma: PrismaClient,
    private redisService: RedisService,
    private socketService?: SocketService
  ) {}

  async sendMessage(messageData: MessageData): Promise<any> {
    try {
      // Save message to database
      const message = await this.prisma.message.create({
        data: {
          messageId: messageData.messageId,
          roomId: messageData.roomId,
          senderId: messageData.senderId,
          content: messageData.content,
          messageType: messageData.messageType,
          voiceUrl: messageData.voiceUrl,
          voiceDuration: messageData.voiceDuration,
          imageUrl: messageData.imageUrl,
          replyToId: messageData.replyToId,
          timestamp: messageData.timestamp
        }
      });

      // Cache message in Redis for quick retrieval (if Redis is available)
      if (this.redisService && typeof this.redisService.cacheMessage === 'function') {
        await this.redisService.cacheMessage(messageData.roomId, message);
      }

      // Update room last activity
      await this.prisma.chatRoom.update({
        where: { roomId: messageData.roomId },
        data: { lastActivity: new Date() }
      });

      if (this.socketService) {
        const socketData = {
          id: message.id,
          messageId: message.messageId,
          senderId: message.senderId,
          conversationId: messageData.roomId,
          roomId: messageData.roomId, // Include roomId for frontend matching
          content: message.content,
          type: message.messageType,
          messageType: message.messageType, // Include both type and messageType
          metadata: messageData.metadata || null,
          voiceUrl: message.voiceUrl,
          voiceDuration: message.voiceDuration,
          imageUrl: message.imageUrl,
          timestamp: message.timestamp,
          sentAt: message.timestamp
        };
        
        logger.info('Emitting socket event for message', {
          roomId: messageData.roomId,
          messageId: message.messageId,
          senderId: message.senderId,
          conversationId: socketData.conversationId
        });
        
        // Emit to the roomId room (primary)
        this.socketService.emitToConversation(
          messageData.roomId,
          'message:received',
          socketData,
          message.senderId // Exclude sender from receiving their own message via socket
        );
        
        // Also try to find associated sessionId and emit to that room too
        // This handles cases where frontend joins with sessionId instead of roomId
        try {
          // Check if there's a sessionId in metadata
          if (messageData.metadata?.sessionId) {
            const sessionId = messageData.metadata.sessionId;
            if (sessionId && sessionId !== messageData.roomId) {
              logger.info('Also emitting to sessionId room', { 
                sessionId, 
                roomId: messageData.roomId
              });
              this.socketService.emitToConversation(
                sessionId,
                'message:received',
                {
                  ...socketData,
                  conversationId: sessionId, // Update conversationId to match the room
                  roomId: messageData.roomId // Keep roomId for reference
                },
                message.senderId
              );
            }
          }
        } catch (err) {
          // If we can't find sessionId, that's okay - we already emitted to roomId
          logger.debug('Could not emit to sessionId room', { error: err });
        }
      } else {
        logger.warn('SocketService not available, message sent but no real-time event emitted', {
          roomId: messageData.roomId,
          messageId: message.messageId
        });
      }

      logger.info('Message sent', {
        messageId: message.messageId,
        roomId: message.roomId,
        senderId: message.senderId,
        type: message.messageType,
        socketEventEmitted: !!this.socketService
      });

      return message;
    } catch (error) {
      logger.error('Failed to send message:', error);
      throw error;
    }
  }

  async getMessages(roomId: string, limit: number = 20, offset: number = 0): Promise<any[]> {
    try {
      // Try to get from cache first (if Redis is available)
      if (offset === 0 && this.redisService && typeof this.redisService.isHealthy === 'function' && this.redisService.isHealthy()) {
        const cachedMessages = await this.redisService.getCachedMessages(roomId, limit);
        if (cachedMessages.length > 0) {
          return cachedMessages;
        }
      }

      // Fallback to database
      const messages = await this.prisma.message.findMany({
        where: {
          roomId,
          isDeleted: false
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
        include: {
          replyTo: {
            select: {
              messageId: true,
              content: true,
              senderId: true,
              messageType: true
            }
          },
          reactions: {
            select: {
              userId: true,
              emoji: true
            }
          }
        }
      });

      return messages.reverse(); // Return in chronological order
    } catch (error) {
      logger.error('Failed to get messages:', error);
      throw error;
    }
  }

  async markMessageAsDelivered(messageId: string, userId: string): Promise<void> {
    try {
      await this.prisma.messageDelivery.upsert({
        where: {
          messageId_userId: {
            messageId,
            userId
          }
        },
        update: {
          status: 'DELIVERED',
          deliveredAt: new Date()
        },
        create: {
          messageId,
          userId,
          status: 'DELIVERED',
          deliveredAt: new Date()
        }
      });

      await this.prisma.message.update({
        where: { messageId },
        data: {
          isDelivered: true,
          deliveredAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to mark message as delivered:', error);
    }
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    try {
      await this.prisma.messageDelivery.upsert({
        where: {
          messageId_userId: {
            messageId,
            userId
          }
        },
        update: {
          status: 'READ',
          readAt: new Date()
        },
        create: {
          messageId,
          userId,
          status: 'READ',
          readAt: new Date()
        }
      });

      await this.prisma.message.update({
        where: { messageId },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to mark message as read:', error);
    }
  }

  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    try {
      const message = await this.prisma.message.findUnique({
        where: { messageId }
      });

      if (!message || message.senderId !== userId) {
        return false;
      }

      await this.prisma.message.update({
        where: { messageId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          content: '[Message deleted]'
        }
      });

      return true;
    } catch (error) {
      logger.error('Failed to delete message:', error);
      return false;
    }
  }

  async editMessage(messageId: string, userId: string, newContent: string): Promise<boolean> {
    try {
      const message = await this.prisma.message.findUnique({
        where: { messageId }
      });

      if (!message || message.senderId !== userId || message.messageType !== 'TEXT') {
        return false;
      }

      await this.prisma.message.update({
        where: { messageId },
        data: {
          content: newContent,
          isEdited: true,
          editedAt: new Date()
        }
      });

      return true;
    } catch (error) {
      logger.error('Failed to edit message:', error);
      return false;
    }
  }

  async addReaction(messageId: string, userId: string, emoji: string): Promise<boolean> {
    try {
      await this.prisma.messageReaction.create({
        data: {
          messageId,
          userId,
          emoji
        }
      });

      return true;
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Reaction already exists, remove it instead
        await this.prisma.messageReaction.delete({
          where: {
            messageId_userId_emoji: {
              messageId,
              userId,
              emoji
            }
          }
        });
        return false;
      }
      logger.error('Failed to add reaction:', error);
      return false;
    }
  }

  async createOrGetRoom(participant1Id: string, participant2Id?: string): Promise<string> {
    try {
      let room;

      if (participant2Id) {
        // Private room between two users
        room = await this.prisma.chatRoom.findFirst({
          where: {
            OR: [
              {
                participant1Id,
                participant2Id
              },
              {
                participant1Id: participant2Id,
                participant2Id: participant1Id
              }
            ],
            type: 'PRIVATE'
          }
        });
      }

      if (!room) {
        // Create new room
        room = await this.prisma.chatRoom.create({
          data: {
            roomId: this.generateRoomId(),
            type: participant2Id ? 'PRIVATE' : 'TEMPORARY',
            participant1Id,
            participant2Id,
            isActive: true
          }
        });

        // Add participants to room
        await this.prisma.userRoom.createMany({
          data: [
            {
              userId: participant1Id,
              roomId: room.roomId,
              role: 'MEMBER' as any
            },
            ...(participant2Id ? [{
              userId: participant2Id,
              roomId: room.roomId,
              role: 'MEMBER' as any
            }] : [])
          ]
        });
      }

      return room.roomId;
    } catch (error) {
      logger.error('Failed to create or get room:', error);
      throw error;
    }
  }

  async updateLastReadAt(roomId: string, userId: string): Promise<void> {
    try {
      await this.prisma.userRoom.update({
        where: {
          userId_roomId: {
            userId,
            roomId
          }
        },
        data: {
          lastReadAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to update last read at:', error);
    }
  }

  async getRoomParticipants(roomId: string): Promise<string[]> {
    try {
      const participants = await this.prisma.userRoom.findMany({
        where: { roomId },
        select: { userId: true }
      });

      return participants.map((p: any) => p.userId);
    } catch (error) {
      logger.error('Failed to get room participants:', error);
      return [];
    }
  }

  async checkUserAccessToRoom(roomId: string, userId: string): Promise<boolean> {
    try {
      const userRoom = await this.prisma.userRoom.findUnique({
        where: {
          userId_roomId: {
            userId,
            roomId
          }
        }
      });

      return !!userRoom && !userRoom.isBanned;
    } catch (error) {
      logger.error('Failed to check user access to room:', error);
      return false;
    }
  }

  private generateRoomId(): string {
    return `room_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    try {
      const userRooms = await this.prisma.userRoom.findMany({
        where: { userId },
        select: {
          roomId: true,
          lastReadAt: true
        }
      });

      let totalUnread = 0;

      for (const userRoom of userRooms) {
        const unreadCount = await this.prisma.message.count({
          where: {
            roomId: userRoom.roomId,
            timestamp: {
              gt: userRoom.lastReadAt
            },
            senderId: {
              not: userId
            },
            isDeleted: false
          }
        });

        totalUnread += unreadCount;
      }

      return totalUnread;
    } catch (error) {
      logger.error('Failed to get unread message count:', error);
      return 0;
    }
  }
}