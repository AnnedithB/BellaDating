// Validate required environment variables at startup
const requiredEnvVars = ['JWT_SECRET'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`\n[User Service] Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please set these in your .env file before starting the server.\n');
  process.exit(1);
}

export const config = {
  jwt: {
    secret: process.env.JWT_SECRET!, // Required - validated above
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  sessions: {
    ttlHours: Number(process.env.SESSION_TTL_HOURS || 24)
  },
  storage: {
    type: process.env.STORAGE_TYPE || 'local'
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'eu-north-1',
    s3Bucket: process.env.AWS_S3_BUCKET || 'kindred-users'
  },
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@belle.app'
  },
  app: {
    name: process.env.APP_NAME || 'Belle',
    url: process.env.APP_URL || 'http://localhost:3000',
    apiUrl: process.env.API_URL || 'http://localhost:3001'
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000), // 15 minutes
    maxRequests: Number(process.env.RATE_LIMIT_MAX || 100),
    authMaxRequests: Number(process.env.AUTH_RATE_LIMIT_MAX || 5), // Stricter for auth
    authWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000) // 15 minutes
  },
  verification: {
    emailTokenExpiryHours: Number(process.env.EMAIL_TOKEN_EXPIRY_HOURS || 24),
    passwordResetTokenExpiryHours: Number(process.env.PASSWORD_RESET_TOKEN_EXPIRY_HOURS || 1)
  }
};
