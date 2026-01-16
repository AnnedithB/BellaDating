import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Import routes
import chatRoutes from './routes/chat';
import uploadRoutes from './routes/upload';
import analyticsRoutes from './routes/analytics';

// Import services
import { SocketService } from './services/socketService';
import { MessageService } from './services/messageService';
import { VoiceNoteService } from './services/voiceNoteService';
import { RedisService } from './services/redisService';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authenticateToken } from './middleware/auth';

// Import utilities
import { logger } from './utils/logger';
import { config } from './utils/config';

dotenv.config();

const app = express();
const server = createServer(app);
const prisma = new PrismaClient();

// Initialize Redis service
const redisService = new RedisService();

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: config.allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: config.socketIO.pingTimeout,
  pingInterval: config.socketIO.pingInterval,
  maxHttpBufferSize: 10e6, // 10MB for voice notes
  transports: ['websocket', 'polling']
});

// Initialize services
const messageService = new MessageService(prisma, redisService);
const voiceNoteService = new VoiceNoteService(prisma);
const socketService = new SocketService(io, prisma);

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1500, // Higher limit for real-time communication
  message: 'Too many requests from this IP, please try again later.',
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "connect-src": ["'self'", "ws:", "wss:"]
    }
  }
}));

app.use(cors({
  origin: config.allowedOrigins,
  credentials: true
}));

app.use(limiter);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(requestLogger);

// Serve static files (uploaded voice notes and images)
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'communication-service',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    socketConnections: io.engine.clientsCount
  });
});

// WebSocket status endpoint
app.get('/ws-status', (req, res) => {
  res.json({
    status: 'OK',
    activeConnections: io.engine.clientsCount,
    rooms: io.sockets.adapter.rooms.size,
    socketIOVersion: require('socket.io').version
  });
});

// API Routes
app.use('/api/chat', authenticateToken, chatRoutes);
app.use('/api/upload', authenticateToken, uploadRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);

// Socket.IO connection handling
io.use(socketService.authenticateSocket.bind(socketService));
io.on('connection', socketService.handleConnection.bind(socketService));

// Error handling
app.use(errorHandler);

// Handle unhandled promise rejections
// Instead of crashing, log and continue - let the service recover
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Promise Rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
  // Don't exit - the service can continue handling other requests
  // In production, you might want to track these and alert if they exceed a threshold
});

// Handle uncaught exceptions
// For uncaught exceptions, we need to be more careful - the app state may be corrupted
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception - initiating graceful shutdown:', {
    message: err.message,
    stack: err.stack,
  });

  // Give the server time to finish in-flight requests before exiting
  // This prevents dropping active WebSocket connections abruptly
  setTimeout(() => {
    logger.error('Uncaught exception recovery timeout - forcing exit');
    process.exit(1);
  }, 10000); // 10 seconds to gracefully shutdown

  // Trigger graceful shutdown
  gracefulShutdown();
});

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Starting graceful shutdown...');
  
  // Close Socket.IO server
  io.close(() => {
    logger.info('Socket.IO server closed');
  });
  
  // Close Redis connections
  await redisService.disconnect();
  
  // Close Prisma connections
  await prisma.$disconnect();
  
  // Close HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

const PORT = config.port || 3006;

server.listen(PORT, async () => {
  logger.info(`Communication service running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Socket.IO enabled with CORS: ${config.allowedOrigins.join(', ')}`);
  
  // Initialize Redis connection
  try {
    await redisService.connect();
    logger.info('Redis connection established');
  } catch (error) {
    logger.warn('Redis connection failed, continuing without cache:', error);
  }
});

export { app, server, io, prisma };