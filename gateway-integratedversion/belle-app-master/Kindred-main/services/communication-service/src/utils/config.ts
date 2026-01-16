// Validate required environment variables at startup
const requiredEnvVars = ['JWT_SECRET'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`\n[Communication Service] Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please set these in your .env file before starting the server.\n');
  process.exit(1);
}

export const config = {
  port: process.env.PORT || 3006,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET!, // Required - validated above
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/communication_db'
  },
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
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
    host: process.env.REDIS_HOST || 'localhost',
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
        maxSize: parseInt(process.env.VOICE_MAX_SIZE || '104857600'), // 100MB - no practical limit
        maxDuration: parseInt(process.env.VOICE_MAX_DURATION || '3600'), // 1 hour
        allowedTypes: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/x-caf', 'audio/aac', 'audio/ogg']
      },
      image: {
        maxSize: parseInt(process.env.IMAGE_MAX_SIZE || '104857600'), // 100MB - no practical limit
        maxWidth: parseInt(process.env.IMAGE_MAX_WIDTH || '10000'),
        maxHeight: parseInt(process.env.IMAGE_MAX_HEIGHT || '10000'),
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']
      }
    }
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