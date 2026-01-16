export const config = {
  port: process.env.PORT || 3004,
  nodeEnv: process.env.NODE_ENV || 'development',
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/moderation_db'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  api: {
    defaultPageSize: 20,
    maxPageSize: 100
  },
  moderation: {
    autoEscalateThreshold: 5,
    escalationTimeHours: 24,
    queueRefreshInterval: 60000 // 1 minute
  }
};

export default config;