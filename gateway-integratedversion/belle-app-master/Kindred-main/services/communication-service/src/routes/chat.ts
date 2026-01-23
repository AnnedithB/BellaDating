import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { MessageService } from '../services/messageService';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Chat routes
router.post('/conversations', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { participant2Id, isAnonymous = true } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Create participant list
    const participants = [userId];
    if (participant2Id) {
      participants.push(participant2Id);
    }

    const conversation = await prisma.chatRoom.create({
      data: {
        roomId: `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        participant1Id: userId,
        participant2Id: participant2Id || null,
        participants: {
          create: participants.map(participantId => ({
            userId: participantId,
            role: participantId === userId ? 'ADMIN' : 'MEMBER' as any
          }))
        }
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

    logger.info('Conversation created', {
      roomId: conversation.id,
      participantCount: participants.length,
      type: conversation.type
    });

    return res.status(201).json({
      success: true,
      data: conversation
    });
  } catch (error) {
    logger.error('Error creating conversation:', error);
    return res.status(500).json({
      error: 'Failed to create conversation',
      details: process.env.NODE_ENV === 'development' ? error : undefined
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

    const conversations = await prisma.chatRoom.findMany({
      where: {
        participants: {
          some: {
            userId
          }
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
        updatedAt: 'desc'
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
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    return res.status(500).json({
      error: 'Failed to fetch conversations',
      details: process.env.NODE_ENV === 'development' ? error : undefined
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

    // Verify user is participant in conversation
    const participant = await prisma.userRoom.findFirst({
      where: {
        roomId,
        userId
      }
    });

    if (!participant) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    const whereClause: any = { roomId };
    
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

    const messageService = new MessageService(prisma, {} as any);
    const message = await messageService.sendMessage({
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      roomId,
      senderId: userId,
      content,
      messageType: type,
      timestamp: new Date(),
      metadata
    });

    return res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    return res.status(500).json({
      error: 'Failed to send message',
      details: process.env.NODE_ENV === 'development' ? error : undefined
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

export default router;