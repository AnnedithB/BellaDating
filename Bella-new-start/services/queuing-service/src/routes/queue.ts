import { Router, Request, Response } from 'express';
import { QueueManager } from '../services/queueManager';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger('queue-routes');

// Add user to queue
router.post('/join', async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      userId, 
      intent, 
      gender, 
      age, 
      latitude, 
      longitude, 
      interests, 
      languages, 
      ethnicity,
      preferences // Merged preferences from GraphQL gateway (base + filter)
    } = req.body;

    logger.info('Queue join request received', {
      userId,
      intent,
      gender,
      hasInterests: !!interests,
      interestsCount: interests?.length || 0,
    });

    // Validation
    if (!userId || !intent || !gender) {
      logger.warn('Missing required fields in queue join request', {
        hasUserId: !!userId,
        hasIntent: !!intent,
        hasGender: !!gender,
      });
      res.status(400).json({
        status: 'error',
        message: 'Missing required fields: userId, intent, gender'
      });
      return;
    }

    // Validate and convert intent to enum
    const validIntents = ['CASUAL', 'FRIENDS', 'SERIOUS', 'NETWORKING'];
    const intentUpper = intent?.toUpperCase();
    if (!intentUpper || !validIntents.includes(intentUpper)) {
      logger.error('Invalid intent value', { intent, intentUpper });
      res.status(400).json({
        status: 'error',
        message: `Invalid intent value: ${intent}. Must be one of: ${validIntents.join(', ')}`
      });
      return;
    }

    // Convert gender string to DatingGender enum
    // Accept both uppercase (MAN, WOMAN, NONBINARY) and handle case-insensitive
    const genderUpper = gender?.toUpperCase();
    let genderEnum: 'MAN' | 'WOMAN' | 'NONBINARY';
    
    if (genderUpper === 'MAN') {
      genderEnum = 'MAN';
    } else if (genderUpper === 'WOMAN') {
      genderEnum = 'WOMAN';
    } else if (genderUpper === 'NONBINARY') {
      genderEnum = 'NONBINARY';
    } else {
      logger.error('Invalid gender value', { gender, genderUpper });
      res.status(400).json({
        status: 'error',
        message: `Invalid gender value: ${gender}. Must be MAN, WOMAN, or NONBINARY`
      });
      return;
    }

    const queueData = {
      userId,
      intent: intentUpper, // Use validated uppercase intent
      gender: genderEnum,
      age,
      latitude,
      longitude,
      interests: interests || [],
      languages: languages || [],
      ethnicity,
      // Store merged preferences for matching algorithm to use
      mergedPreferences: preferences || {}
    };
    
    logger.info('Queue data prepared', {
      userId,
      intent: queueData.intent,
      gender: queueData.gender,
      hasAge: !!age,
      hasLocation: !!latitude && !!longitude,
      interestsCount: queueData.interests?.length || 0,
    });

    const result = await QueueManager.addUserToQueue(queueData);

    if (result.success) {
      res.json({
        status: 'success',
        message: 'Successfully added to queue',
        data: { userId, intent }
      });
    } else {
      // Log the full error details for debugging
      logger.error('Failed to add user to queue', {
        userId,
        message: result.message,
        error: result.error,
        errorCode: result.error?.code,
        errorMessage: result.error?.message,
      });
      
      const statusCode = result.error?.code === 'P2002' ? 409 : 400; // 409 for duplicate key errors
      res.status(statusCode).json({
        status: 'error',
        message: result.message || 'Failed to add user to queue',
        error: result.error ? {
          code: result.error.code,
          message: result.error.message,
        } : undefined
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

// Skip current match and find next one
router.post('/skip', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, sessionId } = req.body;

    if (!userId) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required field: userId'
      });
      return;
    }

    const result = await QueueManager.skipMatch(userId, sessionId);

    if (result.success) {
      res.json({
        status: 'success',
        message: result.message || 'Match skipped successfully'
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: result.message || 'Failed to skip match'
      });
    }
  } catch (error) {
    logger.error('Error skipping match:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

export default router;