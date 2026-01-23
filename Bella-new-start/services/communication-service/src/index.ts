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
import activityRoutes from './routes/activity';

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
const socketService = new SocketService(io, prisma);
const messageService = new MessageService(prisma, redisService, socketService);
const voiceNoteService = new VoiceNoteService(prisma);

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Rate limiting - relaxed for development
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 2000, // 2000 requests per minute for real-time communication
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => req.path === '/health',
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
// Set up services for chat routes
import { setServices as setChatServices } from './routes/chat';
setChatServices(socketService, messageService);
app.use('/api/chat', authenticateToken, chatRoutes);
// app.use('/api/upload', authenticateToken, uploadRoutes.getRouter()); // Disabled - missing dependencies
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/activity', activityRoutes);

// Socket.IO connection handling
io.use(socketService.authenticateSocket.bind(socketService));
io.on('connection', socketService.handleConnection.bind(socketService));

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

    // Subscribe to call session events (audio calls without matches)
    await redisService.subscribe('call:found', async (message: string) => {
      let data: any;
      try {
        logger.info('Raw Redis message received on call:found channel:', message);
        data = JSON.parse(message);
        logger.info('Received call session event via Redis:', data);

        // Notify both users about the call session (they'll see CallView)
        // Only proceed if we have all required data
        if (!data.user1Id || !data.user2Id || !data.sessionId || !data.roomId) {
          logger.warn('call:found event missing required data, skipping:', {
            hasUser1Id: !!data.user1Id,
            hasUser2Id: !!data.user2Id,
            hasSessionId: !!data.sessionId,
            hasRoomId: !!data.roomId
          });
          return;
        }

        // Create ChatRoom for persistent chat between the two users
        const createChatRoomForCall = async () => {
          try {
            // Check if a room already exists between these two users
            const existingRoom = await prisma.chatRoom.findFirst({
              where: {
                OR: [
                  { participant1Id: data.user1Id, participant2Id: data.user2Id },
                  { participant1Id: data.user2Id, participant2Id: data.user1Id }
                ]
              }
            });

            if (existingRoom) {
              logger.info('ChatRoom already exists for these users', {
                roomId: existingRoom.roomId,
                user1Id: data.user1Id,
                user2Id: data.user2Id
              });
              // Update lastActivity to bring this chat to the top
              await prisma.chatRoom.update({
                where: { id: existingRoom.id },
                data: { lastActivity: new Date(), isActive: true }
              });
              return existingRoom.roomId;
            }

            // Create new ChatRoom using the same roomId from the interaction session
            const chatRoom = await prisma.chatRoom.create({
              data: {
                roomId: data.roomId,
                type: 'PRIVATE',
                participant1Id: data.user1Id,
                participant2Id: data.user2Id,
                isActive: true
              }
            });

            // Add both users to the UserRoom join table
            await prisma.userRoom.createMany({
              data: [
                { userId: data.user1Id, roomId: data.roomId, role: 'MEMBER' as any },
                { userId: data.user2Id, roomId: data.roomId, role: 'MEMBER' as any }
              ],
              skipDuplicates: true
            });

            logger.info('ChatRoom created for call', {
              roomId: chatRoom.roomId,
              user1Id: data.user1Id,
              user2Id: data.user2Id
            });

            return chatRoom.roomId;
          } catch (error: any) {
            // Handle unique constraint violation (race condition - room already exists)
            if (error.code === 'P2002') {
              logger.info('ChatRoom already exists (race condition), skipping creation', {
                roomId: data.roomId,
                user1Id: data.user1Id,
                user2Id: data.user2Id
              });
              return data.roomId;
            }
            logger.error('Failed to create ChatRoom for call:', error);
            // Don't throw - we still want to emit the match:found event
            return null;
          }
        };

        // Create the ChatRoom (don't await - let it run in parallel with profile fetch)
        createChatRoomForCall().catch(err => {
          logger.error('Error in createChatRoomForCall:', err);
        });

        const logCallStartedActivities = async () => {
          try {
            await socketService.logActivityForUsers(
              [data.user1Id],
              'CALL_STARTED',
              'Call started',
              'You started an audio call.',
              {
                partnerId: data.user2Id,
                roomId: data.roomId,
                sessionId: data.sessionId
              }
            );
            await socketService.logActivityForUsers(
              [data.user2Id],
              'CALL_STARTED',
              'Call started',
              'You started an audio call.',
              {
                partnerId: data.user1Id,
                roomId: data.roomId,
                sessionId: data.sessionId
              }
            );
          } catch (error) {
            logger.warn('Failed to log call started activity', { error });
          }
        };

        // Fetch user profiles for partner info (async, don't block)
        const fetchUserProfiles = async () => {
          try {
            const axios = require('axios');
            const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3001';
            
            logger.info(`Fetching user profiles for ${data.user1Id} and ${data.user2Id}`);
            
            // Use internal endpoint for service-to-service calls (no auth required)
            // Endpoint: /profile/internal/users/:id (profile router is mounted at /profile)
            // Response structure: { data: { user: {...} } }
            const fetchUserProfile = async (userId: string) => {
              try {
                const response = await axios.get(`${userServiceUrl}/profile/internal/users/${userId}`, {
                  timeout: 5000,
                  headers: {
                    'x-internal-request': 'true'
                  }
                });
                // Response structure: { data: { user: {...} } }
                return response;
              } catch (err: any) {
                logger.error(`Failed to fetch profile for user ${userId}:`, {
                  message: err.message,
                  status: err.response?.status,
                  url: `${userServiceUrl}/profile/internal/users/${userId}`
                });
                return null;
              }
            };
            
            const [user1Profile, user2Profile] = await Promise.all([
              fetchUserProfile(data.user2Id), // user1's partner is user2
              fetchUserProfile(data.user1Id)  // user2's partner is user1
            ]);

            // Extract profile data - internal endpoint returns: { status: 'success', data: { user: {...} } }
            // Axios wraps it, so response.data = { status: 'success', data: { user: {...} } }
            // So we need response.data.data.user
            const user1PartnerData = user1Profile?.data?.data?.user || {};
            const user2PartnerData = user2Profile?.data?.data?.user || {};

            // Log detailed response for debugging
            if (!user1PartnerData.name || !user2PartnerData.name) {
              logger.warn(`Profile fetch returned incomplete data:`, {
                user1ProfileResponse: user1Profile ? {
                  hasData: !!user1Profile.data,
                  hasDataData: !!user1Profile.data?.data,
                  hasUser: !!user1Profile.data?.data?.user,
                  status: user1Profile.data?.status,
                  keys: user1Profile.data ? Object.keys(user1Profile.data) : []
                } : 'null',
                user2ProfileResponse: user2Profile ? {
                  hasData: !!user2Profile.data,
                  hasDataData: !!user2Profile.data?.data,
                  hasUser: !!user2Profile.data?.data?.user,
                  status: user2Profile.data?.status,
                  keys: user2Profile.data ? Object.keys(user2Profile.data) : []
                } : 'null'
              });
            }

            logger.info(`Fetched profiles:`, {
              user1PartnerName: user1PartnerData.name || user1PartnerData.displayName || 'Unknown',
              user2PartnerName: user2PartnerData.name || user2PartnerData.displayName || 'Unknown',
              user1HasFullProfile: !!(user1PartnerData.bio || user1PartnerData.shortBio || user1PartnerData.photos),
              user2HasFullProfile: !!(user2PartnerData.bio || user2PartnerData.shortBio || user2PartnerData.photos),
              user1HasName: !!(user1PartnerData.name || user1PartnerData.displayName),
              user2HasName: !!(user2PartnerData.name || user2PartnerData.displayName)
            });

              // Emit match:found event to User 1 (this triggers CallView display)
              // Include full profile data so frontend doesn't need to fetch again
              socketService.emitToUser(data.user1Id, 'match:found', {
                sessionId: data.sessionId,
                roomId: data.roomId,
                partnerId: data.user2Id,
                partnerName: user1PartnerData.name || 'Someone',
                partnerProfilePicture: user1PartnerData.profilePicture || null,
                partnerProfile: user1PartnerData, // Include full profile data
                timestamp: data.timestamp
              });

              // Emit match:found event to User 2 (this triggers CallView display)
              // Include full profile data so frontend doesn't need to fetch again
              socketService.emitToUser(data.user2Id, 'match:found', {
                sessionId: data.sessionId,
                roomId: data.roomId,
                partnerId: data.user1Id,
                partnerName: user2PartnerData.name || 'Someone',
                partnerProfilePicture: user2PartnerData.profilePicture || null,
                partnerProfile: user2PartnerData, // Include full profile data
                timestamp: data.timestamp
              });

              logger.info(`Emitted match:found socket events for call session to ${data.user1Id} and ${data.user2Id}`, {
                sessionId: data.sessionId,
                roomId: data.roomId
              });
              await logCallStartedActivities();
              // Return success to resolve Promise.race
              return { success: true, user1PartnerData, user2PartnerData };
            } catch (profileError) {
              logger.error('Error fetching user profiles for call session event:', profileError);
              // Emit without profile data if fetch fails
              socketService.emitToUser(data.user1Id, 'match:found', {
                sessionId: data.sessionId,
                roomId: data.roomId,
                partnerId: data.user2Id,
                partnerName: 'Someone',
                partnerProfilePicture: null,
                timestamp: data.timestamp
              });

              socketService.emitToUser(data.user2Id, 'match:found', {
                sessionId: data.sessionId,
                roomId: data.roomId,
                partnerId: data.user1Id,
                partnerName: 'Someone',
                partnerProfilePicture: null,
                timestamp: data.timestamp
              });
              await logCallStartedActivities();
              // Return failure to resolve Promise.race
              return { success: false, error: profileError };
            }
          };

          // Await profile fetch to ensure data is included in event
          // Use Promise.race with timeout to prevent blocking indefinitely
          try {
            const result: any = await Promise.race([
              fetchUserProfiles(),
              new Promise((resolve) => {
                setTimeout(() => {
                  logger.warn('Profile fetch timed out after 10 seconds, proceeding without full profile data');
                  resolve({ success: false, timeout: true });
                }, 10000);
              })
            ]);
            
            if (result && result.timeout) {
              // Timeout occurred - events were already emitted by fetchUserProfiles, but we log it
              logger.warn('Profile fetch completed but timed out - events may have been emitted without full data');
            } else if (result && result.success) {
              logger.info('Profile fetch completed successfully');
            }
          } catch (fetchError) {
            logger.error('Error in profile fetch Promise.race:', fetchError);
            // Still emit events even if fetch fails
            socketService.emitToUser(data.user1Id, 'match:found', {
              sessionId: data.sessionId,
              roomId: data.roomId,
              partnerId: data.user2Id,
              partnerName: 'Someone',
              partnerProfilePicture: null,
              timestamp: data.timestamp
            });
            socketService.emitToUser(data.user2Id, 'match:found', {
              sessionId: data.sessionId,
              roomId: data.roomId,
              partnerId: data.user1Id,
              partnerName: 'Someone',
              partnerProfilePicture: null,
              timestamp: data.timestamp
            });
          }
      } catch (error) {
        logger.error('Error processing call:found Redis message:', error);
        // Try to parse data again in case it failed earlier, or use already parsed data
        try {
          const errorData = data || JSON.parse(message);
          if (errorData.user1Id && errorData.user2Id && errorData.sessionId && errorData.roomId) {
            // Emit basic events even on error to ensure users get matched
            socketService.emitToUser(errorData.user1Id, 'match:found', {
              sessionId: errorData.sessionId,
              roomId: errorData.roomId,
              partnerId: errorData.user2Id,
              partnerName: 'Someone',
              partnerProfilePicture: null,
              timestamp: errorData.timestamp
            });
            socketService.emitToUser(errorData.user2Id, 'match:found', {
              sessionId: errorData.sessionId,
              roomId: errorData.roomId,
              partnerId: errorData.user1Id,
              partnerName: 'Someone',
              partnerProfilePicture: null,
              timestamp: errorData.timestamp
            });
          }
        } catch (emitError) {
          logger.error('Failed to emit match:found events after error:', emitError);
        }
      }
    });

    // Subscribe to match events from queuing-service (when users click heart button)
    await redisService.subscribe('user_matched', async (message: string) => {
      let data: any;
      try {
        logger.info('Raw Redis message received on user_matched channel:', message);
        data = JSON.parse(message);
        logger.info('Received match event via Redis:', data);

        // Notify both users about the match
        if (data.user1Id && data.user2Id) {
          // Fetch user profiles for partner info (async, don't block)
          const fetchUserProfiles = async () => {
            try {
              const axios = require('axios');
              const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3001';
              
              logger.info(`Fetching user profiles for match event: ${data.user1Id} and ${data.user2Id}`);
              
              // Use internal endpoint for service-to-service calls (no auth required)
              const fetchUserProfile = async (userId: string) => {
                try {
                  const response = await axios.get(`${userServiceUrl}/profile/internal/users/${userId}`, {
                    timeout: 5000,
                    headers: {
                      'x-internal-request': 'true'
                    }
                  });
                  return response;
                } catch (err: any) {
                  logger.error(`Failed to fetch profile for user ${userId}:`, {
                    message: err.message,
                    status: err.response?.status
                  });
                  return null;
                }
              };
              
              const [user1Profile, user2Profile] = await Promise.all([
                fetchUserProfile(data.user2Id), // user1's partner is user2
                fetchUserProfile(data.user1Id)  // user2's partner is user1
              ]);

              // Extract profile data - internal endpoint returns: { status: 'success', data: { user: {...} } }
              // Axios wraps it, so response.data = { status: 'success', data: { user: {...} } }
              // So we need response.data.data.user
              const user1PartnerData = user1Profile?.data?.data?.user || {};
              const user2PartnerData = user2Profile?.data?.data?.user || {};

              logger.info(`Fetched profiles for match event:`, {
                user1PartnerName: user1PartnerData.name || user1PartnerData.displayName || 'Unknown',
                user2PartnerName: user2PartnerData.name || user2PartnerData.displayName || 'Unknown',
                user1HasFullProfile: !!(user1PartnerData.bio || user1PartnerData.shortBio || user1PartnerData.photos),
                user2HasFullProfile: !!(user2PartnerData.bio || user2PartnerData.shortBio || user2PartnerData.photos)
              });

              // Emit match:found event to User 1 with session details and full profile
              socketService.emitToUser(data.user1Id, 'match:found', {
                matchId: data.matchId,
                sessionId: data.sessionId,
                roomId: data.roomId,
                partnerId: data.user2Id,
                partnerName: user1PartnerData.name || 'Someone',
                partnerProfilePicture: user1PartnerData.profilePicture || null,
                partnerProfile: user1PartnerData, // Include full profile data
                score: data.score,
                timestamp: data.timestamp
              });

              // Emit match:found event to User 2 with session details and full profile
              socketService.emitToUser(data.user2Id, 'match:found', {
                matchId: data.matchId,
                sessionId: data.sessionId,
                roomId: data.roomId,
                partnerId: data.user1Id,
                partnerName: user2PartnerData.name || 'Someone',
                partnerProfilePicture: user2PartnerData.profilePicture || null,
                partnerProfile: user2PartnerData, // Include full profile data
                score: data.score,
                timestamp: data.timestamp
              });

              logger.info(`Emitted match:found socket events to ${data.user1Id} and ${data.user2Id}`, {
                sessionId: data.sessionId,
                roomId: data.roomId
              });
              // Return success to resolve Promise.race
              return { success: true, user1PartnerData, user2PartnerData };
            } catch (profileError) {
              logger.error('Error fetching user profiles for match event:', profileError);
              // Emit without profile data if fetch fails
              socketService.emitToUser(data.user1Id, 'match:found', {
                matchId: data.matchId,
                sessionId: data.sessionId,
                roomId: data.roomId,
                partnerId: data.user2Id,
                partnerName: 'Someone',
                partnerProfilePicture: null,
                score: data.score,
                timestamp: data.timestamp
              });

              socketService.emitToUser(data.user2Id, 'match:found', {
                matchId: data.matchId,
                sessionId: data.sessionId,
                roomId: data.roomId,
                partnerId: data.user1Id,
                partnerName: 'Someone',
                partnerProfilePicture: null,
                score: data.score,
                timestamp: data.timestamp
              });
              // Return failure to resolve Promise.race
              return { success: false, error: profileError };
            }
          };

          // Await profile fetch to ensure data is included in event
          // Use Promise.race with timeout to prevent blocking indefinitely
          try {
            const result: any = await Promise.race([
              fetchUserProfiles(),
              new Promise((resolve) => {
                setTimeout(() => {
                  logger.warn('Profile fetch timed out after 10 seconds for user_matched, proceeding without full profile data');
                  resolve({ success: false, timeout: true });
                }, 10000);
              })
            ]);
            
            if (result && result.timeout) {
              // Timeout occurred - events were already emitted by fetchUserProfiles, but we log it
              logger.warn('Profile fetch for user_matched completed but timed out - events may have been emitted without full data');
            } else if (result && result.success) {
              logger.info('Profile fetch for user_matched completed successfully');
            }
          } catch (fetchError) {
            logger.error('Error in profile fetch Promise.race for user_matched:', fetchError);
            // Still emit events even if fetch fails
            socketService.emitToUser(data.user1Id, 'match:found', {
              matchId: data.matchId,
              sessionId: data.sessionId,
              roomId: data.roomId,
              partnerId: data.user2Id,
              partnerName: 'Someone',
              partnerProfilePicture: null,
              score: data.score,
              timestamp: data.timestamp
            });
            socketService.emitToUser(data.user2Id, 'match:found', {
              matchId: data.matchId,
              sessionId: data.sessionId,
              roomId: data.roomId,
              partnerId: data.user1Id,
              partnerName: 'Someone',
              partnerProfilePicture: null,
              score: data.score,
              timestamp: data.timestamp
            });
          }
        }
      } catch (error) {
        logger.error('Error processing user_matched Redis message:', error);
      }
    });

  } catch (error) {
    logger.warn('Redis connection failed, continuing without cache:', error);
  }
});

export { app, server, io, prisma, socketService, messageService };