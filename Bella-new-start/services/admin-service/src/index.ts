import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { logger } from './utils/logger';
import { config } from './utils/config';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import moderationRoutes from './routes/moderation';
import settingsRoutes from './routes/settings';
import analyticsRoutes from './routes/analytics';
import supportTicketsRoutes from './routes/support-tickets';
import knowledgeBaseRoutes from './routes/knowledge-base';
import customerSupportRoutes from './routes/customer-support';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

const app = express();
const prisma = new PrismaClient();

// CORS configuration - allow frontend origin (MUST be before other middleware)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN,
  'http://localhost:5005',
  'http://localhost:3000',
  'http://localhost:8081', // Mobile app web development
  'http://localhost:19006', // Expo web
  'https://bella-admin-panel.vercel.app', // Vercel production
  'https://*.vercel.app', // All Vercel preview deployments
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or Vercel proxy)
    // Vercel proxy might not send origin header, so we allow it
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // Check exact matches
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    
    // Check wildcard patterns (e.g., https://*.vercel.app)
    const matchesWildcard = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        // Convert wildcard pattern to regex
        // https://*.vercel.app -> https://.*\.vercel\.app
        const escaped = allowed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape special chars
        const pattern = escaped.replace('\\*', '.*'); // Replace escaped * with .*
        const regex = new RegExp(`^${pattern}$`);
        const matches = regex.test(origin);
        if (matches) {
          console.log(`CORS: Wildcard match - ${origin} matches ${allowed}`);
        }
        return matches;
      }
      return false;
    });
    
    if (matchesWildcard) {
      callback(null, true);
    } else {
      // Log for debugging
      console.log('CORS blocked origin:', origin);
      console.log('Allowed origins:', allowedOrigins);
      
      // Temporarily allow all Vercel domains to debug
      if (origin && origin.includes('vercel.app')) {
        console.warn('⚠️  Temporarily allowing Vercel domain:', origin);
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));

// Security middleware (configured to not interfere with CORS)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting (skip for OPTIONS requests)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  skip: (req) => req.method === 'OPTIONS', // Skip rate limiting for preflight requests
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'healthy', 
    service: 'admin-service',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/support-tickets', supportTicketsRoutes);
app.use('/api/knowledge-base', knowledgeBaseRoutes);
app.use('/api/customer-support', customerSupportRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = config.port;

app.listen(PORT, () => {
  logger.info(`Admin service running on port ${PORT}`);
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
