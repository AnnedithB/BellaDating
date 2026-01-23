export const config = {
  port: process.env.PORT || 3006,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-key',
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/communication_db'
  },
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
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
  ],
  logLevel: process.env.LOG_LEVEL || 'info',

  // Socket.IO Configuration
  socketIO: {
    pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT || '60000'),
    pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL || '25000'),
    maxConnections: parseInt(process.env.MAX_SOCKET_CONNECTIONS || '10000'),
    adapter: process.env.SOCKET_ADAPTER || 'memory' // 'redis' for production
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://kindred-redis:6379',
    host: process.env.REDIS_HOST || 'kindred-redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'comm:',
    enableReadyCheck: true,
    maxRetriesPerRequest: 3
  },

  // File Upload & Storage
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'aws', // 'aws' | 'local'
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      bucket: process.env.AWS_S3_BUCKET || 'realtime-connect-media',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    local: {
      uploadPath: process.env.LOCAL_UPLOAD_PATH || './uploads',
      publicUrl: process.env.LOCAL_PUBLIC_URL || 'http://localhost:3006/uploads'
    },
    limits: {
      voiceNote: {
        maxSize: parseInt(process.env.VOICE_MAX_SIZE || '10485760'), // 10MB
        maxDuration: parseInt(process.env.VOICE_MAX_DURATION || '300'), // 5 minutes
        allowedTypes: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav']
      },
      image: {
        maxSize: parseInt(process.env.IMAGE_MAX_SIZE || '5242880'), // 5MB
        maxWidth: parseInt(process.env.IMAGE_MAX_WIDTH || '2048'),
        maxHeight: parseInt(process.env.IMAGE_MAX_HEIGHT || '2048'),
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      }
    }
  },

  // Service URLs
  services: {
    notificationService: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3460',
    userService: process.env.USER_SERVICE_URL || 'http://localhost:3001'
  },

  // Message Configuration
  messaging: {
    maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH || '1000'),
    maxMessagesPerMinute: parseInt(process.env.MAX_MESSAGES_PER_MINUTE || '60'),
    messageRetentionDays: parseInt(process.env.MESSAGE_RETENTION_DAYS || '90'),
    enableMessageHistory: process.env.ENABLE_MESSAGE_HISTORY !== 'false',
    enableTypingIndicators: process.env.ENABLE_TYPING_INDICATORS !== 'false',
    enableReadReceipts: process.env.ENABLE_READ_RECEIPTS !== 'false'
  },

  // Moderation & Safety
  moderation: {
    enableAutoModeration: process.env.AUTO_MODERATION === 'true',
    toxicityThreshold: parseFloat(process.env.TOXICITY_THRESHOLD || '0.7'),
    perspectiveApiKey: process.env.PERSPECTIVE_API_KEY,
    perspectiveApiUrl: 'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze'
  },

  // Performance & Caching
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '300'), // 5 minutes
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000'),
    enableMessageCache: process.env.ENABLE_MESSAGE_CACHE !== 'false',
    enableUserCache: process.env.ENABLE_USER_CACHE !== 'false'
  }
};