import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';

// Import local utilities
import { Logger } from './utils/logger';
import { requestId, errorHandler } from './utils/helpers';

// Import routes
import createAuthRoutes from './routes/auth';
import createProfileRoutes from './routes/profile';
import createConnectionsRoutes from './routes/connections';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = new Logger('user-service');

// Initialize Express app
const app = express();

// Initialize Prisma client
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Initialize Redis client
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Global middleware
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors());
app.use(morgan('combined'));

// Request middleware
app.use(requestId);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      service: 'user-service',
      version: '1.0.0',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.use('/auth', createAuthRoutes(prisma, redis as any, logger));
app.use('/profile', createProfileRoutes(prisma, redis as any, logger));
app.use('/connections', createConnectionsRoutes(prisma, redis as any, logger));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Not found',
    code: 'NOT_FOUND',
  });
});

// Global error handler
app.use(errorHandler);

// Start server
const PORT = parseInt(process.env.PORT || '3456');
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  try {
    // Try to connect to Redis (non-blocking)
    try {
      await redis.connect();
      logger.info('Connected to Redis');
    } catch (error) {
      logger.warn('Redis connection failed, continuing without Redis', error);
    }

    // Try to connect to database (non-blocking)
    try {
      await prisma.$connect();
      logger.info('Connected to PostgreSQL');
    } catch (error) {
      logger.warn('PostgreSQL connection failed, continuing without database', error);
    }

    // Start HTTP server
    app.listen(PORT, HOST, () => {
      logger.info(`User service started on ${HOST}:${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        host: HOST,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  try {
    await prisma.$disconnect();
    await redis.disconnect();
    logger.info('Connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error as Error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  try {
    await prisma.$disconnect();
    await redis.disconnect();
    logger.info('Connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error as Error);
    process.exit(1);
  }
});

// Start the server
startServer();