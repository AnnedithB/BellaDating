import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3005', 10),
  jwtSecret: process.env.JWT_SECRET || 'admin-super-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://admin_user:admin_pass@localhost:5432/admin_db'
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: 'admin:'
  },
  
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000'
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
  },
  
  pagination: {
    defaultLimit: 20,
    maxLimit: 100
  },
  
  security: {
    rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 100
  }
};