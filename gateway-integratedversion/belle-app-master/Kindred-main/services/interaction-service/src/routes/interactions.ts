import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Get interaction details
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const interaction = await prisma.interaction.findUnique({
      where: { id },
      include: {
        CallEvent: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!interaction) {
      res.status(404).json({
        status: 'error',
        message: 'Interaction not found'
      });
      return;
    }

    res.json({
      status: 'success',
      data: interaction
    });

  } catch (error) {
    logger.error('Error fetching interaction:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get user's interaction history
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const interactions = await prisma.interaction.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
      select: {
        id: true,
        roomId: true,
        status: true,
        callType: true,
        duration: true,
        videoEnabled: true,
        startedAt: true,
        endedAt: true
      }
    });

    const total = await prisma.interaction.count({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      }
    });

    res.json({
      status: 'success',
      data: {
        interactions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching user interactions:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get interaction statistics
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string)
        }
      };
    }

    const totalInteractions = await prisma.interaction.count({
      where: dateFilter
    });

    const completedInteractions = await prisma.interaction.count({
      where: {
        ...dateFilter,
        status: 'COMPLETED'
      }
    });

    const videoInteractions = await prisma.interaction.count({
      where: {
        ...dateFilter,
        videoEnabled: true
      }
    });

    const avgDuration = await prisma.interaction.aggregate({
      where: {
        ...dateFilter,
        status: 'COMPLETED',
        duration: { not: null }
      },
      _avg: {
        duration: true
      }
    });

    res.json({
      status: 'success',
      data: {
        totalInteractions,
        completedInteractions,
        videoInteractions,
        completionRate: totalInteractions > 0 ? (completedInteractions / totalInteractions * 100).toFixed(2) : 0,
        videoAdoptionRate: totalInteractions > 0 ? (videoInteractions / totalInteractions * 100).toFixed(2) : 0,
        averageDuration: avgDuration._avg.duration || 0
      }
    });

  } catch (error) {
    logger.error('Error fetching interaction stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Update interaction rating
router.patch('/:id/rating', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { qualityRating, connectionIssues } = req.body;

    const interaction = await prisma.interaction.update({
      where: { id },
      data: {
        qualityRating: qualityRating ? Number(qualityRating) : undefined,
        connectionIssues: connectionIssues !== undefined ? Boolean(connectionIssues) : undefined
      }
    });

    res.json({
      status: 'success',
      data: interaction
    });

  } catch (error) {
    logger.error('Error updating interaction rating:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

export default router;