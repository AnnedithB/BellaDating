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
import safetyRoutes from './routes/safety';

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
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:3000',
    'http://localhost:4000',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://localhost:8083',
    'http://localhost:8084',
    'http://localhost:8085',
    'http://localhost:8086',
    'http://localhost:8087',
    'http://localhost:8088',
    'http://localhost:8089',
    'http://localhost:8090',
    'http://localhost:19006',
    'http://127.0.0.1:8081',
    'http://127.0.0.1:8082',
    'http://51.20.160.210:4000',
    'http://51.20.160.210:3000',
    'http://51.20.160.210:8081',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
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

// Serve uploaded files with explicit CORS headers
// For static files, we use a more permissive CORS policy
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
  'http://localhost:3000',
  'http://localhost:4000',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083',
  'http://localhost:8084',
  'http://localhost:8085',
  'http://localhost:8086',
  'http://localhost:8087',
  'http://localhost:8088',
  'http://localhost:8089',
  'http://localhost:8090',
  'http://localhost:19006',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8082',
  'http://51.20.160.210:4000',
  'http://51.20.160.210:3000',
  'http://51.20.160.210:8081',
];

app.use('/uploads', (req, res, next) => {
  // Set CORS headers for static files
  const origin = req.headers.origin;
  
  // Allow any origin that matches the allowed origins (or use wildcard for development)
  if (origin) {
    const isAllowed = allowedOrigins.some(allowed => {
      const normalizedAllowed = allowed.trim();
      const normalizedOrigin = origin.trim();
      // Exact match
      if (normalizedOrigin === normalizedAllowed) return true;
      // Hostname match (ignore protocol and port differences)
      try {
        const allowedUrl = new URL(normalizedAllowed);
        const originUrl = new URL(normalizedOrigin);
        return originUrl.hostname === allowedUrl.hostname;
      } catch {
        // Fallback: check if origin contains the hostname
        const allowedHost = normalizedAllowed.replace(/^https?:\/\//, '').split(':')[0];
        const originHost = normalizedOrigin.replace(/^https?:\/\//, '').split(':')[0];
        return originHost === allowedHost || originHost.includes(allowedHost) || allowedHost.includes(originHost);
      }
    });
    
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      // For development, allow localhost origins
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else if (allowedOrigins.length > 0) {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0].trim());
      }
    }
  } else if (allowedOrigins.length > 0) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0].trim());
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Content-Length');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  return next();
}, express.static(path.join(process.cwd(), 'uploads'), {
  setHeaders: (res: any, filePath: string) => {
    // Ensure CORS headers are set on static file responses
    const req = res.req;
    const origin = req?.headers?.origin;
    
    if (origin) {
      const isAllowed = allowedOrigins.some((allowed: string) => {
        const normalizedAllowed = allowed.trim();
        const normalizedOrigin = origin.trim();
        if (normalizedOrigin === normalizedAllowed) return true;
        try {
          const allowedUrl = new URL(normalizedAllowed);
          const originUrl = new URL(normalizedOrigin);
          return originUrl.hostname === allowedUrl.hostname;
        } catch {
          const allowedHost = normalizedAllowed.replace(/^https?:\/\//, '').split(':')[0];
          const originHost = normalizedOrigin.replace(/^https?:\/\//, '').split(':')[0];
          return originHost === allowedHost;
        }
      });
      
      if (isAllowed || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    }
    
    // Set correct Content-Type for images
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
    };
    
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
    
    // Set cache headers for images
    if (ext.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
    }
    
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// Routes
app.use('/auth', createAuthRoutes(prisma, redis as any, logger));
app.use('/profile', createProfileRoutes(prisma, redis as any, logger));
app.use('/safety', safetyRoutes);

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