import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export interface DatabaseConfig {
  url: string;
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
}

export interface RedisConfig {
  url: string;
  host: string;
  port: number;
  password?: string;
  db: number;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn: string;
}

export interface ServerConfig {
  nodeEnv: string;
  port: number;
  host: string;
}

export interface CorsConfig {
  origin: string[];
  credentials: boolean;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  authMaxRequests: number;
}

export interface FileUploadConfig {
  aws: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    s3Bucket: string;
  };
  local: {
    uploadDir: string;
    maxFileSize: number;
    allowedFileTypes: string[];
  };
}

export interface LoggingConfig {
  level: string;
  format: string;
  filePath: string;
  maxSize: string;
  maxFiles: number;
}

export interface ServiceUrlsConfig {
  userService: string;
  queuingService: string;
  interactionService: string;
  historyService: string;
  communicationService: string;
}

export interface SocketIOConfig {
  corsOrigin: string;
  transports: string[];
  pingTimeout: number;
  pingInterval: number;
}

export interface QueueConfig {
  defaultTimeout: number;
  maxSize: number;
  matchTimeout: number;
  callDuration: number;
}

export interface SecurityConfig {
  bcryptRounds: number;
  passwordMinLength: number;
  sessionTimeout: number;
}

export interface MonitoringConfig {
  healthCheckTimeout: number;
  metricsEnabled: boolean;
  metricsPort: number;
}

class Config {
  public readonly database: DatabaseConfig;
  public readonly redis: RedisConfig;
  public readonly jwt: JwtConfig;
  public readonly server: ServerConfig;
  public readonly cors: CorsConfig;
  public readonly rateLimit: RateLimitConfig;
  public readonly fileUpload: FileUploadConfig;
  public readonly logging: LoggingConfig;
  public readonly serviceUrls: ServiceUrlsConfig;
  public readonly socketIO: SocketIOConfig;
  public readonly queue: QueueConfig;
  public readonly security: SecurityConfig;
  public readonly monitoring: MonitoringConfig;

  constructor() {
    this.database = {
      url: this.getEnvVar('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/realtime_connect'),
      host: this.getEnvVar('DATABASE_HOST', 'localhost'),
      port: this.getEnvVarAsNumber('DATABASE_PORT', 5432),
      name: this.getEnvVar('DATABASE_NAME', 'realtime_connect'),
      user: this.getEnvVar('DATABASE_USER', 'postgres'),
      password: this.getEnvVar('DATABASE_PASSWORD', 'password'),
    };

    this.redis = {
      url: this.getEnvVar('REDIS_URL', 'redis://localhost:6379'),
      host: this.getEnvVar('REDIS_HOST', 'localhost'),
      port: this.getEnvVarAsNumber('REDIS_PORT', 6379),
      password: this.getEnvVar('REDIS_PASSWORD'),
      db: this.getEnvVarAsNumber('REDIS_DB', 0),
    };

    this.jwt = {
      secret: this.getEnvVar('JWT_SECRET', 'your-super-secret-jwt-key'),
      expiresIn: this.getEnvVar('JWT_EXPIRES_IN', '24h'),
      refreshExpiresIn: this.getEnvVar('JWT_REFRESH_EXPIRES_IN', '7d'),
    };

    this.server = {
      nodeEnv: this.getEnvVar('NODE_ENV', 'development'),
      port: this.getEnvVarAsNumber('PORT', 3001),
      host: this.getEnvVar('HOST', '0.0.0.0'),
    };

    this.cors = {
      origin: this.getEnvVar('CORS_ORIGIN', 'http://localhost:3000').split(','),
      credentials: this.getEnvVarAsBoolean('CORS_CREDENTIALS', true),
    };

    this.rateLimit = {
      windowMs: this.getEnvVarAsNumber('RATE_LIMIT_WINDOW_MS', 60000),
      maxRequests: this.getEnvVarAsNumber('RATE_LIMIT_MAX_REQUESTS', 100),
      authMaxRequests: this.getEnvVarAsNumber('AUTH_RATE_LIMIT_MAX', 5),
    };

    this.fileUpload = {
      aws: {
        accessKeyId: this.getEnvVar('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.getEnvVar('AWS_SECRET_ACCESS_KEY', ''),
        region: this.getEnvVar('AWS_REGION', 'us-east-1'),
        s3Bucket: this.getEnvVar('AWS_S3_BUCKET', 'realtime-connect-uploads'),
      },
      local: {
        uploadDir: this.getEnvVar('UPLOAD_DIR', './uploads'),
        maxFileSize: this.getEnvVarAsNumber('MAX_FILE_SIZE', 10485760), // 10MB
        allowedFileTypes: this.getEnvVar('ALLOWED_FILE_TYPES', 'image/jpeg,image/png,image/gif,video/mp4,video/webm').split(','),
      },
    };

    this.logging = {
      level: this.getEnvVar('LOG_LEVEL', 'info'),
      format: this.getEnvVar('LOG_FORMAT', 'json'),
      filePath: this.getEnvVar('LOG_FILE_PATH', './logs'),
      maxSize: this.getEnvVar('LOG_MAX_SIZE', '20m'),
      maxFiles: this.getEnvVarAsNumber('LOG_MAX_FILES', 14),
    };

    this.serviceUrls = {
      userService: this.getEnvVar('USER_SERVICE_URL', 'http://localhost:3001'),
      queuingService: this.getEnvVar('QUEUING_SERVICE_URL', 'http://localhost:3002'),
      interactionService: this.getEnvVar('INTERACTION_SERVICE_URL', 'http://localhost:3003'),
      historyService: this.getEnvVar('HISTORY_SERVICE_URL', 'http://localhost:3004'),
      communicationService: this.getEnvVar('COMMUNICATION_SERVICE_URL', 'http://localhost:3005'),
    };

    this.socketIO = {
      corsOrigin: this.getEnvVar('SOCKETIO_CORS_ORIGIN', 'http://localhost:3000'),
      transports: this.getEnvVar('SOCKETIO_TRANSPORTS', 'websocket,polling').split(','),
      pingTimeout: this.getEnvVarAsNumber('SOCKETIO_PING_TIMEOUT', 60000),
      pingInterval: this.getEnvVarAsNumber('SOCKETIO_PING_INTERVAL', 25000),
    };

    this.queue = {
      defaultTimeout: this.getEnvVarAsNumber('QUEUE_DEFAULT_TIMEOUT', 300),
      maxSize: this.getEnvVarAsNumber('QUEUE_MAX_SIZE', 1000),
      matchTimeout: this.getEnvVarAsNumber('MATCH_TIMEOUT', 30),
      callDuration: this.getEnvVarAsNumber('CALL_DURATION', 180),
    };

    this.security = {
      bcryptRounds: this.getEnvVarAsNumber('BCRYPT_ROUNDS', 12),
      passwordMinLength: this.getEnvVarAsNumber('PASSWORD_MIN_LENGTH', 8),
      sessionTimeout: this.getEnvVarAsNumber('SESSION_TIMEOUT', 3600),
    };

    this.monitoring = {
      healthCheckTimeout: this.getEnvVarAsNumber('HEALTH_CHECK_TIMEOUT', 5000),
      metricsEnabled: this.getEnvVarAsBoolean('METRICS_ENABLED', true),
      metricsPort: this.getEnvVarAsNumber('METRICS_PORT', 9090),
    };

    // Validate critical configuration
    this.validateConfig();
  }

  private getEnvVar(key: string, defaultValue?: string): string {
    const value = process.env[key];
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Environment variable ${key} is required but not set`);
    }
    return value;
  }

  private getEnvVarAsNumber(key: string, defaultValue?: number): number {
    const value = process.env[key];
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Environment variable ${key} is required but not set`);
    }
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) {
      throw new Error(`Environment variable ${key} must be a valid number`);
    }
    return numValue;
  }

  private getEnvVarAsBoolean(key: string, defaultValue?: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Environment variable ${key} is required but not set`);
    }
    return value.toLowerCase() === 'true';
  }

  private validateConfig(): void {
    // Validate JWT secret in production
    if (this.server.nodeEnv === 'production') {
      if (this.jwt.secret === 'your-super-secret-jwt-key') {
        throw new Error('JWT_SECRET must be changed in production environment');
      }
      if (this.jwt.secret.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters long in production');
      }
    }

    // Validate database URL format
    if (!this.database.url.startsWith('postgresql://')) {
      throw new Error('DATABASE_URL must be a valid PostgreSQL connection string');
    }

    // Validate Redis URL format
    if (!this.redis.url.startsWith('redis://')) {
      throw new Error('REDIS_URL must be a valid Redis connection string');
    }

    // Validate port ranges
    if (this.server.port < 1 || this.server.port > 65535) {
      throw new Error('PORT must be between 1 and 65535');
    }

    // Validate bcrypt rounds
    if (this.security.bcryptRounds < 10 || this.security.bcryptRounds > 15) {
      throw new Error('BCRYPT_ROUNDS should be between 10 and 15 for security and performance');
    }
  }

  // Utility methods
  public isDevelopment(): boolean {
    return this.server.nodeEnv === 'development';
  }

  public isProduction(): boolean {
    return this.server.nodeEnv === 'production';
  }

  public isTest(): boolean {
    return this.server.nodeEnv === 'test';
  }

  public getServicePort(serviceName: string): number {
    const basePort = 3001;
    const serviceMap: { [key: string]: number } = {
      'user-service': 0,
      'queuing-service': 1,
      'interaction-service': 2,
      'history-service': 3,
      'communication-service': 4,
    };

    const offset = serviceMap[serviceName];
    if (offset === undefined) {
      throw new Error(`Unknown service name: ${serviceName}`);
    }

    return basePort + offset;
  }

  public getLogFilePath(serviceName: string): string {
    return path.join(this.logging.filePath, `${serviceName}.log`);
  }
}

// Create and export singleton instance
export const config = new Config();

// Export individual config sections for convenience
export const {
  database,
  redis,
  jwt,
  server,
  cors,
  rateLimit,
  fileUpload,
  logging,
  serviceUrls,
  socketIO,
  queue,
  security,
  monitoring
} = config;