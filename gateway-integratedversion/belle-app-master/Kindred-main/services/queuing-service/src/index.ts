import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { QueueManager } from './services/queueManager';
import { createLogger } from './utils/logger';
import queueRoutes from './routes/queue';
import matchingRoutes from './routes/matching';

const app = express();
const logger = createLogger('queuing-service');
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'success',
    data: {
      service: 'queuing-service',
      version: '1.0.0',
      status: 'healthy',
      timestamp: new Date().toISOString()
    }
  });
});

// Routes
app.use('/api/queue', queueRoutes);
app.use('/api/matching', matchingRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  QueueManager.stopMatching();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  QueueManager.stopMatching();
  process.exit(0);
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Queuing Service running on port ${PORT}`);
  
  // Start the matching process
  QueueManager.startMatching();
});

export default app;