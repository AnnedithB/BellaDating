import { config } from 'dotenv';

config();

export const interactionConfig = {
  port: parseInt(process.env.PORT || '3003'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/interaction_service_db'
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || ''
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-interaction-service',
    expiresIn: process.env.JWT_EXPIRE_TIME || '24h'
  },
  
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
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
    ]
  },
  
  socketIo: {
    corsOrigin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000,http://localhost:4000,http://localhost:8080,http://localhost:8081,http://localhost:8082,http://localhost:8083,http://localhost:8084,http://localhost:8085,http://localhost:8086,http://localhost:8087,http://localhost:8088,http://localhost:8089,http://localhost:8090,http://localhost:19006,http://127.0.0.1:8081,http://127.0.0.1:8082,http://51.20.160.210:4000,http://51.20.160.210:3000,http://51.20.160.210:8081'
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000') // 1000 per minute
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
    userService: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    queuingService: process.env.QUEUING_SERVICE_URL || 'http://localhost:3002',
    historyService: process.env.HISTORY_SERVICE_URL || 'http://localhost:3004'
  },
  
  videoCall: {
    maxCallDuration: parseInt(process.env.MAX_CALL_DURATION || '3600000'),
    qualityCheckInterval: parseInt(process.env.VIDEO_QUALITY_CHECK_INTERVAL || '10000'),
    connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT || '30000')
  }
};