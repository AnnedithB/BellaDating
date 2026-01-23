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
// CORS configuration - allow multiple origins for development
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:19006'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // In development, allow all origins
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // In production, check against allowed origins
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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
app.use('/api/apple-iap', appleIapRoutes);
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