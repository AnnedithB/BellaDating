export const config = {
  port: process.env.PORT || 3005,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-key',
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/history_db'
  },
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Analytics Configuration
  analytics: {
    retentionDays: parseInt(process.env.ANALYTICS_RETENTION_DAYS || '90'),
    batchSize: parseInt(process.env.ANALYTICS_BATCH_SIZE || '1000'),
    aggregationInterval: parseInt(process.env.AGGREGATION_INTERVAL || '3600') // 1 hour in seconds
  },
  
  // Performance Settings
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '300'), // 5 minutes
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000')
  },
  
  // Safety & Moderation
  moderation: {
    autoModerationEnabled: process.env.AUTO_MODERATION === 'true',
    toxicityThreshold: parseFloat(process.env.TOXICITY_THRESHOLD || '0.7'),
    maxReportsPerUser: parseInt(process.env.MAX_REPORTS_PER_USER || '10')
  }
};