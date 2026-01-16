import { Router, Request, Response } from 'express';
import { QueueManager } from '../services/queueManager';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger('queue-routes');

// Add user to queue (or return existing queue status if already in queue)
router.post('/join', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, intent, gender, age, latitude, longitude, interests, languages, ethnicity } = req.body;

    // Validation
    if (!userId || !intent || !gender) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required fields: userId, intent, gender'
      });
      return;
    }

    // First check if user is already in queue
    const existingStatus = await QueueManager.getQueueStatus(userId);
    if (existingStatus.inQueue) {
      // User already in queue - return their current status (this is normal behavior)
      logger.info(`User ${userId} already in queue, returning existing status`);
      res.json({
        status: 'success',
        message: 'Already in queue',
        data: {
          userId,
          intent: existingStatus.intent,
          position: existingStatus.position,
          totalInQueue: existingStatus.totalInQueue,
          enteredAt: existingStatus.enteredAt
        }
      });
      return;
    }

    const queueData = {
      userId,
      intent,
      gender,
      age,
      latitude,
      longitude,
      interests: interests || [],
      languages: languages || [],
      ethnicity
    };

    const success = await QueueManager.addUserToQueue(queueData);

    if (success) {
      // Get the queue status to return position info
      const newStatus = await QueueManager.getQueueStatus(userId);
      res.json({
        status: 'success',
        message: 'Successfully added to queue',
        data: {
          userId,
          intent,
          position: newStatus.position,
          totalInQueue: newStatus.totalInQueue,
          enteredAt: newStatus.enteredAt
        }
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: 'Failed to add user to queue'
      });
    }
  } catch (error) {
    logger.error('Error joining queue:', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Remove user from queue
router.post('/leave', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required field: userId'
      });
      return;
    }

    const success = await QueueManager.removeUserFromQueue(userId);

    if (success) {
      res.json({
        status: 'success',
        message: 'Successfully removed from queue'
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: 'Failed to remove user from queue'
      });
    }
  } catch (error) {
    logger.error('Error leaving queue:', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get queue status for user
router.get('/status/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const status = await QueueManager.getQueueStatus(userId);

    res.json({
      status: 'success',
      data: status
    });
  } catch (error) {
    logger.error('Error getting queue status:', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get queue statistics (admin only)
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await QueueManager.getQueueStats();

    res.json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    logger.error('Error getting queue stats:', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

export default router;