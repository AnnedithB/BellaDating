import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import analyticsRoutes from './routes/analytics-new';
import winston from 'winston';

// Load environment variables
config();

// Setup logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const app = express();
const port = process.env.API_PORT || 3008;

// Initialize Prisma
export const prisma = new PrismaClient();

// Middleware
app.use(helmet());
// CORS configuration - allow frontend origin
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN,
  'http://localhost:5005',
  'http://localhost:3000',
  'https://bella-admin-panel.vercel.app', // Vercel production
  'https://*.vercel.app', // All Vercel preview deployments
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
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
      if (allowed && allowed.includes('*')) {
        // Convert wildcard pattern to regex
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
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'analytics-api',
    version: '1.0.0'
  });
});

// Routes
app.use('/kpis', analyticsRoutes);

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
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

// Start server
app.listen(port, () => {
  logger.info(`Analytics API server running on port ${port}`);
  logger.info(`Health check available at http://localhost:${port}/health`);
});

export default app;