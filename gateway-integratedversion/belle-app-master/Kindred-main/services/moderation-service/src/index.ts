import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import cron from 'node-cron';

// Import routes
import moderationRoutes from './routes/moderation';
import adminRoutes from './routes/admin';
import appealsRoutes from './routes/appeals';
import statisticsRoutes from './routes/statistics';

// Import services
import { ModerationService } from './services/moderationService';
import { AlertService } from './services/alertService';
import { StatisticsService } from './services/statisticsService';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authenticateToken, requireAdmin } from './middleware/auth';

// Import utilities
import { logger } from './utils/logger';
import { config } from './utils/config';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Initialize services
const moderationService = new ModerationService(prisma);
const alertService = new AlertService(prisma);
const statisticsService = new StatisticsService(prisma);

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
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
    service: 'moderation-service',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    perspective_api: moderationService.isHealthy()
  });
});

// Moderation status endpoint
app.get('/moderation-status', authenticateToken, (req, res) => {
  res.json({
    status: 'OK',
    aiModerationEnabled: moderationService.isHealthy(),
    totalRecordsToday: 0, // Would be populated by actual service
    pendingReviews: 0
  });
});

// API Routes
app.use('/api/moderation', authenticateToken, moderationRoutes);
app.use('/api/admin', authenticateToken, requireAdmin, adminRoutes);
app.use('/api/appeals', authenticateToken, appealsRoutes);
app.use('/api/statistics', authenticateToken, requireAdmin, statisticsRoutes);

// Scheduled Tasks
// Daily statistics aggregation
cron.schedule('0 1 * * *', async () => {
  logger.info('Running daily statistics aggregation');
  try {
    await statisticsService.aggregateDailyStats();
  } catch (error) {
    logger.error('Daily statistics aggregation failed:', error as Error);
  }
});

// Clean up old moderation records (every Sunday at 2 AM)
cron.schedule('0 2 * * 0', async () => {
  logger.info('Running weekly cleanup of old moderation records');
  try {
    await statisticsService.cleanupOldRecords();
  } catch (error) {
    logger.error('Weekly cleanup failed:', error as Error);
  }
});

// Update user trust scores (every hour)
cron.schedule('0 * * * *', async () => {
  logger.info('Updating user trust scores');
  try {
    await moderationService.updateUserTrustScores();
  } catch (error) {
    logger.error('Trust score update failed:', error as Error);
  }
});

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

const PORT = config.port || 3007;

app.listen(PORT, () => {
  logger.info(`Moderation service running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`AI Moderation: ${moderationService.isHealthy() ? 'Enabled' : 'Disabled'}`);
});

export { app, prisma, moderationService, alertService, statisticsService };