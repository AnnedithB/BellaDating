// Stub file - connections functionality should be in interaction-service or communication-service
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../utils/logger';

const router = Router();

// This is a stub - connections should be handled by interaction-service
// Using interaction_sessions model instead of non-existent connection model
export default function createConnectionsRoutes(prisma: PrismaClient, logger: Logger) {
  router.get('/', async (req, res) => {
    try {
      // Use interaction_sessions instead of connection
      const sessions = await prisma.interaction_sessions.findMany({
        take: 10,
        orderBy: { startedAt: 'desc' }
      });
      
      res.json({
        status: 'success',
        data: sessions
      });
    } catch (error) {
      logger.error('Error fetching connections', error as Error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch connections'
      });
    }
  });

  return router;
}

