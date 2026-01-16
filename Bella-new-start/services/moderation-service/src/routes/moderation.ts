import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ModerationService } from '../services/moderationService';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

const router = express.Router();
const prisma = new PrismaClient();
const moderationService = new ModerationService(prisma);

// Report content
router.post('/reports', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { contentId, contentType, reason, description } = req.body;
    const reporterId = req.user?.id;

    if (!reporterId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const report = await moderationService.createReport({
      contentId,
      contentType,
      reason,
      description,
      reporterId
    });

    res.status(201).json(report);
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get moderation queue
router.get('/queue', async (req: Request, res: Response) => {
  try {
    const { status, contentType, page = 1, limit = 20 } = req.query;
    
    const filters = {
      status: status as string,
      contentType: contentType as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };

    const reports = await moderationService.getModerationQueue(filters);
    res.json(reports);
  } catch (error) {
    console.error('Error fetching moderation queue:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Moderate content
router.put('/moderate/:reportId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reportId } = req.params;
    const { action, reason } = req.body;
    const moderatorId = req.user?.id;

    if (!moderatorId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await moderationService.moderateContent(reportId, {
      action,
      reason,
      moderatorId
    });

    res.json(result);
  } catch (error) {
    console.error('Error moderating content:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;