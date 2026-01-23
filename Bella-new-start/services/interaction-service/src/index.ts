import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';

import { interactionConfig } from './utils/config';
import { logger } from './utils/logger';
import { WebRTCSignalingService } from './services/webrtcSignaling';
import interactionRoutes from './routes/interactions';

class InteractionServiceApp {
  private app: express.Application;
  private server: any;
  private io!: SocketIOServer;
  private prisma: PrismaClient;
  private signalingService!: WebRTCSignalingService;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.prisma = new PrismaClient();
    
    this.setupSocketIO();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSignalingService();
  }

  private setupSocketIO(): void {
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: interactionConfig.socketIo.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: interactionConfig.cors.allowedOrigins,
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: interactionConfig.rateLimit.windowMs,
      max: interactionConfig.rateLimit.maxRequests,
      message: 'Too many requests from this IP'
    });
    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      const stats = this.signalingService?.getRoomStats() || {};
      res.json({
        status: 'success',
        data: {
          service: 'interaction-service',
          version: '1.0.0',
          status: 'healthy',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          roomStats: stats
        }
      });
    });

    // API routes
    this.app.use('/api/interactions', interactionRoutes);

    // WebRTC ICE servers endpoint
    this.app.get('/api/ice-servers', (req, res) => {
      res.json({
        status: 'success',
        data: {
          iceServers: [
            ...interactionConfig.webrtc.stunServers.map(url => ({ urls: url })),
            ...(interactionConfig.webrtc.turnServerUrl ? [{
              urls: interactionConfig.webrtc.turnServerUrl,
              username: interactionConfig.webrtc.turnServerUsername,
              credential: interactionConfig.webrtc.turnServerPassword
            }] : [])
          ]
        }
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        status: 'error',
        message: 'Endpoint not found'
      });
    });

    // Global error handler
    this.app.use((error: any, req: any, res: any, next: any) => {
      logger.error('Unhandled error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    });
  }

  private setupSignalingService(): void {
    this.signalingService = new WebRTCSignalingService(this.io, this.prisma);
    logger.info('WebRTC signaling service initialized');
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await this.prisma.$connect();
      logger.info('Connected to database');

      // Start server
      this.server.listen(interactionConfig.port, () => {
        logger.info(`Interaction service listening on port ${interactionConfig.port}`);
        logger.info(`Socket.IO server ready for WebRTC signaling`);
        logger.info(`Environment: ${interactionConfig.nodeEnv}`);
      });

      // Graceful shutdown handlers
      process.on('SIGTERM', () => this.shutdown('SIGTERM'));
      process.on('SIGINT', () => this.shutdown('SIGINT'));

    } catch (error) {
      logger.error('Failed to start interaction service:', error);
      process.exit(1);
    }
  }

  private async shutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    
    this.server.close(() => {
      logger.info('HTTP server closed');
    });

    await this.prisma.$disconnect();
    logger.info('Database connection closed');
    
    process.exit(0);
  }
}

// Start the application
const app = new InteractionServiceApp();
app.start().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

export default InteractionServiceApp;