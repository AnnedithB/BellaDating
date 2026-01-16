import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Get conversation analytics
router.get('/conversations/:roomId/analytics', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
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

    // Get conversation analytics
    const [messageCount, lastActivity, participantCount] = await Promise.all([
      prisma.message.count({
        where: { roomId }
      }),
      prisma.message.findFirst({
        where: { roomId },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true }
      }),
      prisma.userRoom.count({
        where: { roomId }
      })
    ]);

    // Get message type distribution
    const messageTypes = await prisma.message.groupBy({
      by: ['messageType'],
      where: { roomId },
      _count: {
        messageType: true
      }
    });

    return res.json({
      success: true,
      data: {
        roomId,
        messageCount,
        participantCount,
        lastActivity: lastActivity?.timestamp,
        messageTypes: messageTypes.map(type => ({
          type: type.messageType,
          count: type._count.messageType
        }))
      }
    });
  } catch (error) {
    logger.error('Error fetching conversation analytics:', error);
    return res.status(500).json({
      error: 'Failed to fetch analytics',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Get user message statistics
router.get('/user/statistics', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const [sentMessages, receivedMessages, conversationCount] = await Promise.all([
      prisma.message.count({
        where: { senderId: userId }
      }),
      prisma.message.count({
        where: {
          room: {
            participants: {
              some: { userId }
            }
          },
          senderId: { not: userId }
        }
      }),
      prisma.userRoom.count({
        where: { userId }
      })
    ]);

    // Get activity over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyActivity = await prisma.message.groupBy({
      by: ['timestamp'],
      where: {
        senderId: userId,
        timestamp: {
          gte: thirtyDaysAgo
        }
      },
      _count: {
        id: true
      }
    });

    return res.json({
      success: true,
      data: {
        userId,
        sentMessages,
        receivedMessages,
        conversationCount,
        dailyActivity: dailyActivity.map(day => ({
          date: day.timestamp,
          messageCount: day._count.id
        }))
      }
    });
  } catch (error) {
    logger.error('Error fetching user statistics:', error);
    return res.status(500).json({
      error: 'Failed to fetch user statistics',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

export default router;