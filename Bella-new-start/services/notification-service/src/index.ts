import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { logger } from './utils/logger';
import { config } from './utils/config';
import notificationRoutes from './routes/notifications';
import { NotificationQueueService } from './services/queueService';
import { MatchNotificationListener } from './services/matchNotificationListener';
import { SystemNotificationScheduler } from './services/systemNotificationScheduler';
import Redis from 'ioredis';
import { LimitService } from './services/limitService';

// Load environment variables
dotenv.config();

const app = express();
const prisma = new PrismaClient();
const queueService = new NotificationQueueService(prisma);
const matchNotificationListener = new MatchNotificationListener(prisma, queueService);

// Initialize Redis for limit service
const redis = new Redis(config.redis.url, {
  password: config.redis.password || undefined,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

const limitService = new LimitService(redis);
const systemNotificationScheduler = new SystemNotificationScheduler(prisma, queueService, limitService);

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

// Manual trigger for existing matches (for testing/debugging)
app.post('/internal/notify-existing-matches', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    console.log('[NotificationService] Manual trigger for existing matches called');
    // This would need to query the queuing service database
    // For now, just return a message
    res.json({
      status: 'success',
      message: 'This endpoint would trigger notifications for existing PROPOSED matches. Implementation requires database access to queuing service.'
    });
  } catch (error) {
    console.error('[NotificationService] Error in notify-existing-matches:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to trigger notifications'
    });
  }
});

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

    const notificationSettings = await fetchNotificationSettings(userId);
    if (!shouldSendNotification(type, notificationSettings)) {
      res.json({
        status: 'success',
        notificationId: null,
        sent: false,
        skipped: true
      });
      return;
    }

    // Get user's device tokens
    const deviceTokens = await prisma.deviceToken.findMany({
      where: { 
        userId,
        isActive: true 
      }
    });

    // Always create notification record (for in-app notifications even without push tokens)
    const notification = await prisma.notification.create({
      data: {
        type,
        userId,
        title,
        body,
        data: data || {},
        totalTargets: deviceTokens.length,
        priority: 'NORMAL',
        status: deviceTokens.length > 0 ? 'PENDING' : 'SENT' // Mark as sent if no push tokens
      }
    });

    // Only queue push notification if device tokens exist
    if (deviceTokens.length > 0) {
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
    }

    res.json({
      status: 'success',
      notificationId: notification.id,
      sent: deviceTokens.length > 0
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

async function fetchNotificationSettings(userId: string): Promise<{
  all: boolean;
  newMatches: boolean;
  newMessages: boolean;
  appPromotions: boolean;
}> {
  try {
    const response = await axios.get(`${config.services.userService}/profile/internal/users/${userId}`, {
      headers: {
        'x-internal-request': 'true'
      },
      timeout: 5000
    });
    const settings = response.data?.data?.user?.notificationSettings || {};
    return {
      all: settings.all !== false,
      newMatches: settings.newMatches !== false,
      newMessages: settings.newMessages !== false,
      appPromotions: settings.appPromotions === true
    };
  } catch (error) {
    logger.warn('Failed to fetch notification settings, defaulting to enabled', { userId, error });
    return {
      all: true,
      newMatches: true,
      newMessages: true,
      appPromotions: false
    };
  }
}

function shouldSendNotification(
  type: string,
  settings: { all: boolean; newMatches: boolean; newMessages: boolean; appPromotions: boolean }
): boolean {
  if (!settings.all) return false;
  const normalized = String(type || '').toUpperCase();
  if (normalized.includes('MATCH')) return settings.newMatches;
  if (normalized.includes('MESSAGE')) return settings.newMessages;
  if (normalized.includes('PROMO') || normalized.includes('PROMOTION')) return settings.appPromotions;
  return true;
}

// 404 handler
app.use('*', (req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Stop match notification listener
  await matchNotificationListener.stop();
  
  // Stop system notification scheduler
  systemNotificationScheduler.stop();
  
  // Close database connections
  await prisma.$disconnect();
  
  // Close Redis connection
  await redis.quit();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // Stop match notification listener
  await matchNotificationListener.stop();
  
  // Stop system notification scheduler
  systemNotificationScheduler.stop();
  
  // Close database connections
  await prisma.$disconnect();
  
  // Close Redis connection
  await redis.quit();
  
  process.exit(0);
});

const PORT = config.port;

// Start server
app.listen(PORT, async () => {
  console.log(`[NotificationService] Starting notification service on port ${PORT}`);
  console.log(`[NotificationService] Environment: ${config.nodeEnv}`);
  logger.info(`Notification service running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  
  // Start match notification listener
  try {
    console.log('[NotificationService] Attempting to start match notification listener...');
    console.log('[NotificationService] Redis config:', {
      url: config.redis.url,
      hasPassword: !!config.redis.password
    });
    await matchNotificationListener.start();
    console.log('[NotificationService] Match notification listener started successfully');
    logger.info('Match notification listener started successfully');
  } catch (error: any) {
    console.error('[NotificationService] Failed to start match notification listener:', error);
    console.error('[NotificationService] Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    logger.error('Failed to start match notification listener:', error);
    // Don't exit - service can still function without match notifications
  }

  // Start system notification scheduler
  try {
    systemNotificationScheduler.start();
    console.log('[NotificationService] System notification scheduler started successfully');
    logger.info('System notification scheduler started successfully');
  } catch (error: any) {
    console.error('[NotificationService] Failed to start system notification scheduler:', error);
    logger.error('Failed to start system notification scheduler:', error);
    // Don't exit - service can still function without system notifications
  }
});