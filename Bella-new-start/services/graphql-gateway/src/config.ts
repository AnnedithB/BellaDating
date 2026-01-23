import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // JWT Configuration
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret',
  
  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  
  // Microservice URLs
  // Docker Compose sets these via environment variables (USER_SERVICE_URL, etc.)
  // If not set, fallback to Docker service names (when in Docker) or localhost (when running locally)
  services: {
    user: process.env.USER_SERVICE_URL || 'http://kindred-user-service:3001',
    queuing: process.env.QUEUING_SERVICE_URL || 'http://kindred-queuing-service:3002',
    interaction: process.env.INTERACTION_SERVICE_URL || 'http://kindred-interaction-service:3003',
    history: process.env.HISTORY_SERVICE_URL || 'http://kindred-history-service:3004',
    communication: process.env.COMMUNICATION_SERVICE_URL || 'http://kindred-communication-service:3005',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://kindred-notification-service:3006',
    moderation: process.env.MODERATION_SERVICE_URL || 'http://kindred-moderation-service:3007',
    analytics: process.env.ANALYTICS_SERVICE_URL || 'http://kindred-analytics-service:3008',
    admin: process.env.ADMIN_SERVICE_URL || 'http://kindred-admin-service:3009',
    subscription: process.env.SUBSCRIPTION_SERVICE_URL || 'http://kindred-subscription-service:3010',
  },
  
  // Rate Limiting - relaxed for development
  rateLimiting: {
    windowMs: 60 * 1000, // 1 minute
    max: 2000, // Limit each IP to 2000 requests per minute
  },
  
  // CORS Configuration
  cors: {
    origin: function (origin, callback) {
      const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
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
      ];
      
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Check if origin is allowed
      const isAllowed = allowedOrigins.some(allowed => {
        const normalizedAllowed = allowed.trim();
        const normalizedOrigin = origin.trim();
        if (normalizedOrigin === normalizedAllowed) return true;
        try {
          const allowedUrl = new URL(normalizedAllowed);
          const originUrl = new URL(normalizedOrigin);
          return originUrl.hostname === allowedUrl.hostname;
        } catch {
          return normalizedOrigin.includes(normalizedAllowed.replace(/^https?:\/\//, '')) ||
                 normalizedAllowed.includes(normalizedOrigin.replace(/^https?:\/\//, ''));
        }
      });
      
      if (isAllowed || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Type', 'Content-Length'],
  },
};