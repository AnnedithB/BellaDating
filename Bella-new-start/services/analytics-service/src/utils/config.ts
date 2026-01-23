import { config } from 'dotenv';

config();

export const analyticsConfig = {
  port: parseInt(process.env.PORT || '3462'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/analytics_service_db'
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || ''
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-analytics-service',
    expiresIn: process.env.JWT_EXPIRE_TIME || '24h'
  },
  
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200')
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  },
  
  services: {
    userService: process.env.USER_SERVICE_URL || 'http://localhost:3456',
    interactionService: process.env.INTERACTION_SERVICE_URL || 'http://localhost:3457',
    queuingService: process.env.QUEUING_SERVICE_URL || 'http://localhost:3458',
    historyService: process.env.HISTORY_SERVICE_URL || 'http://localhost:3459',
    communicationService: process.env.COMMUNICATION_SERVICE_URL || 'http://localhost:3461'
  },
  
  aggregation: {
    metricsInterval: process.env.METRICS_AGGREGATION_INTERVAL || '0 0 * * *',
    hourlyInterval: process.env.HOURLY_METRICS_INTERVAL || '0 * * * *',
    cleanupDays: parseInt(process.env.CLEANUP_OLD_METRICS_DAYS || '90'),
    batchSize: parseInt(process.env.BATCH_SIZE || '1000')
  },
  
  cache: {
    ttl: parseInt(process.env.CACHE_TTL_SECONDS || '300'),
    dashboardTtl: parseInt(process.env.DASHBOARD_CACHE_TTL || '60')
  },
  
  alerts: {
    checkInterval: parseInt(process.env.ALERT_CHECK_INTERVAL || '300'),
    webhookUrl: process.env.WEBHOOK_URL || '',
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || ''
  },
  
  monitoring: {
    enablePerformanceTracking: process.env.ENABLE_PERFORMANCE_TRACKING === 'true',
    trackQueryPerformance: process.env.TRACK_QUERY_PERFORMANCE === 'true',
    slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '1000')
  }
};