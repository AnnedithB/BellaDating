import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  port: parseInt(process.env.PORT || '3460'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/notification_service_db'
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || ''
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-notification-service',
    expiresIn: process.env.JWT_EXPIRE_TIME || '24h'
  },
  
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  },
  
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
    databaseURL: process.env.FIREBASE_DATABASE_URL || ''
  },
  
  apns: {
    keyId: process.env.APNS_KEY_ID || '',
    teamId: process.env.APNS_TEAM_ID || '',
    privateKeyPath: process.env.APNS_PRIVATE_KEY_PATH || '',
    bundleId: process.env.APNS_BUNDLE_ID || '',
    production: process.env.APNS_PRODUCTION === 'true'
  },
  
  notification: {
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3'),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '5000'),
    batchSize: parseInt(process.env.BATCH_SIZE || '100'),
    queueConcurrency: parseInt(process.env.QUEUE_CONCURRENCY || '10')
  },
  
  services: {
    userService: process.env.USER_SERVICE_URL || 'http://localhost:3456',
    interactionService: process.env.INTERACTION_SERVICE_URL || 'http://localhost:3457',
    communicationService: process.env.COMMUNICATION_SERVICE_URL || 'http://localhost:3461'
  },
  
  analytics: {
    aggregationInterval: process.env.ANALYTICS_AGGREGATION_INTERVAL || '0 0 * * *',
    cleanupOldNotificationsDays: parseInt(process.env.CLEANUP_OLD_NOTIFICATIONS_DAYS || '30')
  },
  
  quietHours: {
    defaultStart: process.env.DEFAULT_QUIET_HOURS_START || '22:00',
    defaultEnd: process.env.DEFAULT_QUIET_HOURS_END || '08:00'
  },
  
  template: {
    cacheTtl: parseInt(process.env.TEMPLATE_CACHE_TTL || '3600'),
    imageCacheTtl: parseInt(process.env.IMAGE_CACHE_TTL || '86400')
  }
};