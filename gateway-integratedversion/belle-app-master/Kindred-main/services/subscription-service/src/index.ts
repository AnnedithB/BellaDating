import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';

// Load environment variables
dotenv.config();

// Import routes
import plansRoutes from './routes/subscription-plans';
import subscriptionsRoutes from './routes/subscriptions';
import webhooksRoutes from './routes/webhooks';
import billingRoutes from './routes/billing';
import analyticsRoutes from './routes/analytics';
import adminRoutes from './routes/admin';
import appleIapRoutes from './routes/apple-iap';

const app = express();
const prisma = new PrismaClient();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);

// Body parsing (special handling for webhooks)
app.use('/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'healthy', 
    service: 'subscription-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Routes
app.use('/api/subscription-plans', plansRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/apple-iap', appleIapRoutes);  // Apple In-App Purchase routes
app.use('/webhooks', webhooksRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({ 
    status: 'error',
    message: 'Route not found' 
  });
});

const PORT = process.env.PORT || 3006;

app.listen(PORT, () => {
  logger.info(`Subscription service running on port ${PORT}`);
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

export default app;