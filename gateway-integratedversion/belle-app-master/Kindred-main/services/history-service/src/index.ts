import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Import routes
import historyRoutes from './routes/history';
import analyticsRoutes from './routes/analytics';
import reportsRoutes from './routes/reports';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authenticateToken } from './middleware/auth';

// Import utilities
import { logger } from './utils/logger';
import { config } from './utils/config';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.allowedOrigins,
  credentials: true
}));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    service: 'history-service',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API Routes
app.use('/api/history', authenticateToken, historyRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/reports', authenticateToken, reportsRoutes);

// Error handling
app.use(errorHandler);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: any) => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

const PORT = process.env.PORT || 3007;

// Legacy endpoint for gateway compatibility - NOW PERSISTS TO DATABASE
app.post('/actions/log', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { type, userId, metadata } = req.body;

    // Map gateway action types to history-service action types
    const actionTypeMap: Record<string, string> = {
      'queue_joined': 'START_SESSION',
      'queue_left': 'END_SESSION',
      'login': 'LOGIN',
      'logout': 'LOGOUT',
      'skip_user': 'SKIP_USER',
      'report_user': 'REPORT_USER',
      'update_profile': 'UPDATE_PROFILE',
      'send_message': 'SEND_MESSAGE',
      'make_call': 'MAKE_CALL',
    };

    const actionType = actionTypeMap[type?.toLowerCase()] || 'LOGIN';

    // Persist to database
    const action = await prisma.userAction.create({
      data: {
        userId: userId || (req as any).user?.userId,
        actionType: actionType as any,
        metadata: metadata || { originalType: type },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      }
    });

    logger.info('Action persisted to database', {
      id: action.id,
      type,
      userId,
      actionType,
      metadata
    });

    res.json({ success: true, message: 'Action logged', data: { id: action.id } });
  } catch (error) {
    logger.error('Failed to log action to database:', error);
    // Still return success to not break the caller, but log the failure
    res.json({ success: true, message: 'Action logged (fallback - DB error)' });
  }
});

app.listen(PORT, () => {
  logger.info(`History service running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
});

export { app, prisma };
