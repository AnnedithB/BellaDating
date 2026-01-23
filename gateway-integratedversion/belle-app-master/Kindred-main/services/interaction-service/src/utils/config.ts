import { config } from 'dotenv';

config();

// Validate required environment variables at startup
const requiredEnvVars = ['JWT_SECRET'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`\n[Interaction Service] Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please set these in your .env file before starting the server.\n');
  process.exit(1);
}

export const interactionConfig = {
  port: parseInt(process.env.PORT || '3457'),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    url: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/interaction_service_db'
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || ''
  },

  jwt: {
    secret: process.env.JWT_SECRET!, // Required - validated above
    expiresIn: process.env.JWT_EXPIRE_TIME || '24h'
  },
  
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
  },
  
  socketIo: {
    corsOrigin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000'
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  },
  
  webrtc: {
    stunServers: process.env.STUN_SERVERS?.split(',') || ['stun:stun.l.google.com:19302'],
    turnServerUrl: process.env.TURN_SERVER_URL || '',
    turnServerUsername: process.env.TURN_SERVER_USERNAME || '',
    turnServerPassword: process.env.TURN_SERVER_PASSWORD || ''
  },
  
  services: {
    userService: process.env.USER_SERVICE_URL || 'http://localhost:3456',
    queuingService: process.env.QUEUING_SERVICE_URL || 'http://localhost:3458',
    historyService: process.env.HISTORY_SERVICE_URL || 'http://localhost:3459'
  },
  
  videoCall: {
    maxCallDuration: parseInt(process.env.MAX_CALL_DURATION || '3600000'),
    qualityCheckInterval: parseInt(process.env.VIDEO_QUALITY_CHECK_INTERVAL || '10000'),
    connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT || '30000')
  }
};