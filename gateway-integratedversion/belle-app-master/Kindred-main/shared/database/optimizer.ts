import { PrismaClient } from '@prisma/client';

interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeoutMillis: number;
  createTimeoutMillis: number;
  destroyTimeoutMillis: number;
  idleTimeoutMillis: number;
  reapIntervalMillis: number;
  createRetryIntervalMillis: number;
}

interface QueryOptimizationConfig {
  enableQueryLogging: boolean;
  slowQueryThreshold: number;
  enableQueryCache: boolean;
  cacheSize: number;
  cacheTTL: number;
}

export class DatabaseOptimizer {
  private prisma: PrismaClient;
  private connectionConfig: ConnectionPoolConfig;
  private queryConfig: QueryOptimizationConfig;
  private queryCache: Map<string, { data: any; timestamp: number }>;
  private queryStats: Map<string, { count: number; totalTime: number; avgTime: number }>;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    
    this.connectionConfig = {
      maxConnections: parseInt(process.env.DB_POOL_MAX || '20'),
      minConnections: parseInt(process.env.DB_POOL_MIN || '2'),
      acquireTimeoutMillis: 60000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
    };

    this.queryConfig = {
      enableQueryLogging: process.env.NODE_ENV === 'development',
      slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000'),
      enableQueryCache: process.env.ENABLE_QUERY_CACHE === 'true',
      cacheSize: parseInt(process.env.QUERY_CACHE_SIZE || '1000'),
      cacheTTL: parseInt(process.env.QUERY_CACHE_TTL || '300000'), // 5 minutes
    };

    this.queryCache = new Map();
    this.queryStats = new Map();

    this.setupQueryLogging();
    this.setupQueryOptimization();
  }

  private setupQueryLogging(): void {
    if (!this.queryConfig.enableQueryLogging) return;

    // Hook into Prisma query events
    this.prisma.$on('query' as any, (e: any) => {
      const duration = e.duration;
      const query = e.query;
      const params = e.params;

      // Log slow queries
      if (duration > this.queryConfig.slowQueryThreshold) {
        console.warn(`🐌 Slow Query (${duration}ms):`, {
          query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
          params,
          duration
        });
      }

      // Update query statistics
      this.updateQueryStats(query, duration);

      if (this.queryConfig.enableQueryLogging) {
        console.log(`📊 Query (${duration}ms):`, {
          query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
          duration
        });
      }
    });
  }

  private setupQueryOptimization(): void {
    // Clean up expired cache entries periodically
    setInterval(() => {
      this.cleanupQueryCache();
    }, 60000); // Every minute
  }

  private updateQueryStats(query: string, duration: number): void {
    const queryKey = this.normalizeQuery(query);
    const stats = this.queryStats.get(queryKey) || { count: 0, totalTime: 0, avgTime: 0 };
    
    stats.count++;
    stats.totalTime += duration;
    stats.avgTime = stats.totalTime / stats.count;
    
    this.queryStats.set(queryKey, stats);
  }

  private normalizeQuery(query: string): string {
    // Remove parameter values and normalize whitespace for better grouping
    return query
      .replace(/\$\d+/g, '$?') // Replace parameters
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim()
      .substring(0, 200);      // Limit length
  }

  private cleanupQueryCache(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, { timestamp }] of this.queryCache.entries()) {
      if (now - timestamp > this.queryConfig.cacheTTL) {
        expired.push(key);
      }
    }

    expired.forEach(key => this.queryCache.delete(key));

    if (expired.length > 0) {
      console.log(`🧹 Cleaned up ${expired.length} expired query cache entries`);
    }
  }

  // Query caching wrapper
  async cachedQuery<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    if (!this.queryConfig.enableQueryCache) {
      return queryFn();
    }

    // Check cache first
    const cached = this.queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < (ttl || this.queryConfig.cacheTTL)) {
      return cached.data;
    }

    // Execute query
    const result = await queryFn();

    // Cache result if cache isn't full
    if (this.queryCache.size < this.queryConfig.cacheSize) {
      this.queryCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
    }

    return result;
  }

  // Database health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency: number;
    connectionCount: number;
    cacheStats: any;
    queryStats: any;
  }> {
    const startTime = Date.now();
    
    try {
      // Simple query to test connection
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - startTime;

      const connectionCount = await this.getConnectionCount();
      const cacheStats = this.getCacheStats();
      const queryStats = this.getTopSlowQueries();

      return {
        status: 'healthy',
        latency,
        connectionCount,
        cacheStats,
        queryStats
      };
    } catch (error) {
      console.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        connectionCount: 0,
        cacheStats: this.getCacheStats(),
        queryStats: this.getTopSlowQueries()
      };
    }
  }

  private async getConnectionCount(): Promise<number> {
    try {
      const result = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM pg_stat_activity 
        WHERE datname = current_database()
      ` as any[];
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Failed to get connection count:', error);
      return 0;
    }
  }

  private getCacheStats() {
    return {
      size: this.queryCache.size,
      maxSize: this.queryConfig.cacheSize,
      ttl: this.queryConfig.cacheTTL,
      enabled: this.queryConfig.enableQueryCache
    };
  }

  private getTopSlowQueries(limit: number = 10) {
    const queries = Array.from(this.queryStats.entries())
      .map(([query, stats]) => ({ query, ...stats }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);

    return queries;
  }

  // Connection pool optimization
  async optimizeConnectionPool(): Promise<void> {
    console.log('🔧 Optimizing database connection pool...');
    
    // These would be applied during Prisma client initialization
    const recommendations = {
      connectionLimit: this.connectionConfig.maxConnections,
      poolTimeout: this.connectionConfig.acquireTimeoutMillis,
      connectionTimeoutMillis: this.connectionConfig.createTimeoutMillis,
    };

    console.log('📊 Connection Pool Recommendations:', recommendations);
  }

  // Index analysis and recommendations
  async analyzeIndexUsage(): Promise<any[]> {
    try {
      const indexStats = await this.prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        ORDER BY idx_scan DESC;
      ` as any[];

      const unusedIndexes = indexStats.filter(idx => idx.idx_scan === 0);
      
      if (unusedIndexes.length > 0) {
        console.warn(`⚠️  Found ${unusedIndexes.length} unused indexes:`, 
          unusedIndexes.map(idx => `${idx.tablename}.${idx.indexname}`)
        );
      }

      return indexStats;
    } catch (error) {
      console.error('Failed to analyze index usage:', error);
      return [];
    }
  }

  // Query performance analysis
  async getQueryPerformanceReport(): Promise<any> {
    const topSlowQueries = this.getTopSlowQueries(20);
    const cacheStats = this.getCacheStats();
    
    const report = {
      totalQueries: Array.from(this.queryStats.values()).reduce((sum, stats) => sum + stats.count, 0),
      averageQueryTime: Array.from(this.queryStats.values()).reduce((sum, stats) => sum + stats.avgTime, 0) / this.queryStats.size,
      slowQueries: topSlowQueries.filter(q => q.avgTime > this.queryConfig.slowQueryThreshold),
      cacheHitRate: this.calculateCacheHitRate(),
      cacheStats,
      recommendations: this.generatePerformanceRecommendations(topSlowQueries)
    };

    return report;
  }

  private calculateCacheHitRate(): number {
    // This would need to be tracked separately with cache hits/misses
    return 0.0; // Placeholder
  }

  private generatePerformanceRecommendations(slowQueries: any[]): string[] {
    const recommendations: string[] = [];

    if (slowQueries.length > 5) {
      recommendations.push('Consider adding database indexes for frequently used WHERE clauses');
    }

    if (!this.queryConfig.enableQueryCache) {
      recommendations.push('Enable query caching for better performance');
    }

    if (this.queryCache.size >= this.queryConfig.cacheSize * 0.9) {
      recommendations.push('Consider increasing query cache size');
    }

    return recommendations;
  }

  // Cleanup and shutdown
  async cleanup(): Promise<void> {
    this.queryCache.clear();
    this.queryStats.clear();
    await this.prisma.$disconnect();
  }
}

// Utility functions for common optimizations
export const createOptimizedPrismaClient = (databaseUrl?: string): PrismaClient => {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl || process.env.DATABASE_URL
      }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });
};

// Database connection helper with optimization
export const createDatabaseConnection = async (): Promise<{ prisma: PrismaClient; optimizer: DatabaseOptimizer }> => {
  const prisma = createOptimizedPrismaClient();
  const optimizer = new DatabaseOptimizer(prisma);

  // Test connection
  await prisma.$connect();
  console.log('✅ Database connected successfully');

  return { prisma, optimizer };
};

export default DatabaseOptimizer;