import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const activities = await prisma.activity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return res.status(200).json({
      success: true,
      data: activities,
    });
  } catch (error) {
    logger.error('Error fetching activities:', error as Error);
    return res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

router.post('/log', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { type, title, description, metadata } = req.body || {};
    if (!type || !title) {
      return res.status(400).json({ error: 'type and title are required' });
    }

    const activity = await prisma.activity.create({
      data: {
        userId,
        type,
        title,
        description: description || null,
        metadata: metadata || null,
      },
    });

    return res.status(201).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    logger.error('Error logging activity:', error as Error);
    return res.status(500).json({ error: 'Failed to log activity' });
  }
});

// DELETE all activities for the authenticated user
router.delete('/clear', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await prisma.activity.deleteMany({
      where: { userId },
    });

    logger.info(`Deleted ${result.count} activities for user ${userId}`);

    return res.status(200).json({
      success: true,
      deletedCount: result.count,
    });
  } catch (error) {
    logger.error('Error clearing activities:', error as Error);
    return res.status(500).json({ error: 'Failed to clear activities' });
  }
});

export default router;
