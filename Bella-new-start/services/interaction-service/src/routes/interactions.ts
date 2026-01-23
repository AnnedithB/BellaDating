import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Create a new interaction
router.post('/', async (req: Request, res: Response): Promise<void> => {
  // Extract variables outside try block so they're accessible in catch block
  const { user1Id, user2Id, callType = 'VOICE', status = 'INITIATED', roomId: providedRoomId } = req.body;

  if (!user1Id || !user2Id) {
    res.status(400).json({
      status: 'error',
      message: 'user1Id and user2Id are required'
    });
    return;
  }

  try {
    // Use provided room ID or generate a unique one
    const roomId = providedRoomId || `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // If a specific roomId was provided, check if it already exists first
    // This avoids the unique constraint error and makes the code cleaner
    if (providedRoomId) {
      const existingInteraction = await prisma.interaction.findUnique({
        where: { roomId: providedRoomId }
      });

      if (existingInteraction) {
        logger.info(`Room ID ${providedRoomId} already exists, returning existing interaction`);
        res.status(200).json({ // 200 OK because we found existing
          status: 'success',
          data: existingInteraction
        });
        return;
      }
    }

    // Create new interaction
    const interaction = await prisma.interaction.create({
      data: {
        roomId,
        user1Id,
        user2Id,
        callType: callType.toUpperCase() === 'VIDEO' ? 'VIDEO' : 'VOICE',
        status: status.toUpperCase() as any,
        startedAt: new Date()
      }
    });

    res.status(201).json({
      status: 'success',
      data: interaction
    });

  } catch (error: any) {
    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      // Unique constraint violation (roomId collision for randomly generated IDs)
      // This should be rare, but can happen with concurrent requests
      logger.warn('Room ID collision detected, generating new one', {
        roomId: providedRoomId || 'random',
        error: error.message
      });
      
      // Retry with a new roomId for random generations
      try {
        const newRoomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const interaction = await prisma.interaction.create({
          data: {
            roomId: newRoomId,
            user1Id,
            user2Id,
            callType: callType.toUpperCase() === 'VIDEO' ? 'VIDEO' : 'VOICE',
            status: status.toUpperCase() as any,
            startedAt: new Date()
          }
        });
        res.status(201).json({
          status: 'success',
          data: interaction
        });
        return;
      } catch (retryError: any) {
        logger.error('Error retrying interaction creation after collision:', retryError);
        res.status(500).json({
          status: 'error',
          message: 'Failed to create interaction after retry'
        });
        return;
      }
    }

    // Log other errors
    logger.error('Error creating interaction:', error);

    // Return more specific error message for other errors
    const errorMessage = error.message || 'Internal server error';
    res.status(500).json({
      status: 'error',
      message: errorMessage
    });
  }
});

// Get interaction details
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const interaction = await prisma.interaction.findUnique({
      where: { id },
      include: {
        callEvents: {
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
        user1Id: true,
        user2Id: true,
        status: true,
        callType: true,
        duration: true,
        videoEnabled: true,
        startedAt: true,
        endedAt: true,
        createdAt: true
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

// Update interaction (status, endedAt, etc.)
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, endedAt, duration, videoEnabled } = req.body;

    const interaction = await prisma.interaction.update({
      where: { id },
      data: {
        status: status ? String(status).toUpperCase() as any : undefined,
        endedAt: endedAt ? new Date(endedAt) : undefined,
        duration: duration ? Number(duration) : undefined,
        videoEnabled: videoEnabled !== undefined ? Boolean(videoEnabled) : undefined
      }
    });

    res.json({
      status: 'success',
      data: interaction
    });

  } catch (error) {
    logger.error('Error updating interaction:', error);
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