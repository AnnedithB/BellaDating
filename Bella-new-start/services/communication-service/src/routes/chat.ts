import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { RedisService } from '../services/redisService';
import { MessageService } from '../services/messageService';
import { SocketService } from '../services/socketService';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();
const redisService = new RedisService();

// Initialize Redis connection (non-blocking)
redisService.connect().catch(err => {
  logger.warn('Redis connection failed in chat routes, continuing without cache:', err);
});

// This will be set by the index.ts when initializing routes
let socketServiceInstance: SocketService | undefined;
let messageServiceInstance: MessageService | undefined;

export function setServices(socketService: SocketService, messageService: MessageService): void {
  socketServiceInstance = socketService;
  messageServiceInstance = messageService;
}

// Chat routes
router.post('/conversations', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { participant2Id, isAnonymous = true } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // If participant2Id is provided, check for existing room first
    if (participant2Id) {
      const existingRoom = await prisma.chatRoom.findFirst({
        where: {
          type: 'PRIVATE',
          OR: [
            {
              participant1Id: userId,
              participant2Id: participant2Id
            },
            {
              participant1Id: participant2Id,
              participant2Id: userId
            }
          ]
        },
        include: {
          participants: {
            select: {
              userId: true,
              role: true,
              joinedAt: true
            }
          }
        }
      });

      if (existingRoom) {
        logger.info('Existing conversation found', {
          roomId: existingRoom.roomId,
          participant1: existingRoom.participant1Id,
          participant2: existingRoom.participant2Id
        });

        return res.status(200).json({
          success: true,
          data: existingRoom
        });
      }
    }

    // Create participant list
    const participants = [userId];
    if (participant2Id) {
      participants.push(participant2Id);
    }

    // Create room first, then add participants separately for better error handling
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const conversation = await prisma.chatRoom.create({
      data: {
        roomId,
        participant1Id: userId,
        participant2Id: participant2Id || null,
        type: 'PRIVATE'
      }
    });

    // Add participants separately
    try {
      await prisma.userRoom.createMany({
        data: participants.map(participantId => ({
            userId: participantId,
          roomId: conversation.roomId,
            role: participantId === userId ? 'ADMIN' : 'MEMBER' as any
        })),
        skipDuplicates: true // Skip if participant already exists
      });
    } catch (participantError: any) {
      // Log but don't fail - participants might already exist
      logger.warn('Error creating participants (may already exist):', {
        error: participantError.message,
        roomId: conversation.roomId
      });
    }

    // Fetch the conversation with participants
    const conversationWithParticipants = await prisma.chatRoom.findUnique({
      where: { roomId: conversation.roomId },
      include: {
        participants: {
          select: {
            userId: true,
            role: true,
            joinedAt: true
          }
        }
      }
    });

    logger.info('Conversation created', {
      roomId: conversation.roomId,
      participantCount: participants.length,
      type: conversation.type
    });

    return res.status(201).json({
      success: true,
      data: conversationWithParticipants || conversation
    });
  } catch (error: any) {
    logger.error('Error creating conversation:', {
      error: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
      userId: req.user?.userId,
      participant2Id: req.body?.participant2Id
    });
    
    // Check if it's a unique constraint violation (duplicate room)
    if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
      // Try to find the existing room
      try {
        const { participant2Id } = req.body;
        const userId = req.user?.userId;
        
        if (participant2Id && userId) {
          const existingRoom = await prisma.chatRoom.findFirst({
            where: {
              type: 'PRIVATE',
              OR: [
                {
                  participant1Id: userId,
                  participant2Id: participant2Id
                },
                {
                  participant1Id: participant2Id,
                  participant2Id: userId
                }
              ]
            },
            include: {
              participants: {
                select: {
                  userId: true,
                  role: true,
                  joinedAt: true
                }
              }
            }
          });

          if (existingRoom) {
            logger.info('Found existing room after constraint violation', {
              roomId: existingRoom.roomId
            });
            return res.status(200).json({
              success: true,
              data: existingRoom
            });
          }
        }
      } catch (findError: any) {
        logger.error('Error finding existing room after constraint violation:', {
          error: findError.message,
          code: findError.code
        });
      }
    }
    
    // Always return detailed error for debugging (we can restrict in production later)
    const errorDetails = {
      message: error.message,
      code: error.code,
      meta: error.meta,
      // Include Prisma error details if available
      prismaError: error.code ? {
        code: error.code,
        meta: error.meta,
        clientVersion: error.clientVersion
      } : undefined
    };
    
    logger.error('Failed to create conversation - full error details:', errorDetails);
    
    return res.status(500).json({
      error: 'Failed to create conversation',
      details: errorDetails,
      // Include helpful message based on error code
      hint: error.code === 'P2002' 
        ? 'Room may already exist between these users'
        : error.code === 'P2003'
        ? 'Foreign key constraint failed - check if users exist'
        : 'Check database connection and table existence'
    });
  }
});

router.get('/conversations', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { limit = 20, offset = 0 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // First, find rooms where user is a participant via UserRoom
    const userRooms = await prisma.userRoom.findMany({
      where: {
        userId: userId
      },
      select: {
        roomId: true
      }
    });

    const roomIds = userRooms.map(ur => ur.roomId);

    // Also find rooms where user is participant1 or participant2
    const directRooms = await prisma.chatRoom.findMany({
      where: {
        OR: [
          { participant1Id: userId },
          { participant2Id: userId }
        ]
      },
      select: {
        roomId: true
      }
    });

    const allRoomIds = [...new Set([...roomIds, ...directRooms.map(r => r.roomId)])];

    if (allRoomIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          total: 0
        }
      });
    }

    const conversations = await prisma.chatRoom.findMany({
      where: {
        roomId: {
          in: allRoomIds
        }
      },
      include: {
        participants: {
          select: {
            userId: true,
            role: true,
            joinedAt: true
          }
        },
        messages: {
          take: 1,
          orderBy: {
            timestamp: 'desc'
          },
          select: {
            id: true,
            content: true,
            messageType: true,
            timestamp: true,
            senderId: true
          }
        }
      },
      orderBy: {
        lastActivity: 'desc'
      },
      take: Number(limit),
      skip: Number(offset)
    });

    return res.json({
      success: true,
      data: conversations,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: conversations.length
      }
    });
  } catch (error: any) {
    logger.error('Error fetching conversations:', error);
    return res.status(500).json({
      error: 'Failed to fetch conversations',
      details: process.env.NODE_ENV === 'development' ? (error.message || error) : undefined
    });
  }
});

router.get('/conversations/:roomId/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before, after } = req.query;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if room exists first
    const room = await prisma.chatRoom.findFirst({
      where: { roomId }
    });

    // Verify user is participant in conversation via UserRoom
    const participant = await prisma.userRoom.findFirst({
      where: {
        roomId,
        userId
      }
    });

    // Also check if user is directly a participant in ChatRoom
    const isDirectParticipant = room && (room.participant1Id === userId || room.participant2Id === userId);

    if (!participant && !isDirectParticipant) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    // If user is direct participant but not in UserRoom, add them
    if (isDirectParticipant && !participant) {
      try {
        await prisma.userRoom.create({
          data: {
            userId,
            roomId,
            role: 'MEMBER' as any
          }
        });
      } catch (e) {
        // Ignore if already exists
      }
    }

    const whereClause: any = { 
      roomId,
      isDeleted: false // Filter out deleted messages
    };
    
    if (before) {
      whereClause.timestamp = { lt: new Date(before as string) };
    } else if (after) {
      whereClause.timestamp = { gt: new Date(after as string) };
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      select: {
        id: true,
        messageId: true,
        roomId: true,
        senderId: true,
        content: true,
        messageType: true,
        timestamp: true,
        voiceUrl: true,
        voiceDuration: true,
        imageUrl: true
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: Number(limit)
    });

    return res.json({
      success: true,
      data: messages.reverse(), // Reverse to get chronological order
      pagination: {
        limit: Number(limit),
        hasMore: messages.length === Number(limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    return res.status(500).json({
      error: 'Failed to fetch messages',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

router.post('/conversations/:roomId/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const { content, type = 'TEXT', metadata } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify room exists
    const room = await prisma.chatRoom.findUnique({
      where: { roomId }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Verify user is participant in conversation
    // Check via UserRoom table
    const participant = await prisma.userRoom.findFirst({
      where: {
        roomId,
        userId
      }
    });

    // Also check if user is participant1 or participant2 in ChatRoom
    const isDirectParticipant = room.participant1Id === userId || room.participant2Id === userId;

    if (!participant && !isDirectParticipant) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    // If user is direct participant but not in UserRoom, add them
    if (isDirectParticipant && !participant) {
      await prisma.userRoom.create({
        data: {
          userId,
          roomId,
          role: 'MEMBER' as any
        }
      });
    }

    // Use shared messageService if available, otherwise create new instance
    const messageService = messageServiceInstance || new MessageService(prisma, redisService, socketServiceInstance);
    const message = await messageService.sendMessage({
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      roomId,
      senderId: userId,
      content,
      messageType: (type || 'TEXT') as 'TEXT' | 'VOICE' | 'IMAGE' | 'EMOJI' | 'SYSTEM',
      timestamp: new Date(),
      metadata: {
        ...metadata,
        // Include roomId in metadata so we can emit to both roomId and sessionId rooms if needed
        roomId: roomId
      }
    });

    return res.status(201).json({
      success: true,
      data: message
    });
  } catch (error: any) {
    logger.error('Error sending message:', error);
    
    // Provide more detailed error information
    const errorMessage = error.message || 'Failed to send message';
    const errorDetails = process.env.NODE_ENV === 'development' 
      ? { message: errorMessage, stack: error.stack, code: error.code }
      : undefined;
    
    return res.status(500).json({
      error: 'Failed to send message',
      details: errorDetails
    });
  }
});

router.patch('/conversations/:roomId/messages/:messageId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId, messageId } = req.params;
    const { content } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        roomId,
        senderId: userId
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found or unauthorized' });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        content,
        isEdited: true,
        editedAt: new Date()
      },
      select: {
        id: true,
        messageId: true,
        roomId: true,
        senderId: true,
        content: true,
        messageType: true,
        timestamp: true,
        isEdited: true,
        editedAt: true
      }
    });

    return res.json({
      success: true,
      data: updatedMessage
    });
  } catch (error) {
    logger.error('Error updating message:', error);
    return res.status(500).json({
      error: 'Failed to update message',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

router.delete('/conversations/:roomId/messages/:messageId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId, messageId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        roomId,
        senderId: userId
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found or unauthorized' });
    }

    await prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        content: '[Message deleted]'
      }
    });

    return res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting message:', error);
    return res.status(500).json({
      error: 'Failed to delete message',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Delete all messages in a conversation
// Query param ?all=true to delete all messages (both users), otherwise only user's own messages
router.delete('/conversations/:roomId/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const { all } = req.query; // ?all=true to delete all messages in conversation
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // First check if room exists
    const room = await prisma.chatRoom.findFirst({
      where: { roomId }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if user is a participant via UserRoom table
    const participant = await prisma.userRoom.findFirst({
      where: {
        roomId,
        userId
      }
    });

    // Also check if user is directly a participant in ChatRoom (participant1Id or participant2Id)
    const isDirectParticipant = room.participant1Id === userId || room.participant2Id === userId;

    if (!participant && !isDirectParticipant) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    // If user is direct participant but not in UserRoom, add them for future
    if (isDirectParticipant && !participant) {
      try {
        await prisma.userRoom.create({
          data: {
            userId,
            roomId,
            role: 'MEMBER' as any
          }
        });
      } catch (e) {
        // Ignore if already exists
      }
    }

    // Build where clause based on whether we're deleting all messages or just user's
    const whereClause: any = {
      roomId,
      isDeleted: false
    };

    // If ?all=true, delete all messages in the conversation (for both users)
    // Otherwise, only delete messages sent by the current user
    if (all !== 'true') {
      whereClause.senderId = userId;
    }

    // Mark messages as deleted (soft delete)
    const result = await prisma.message.updateMany({
      where: whereClause,
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        content: '[Message deleted]'
      }
    });

    logger.info(`Deleted ${result.count} messages for user ${userId} in room ${roomId}`, {
      deletedAll: all === 'true',
      deletedCount: result.count
    });

    return res.json({
      success: true,
      message: `Deleted ${result.count} message(s) successfully`,
      deletedCount: result.count,
      deletedAll: all === 'true'
    });
  } catch (error) {
    logger.error('Error deleting messages:', error);
    return res.status(500).json({
      error: 'Failed to delete messages',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

export default router;