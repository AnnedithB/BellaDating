// Performance Configuration for Real-time Connect Services
export interface PerformanceConfig {
  // Redis Configuration
  redis: {
    host: string;
    port: number;
    password?: string;
    maxRetries: number;
    retryDelayOnFailover: number;
    connectTimeout: number;
    commandTimeout: number;
    maxMemoryPolicy: string;
  };

  // Database Configuration
  database: {
    connectionPoolSize: number;
    connectionTimeout: number;
    idleTimeout: number;
    maxLifetime: number;
    enableQueryLogging: boolean;
    slowQueryThreshold: number;
    enableQueryCache: boolean;
    queryCacheSize: number;
    queryCacheTTL: number;
  };

  // Cache Configuration
  cache: {
    defaultTTL: number;
    maxSize: number;
    enableCompression: boolean;
    compressionThreshold: number;
    enableMetrics: boolean;
  };

  // Session Configuration
  session: {
    ttl: number;
    maxConcurrentSessions: number;
    extendOnActivity: boolean;
    enableSessionMetrics: boolean;
    cleanupInterval: number;
  };

  // Request Configuration
  request: {
    timeout: number;
    maxBodySize: number;
    enableCompression: boolean;
    compressionLevel: number;
    enableRateLimiting: boolean;
    rateLimit: {
      windowMs: number;
      max: number;
      skipSuccessfulRequests: boolean;
    };
  };

  // Monitoring Configuration
  monitoring: {
    enableMetrics: boolean;
    enableHealthChecks: boolean;
    healthCheckInterval: number;
    enableSlowRequestLogging: boolean;
    slowRequestThreshold: number;
    enableErrorTracking: boolean;
    maxMetricsHistory: number;
  };

  // API Configuration
  api: {
    enableResponseCaching: boolean;
    responseCacheTTL: number;
    cacheableRoutes: string[];
    enableETag: boolean;
    enableLastModified: boolean;
    defaultPageSize: number;
    maxPageSize: number;
  };
}

// Default production configuration
export const productionConfig: PerformanceConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetries: 3,
    retryDelayOnFailover: 100,
    connectTimeout: 10000,
    commandTimeout: 5000,
    maxMemoryPolicy: 'allkeys-lru',
  },

  database: {
    connectionPoolSize: parseInt(process.env.DB_POOL_SIZE || '20'),
    connectionTimeout: 30000,
    idleTimeout: 300000,
    maxLifetime: 1800000, // 30 minutes
    enableQueryLogging: false,
    slowQueryThreshold: 1000,
    enableQueryCache: true,
    queryCacheSize: 1000,
    queryCacheTTL: 300000, // 5 minutes
  },

  cache: {
    defaultTTL: 3600, // 1 hour
    maxSize: 10000,
    enableCompression: true,
    compressionThreshold: 1024, // 1KB
    enableMetrics: true,
  },

  session: {
    ttl: 86400, // 24 hours
    maxConcurrentSessions: 5,
    extendOnActivity: true,
    enableSessionMetrics: true,
    cleanupInterval: 3600000, // 1 hour
  },

  request: {
    timeout: 30000,
    maxBodySize: 10485760, // 10MB
    enableCompression: true,
    compressionLevel: 6,
    enableRateLimiting: true,
    rateLimit: {
      windowMs: 900000, // 15 minutes
      max: 1000,
      skipSuccessfulRequests: false,
    },
  },

  monitoring: {
    enableMetrics: true,
    enableHealthChecks: true,
    healthCheckInterval: 30000,
    enableSlowRequestLogging: true,
    slowRequestThreshold: 1000,
    enableErrorTracking: true,
    maxMetricsHistory: 1000,
  },

  api: {
    enableResponseCaching: true,
    responseCacheTTL: 300, // 5 minutes
    cacheableRoutes: [
      '/api/users',
      '/api/profiles',
      '/api/analytics',
      '/api/health',
    ],
    enableETag: true,
    enableLastModified: true,
    defaultPageSize: 20,
    maxPageSize: 100,
  },
};

// Development configuration
export const developmentConfig: PerformanceConfig = {
  ...productionConfig,
  
  database: {
    ...productionConfig.database,
    enableQueryLogging: true,
    connectionPoolSize: 5,
  },

  request: {
    ...productionConfig.request,
    enableRateLimiting: false,
  },

  monitoring: {
    ...productionConfig.monitoring,
    enableSlowRequestLogging: true,
    slowRequestThreshold: 500,
  },

  cache: {
    ...productionConfig.cache,
    defaultTTL: 300, // 5 minutes for development
  },
};

// Test configuration
export const testConfig: PerformanceConfig = {
  ...developmentConfig,
  
  redis: {
    ...developmentConfig.redis,
    host: 'localhost',
    port: 6380, // Different port for tests
  },

  cache: {
    ...developmentConfig.cache,
    defaultTTL: 60, // 1 minute for tests
  },

  session: {
    ...developmentConfig.session,
    ttl: 3600, // 1 hour for tests
  },
};

// Configuration selector based on environment
export const getPerformanceConfig = (): PerformanceConfig => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return productionConfig;
    case 'test':
      return testConfig;
    default:
      return developmentConfig;
  }
};

// Service-specific optimizations
export interface ServiceOptimizations {
  // User Service optimizations
  userService: {
    enableProfileCaching: boolean;
    profileCacheTTL: number;
    enableUserSearchCache: boolean;
    userSearchCacheTTL: number;
    maxSearchResults: number;
  };

  // Queuing Service optimizations
  queuingService: {
    enableMatchingCache: boolean;
    matchingCacheTTL: number;
    queueProcessingInterval: number;
    maxQueueSize: number;
    enableQueueMetrics: boolean;
  };

  // Communication Service optimizations
  communicationService: {
    enableMessageCaching: boolean;
    messageCacheTTL: number;
    maxMessagesPerRequest: number;
    enableVoiceNoteCompression: boolean;
    voiceNoteQuality: number;
  };

  // History Service optimizations
  historyService: {
    enableLogCompression: boolean;
    logRetentionDays: number;
    batchProcessingSize: number;
    enableAnalyticsCache: boolean;
    analyticsCacheTTL: number;
  };
}

export const serviceOptimizations: ServiceOptimizations = {
  userService: {
    enableProfileCaching: true,
    profileCacheTTL: 1800, // 30 minutes
    enableUserSearchCache: true,
    userSearchCacheTTL: 300, // 5 minutes
    maxSearchResults: 50,
  },

  queuingService: {
    enableMatchingCache: true,
    matchingCacheTTL: 60, // 1 minute
    queueProcessingInterval: 5000, // 5 seconds
    maxQueueSize: 1000,
    enableQueueMetrics: true,
  },

  communicationService: {
    enableMessageCaching: true,
    messageCacheTTL: 3600, // 1 hour
    maxMessagesPerRequest: 50,
    enableVoiceNoteCompression: true,
    voiceNoteQuality: 64, // kbps
  },

  historyService: {
    enableLogCompression: true,
    logRetentionDays: 90,
    batchProcessingSize: 100,
    enableAnalyticsCache: true,
    analyticsCacheTTL: 1800, // 30 minutes
  },
};

export default {
  getPerformanceConfig,
  productionConfig,
  developmentConfig,
  testConfig,
  serviceOptimizations,
};