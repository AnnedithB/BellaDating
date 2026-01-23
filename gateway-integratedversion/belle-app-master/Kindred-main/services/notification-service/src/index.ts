import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { logger } from './utils/logger';
import { config } from './utils/config';
import notificationRoutes from './routes/notifications';
import { NotificationQueueService } from './services/queueService';

// Load environment variables
dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'notification-service',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API Routes
app.use('/api/notifications', notificationRoutes);

// Internal API for other services
app.post('/internal/send-notification', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { userId, type, title, body, data } = req.body;
    
    // This is for inter-service communication
    // Add basic validation
    if (!userId || !type || !title || !body) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required fields'
      });
      return;
    }

    // Send notification using the queue service
    const queueService = new NotificationQueueService(prisma);
    
    // Get user's device tokens
    const deviceTokens = await prisma.deviceToken.findMany({
      where: { 
        userId,
        isActive: true 
      }
    });

    if (deviceTokens.length === 0) {
      res.json({
        status: 'success',
        message: 'No active device tokens found for user',
        sent: false
      });
      return;
    }

    // Create notification record
    const notification = await prisma.notification.create({
      data: {
        type,
        userId,
        title,
        body,
        data: data || {},
        totalTargets: deviceTokens.length,
        priority: 'NORMAL'
      }
    });

    // Queue notification
    await queueService.queueNotification({
      id: `internal_${Date.now()}`,
      notificationId: notification.id,
      deviceTokens: deviceTokens.map((token: any) => ({
        id: token.id,
        token: token.token,
        platform: token.platform,
        userId: token.userId
      })),
      payload: { title, body, data },
      retryCount: 0,
      priority: 'NORMAL'
    });

    res.json({
      status: 'success',
      notificationId: notification.id,
      sent: true
    });

  } catch (error) {
    logger.error('Internal notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send notification'
    });
  }
});

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Close database connections
  await prisma.$disconnect();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // Close database connections
  await prisma.$disconnect();
  
  process.exit(0);
});

const PORT = config.port;

// Start server
app.listen(PORT, () => {
  logger.info(`Notification service running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
});