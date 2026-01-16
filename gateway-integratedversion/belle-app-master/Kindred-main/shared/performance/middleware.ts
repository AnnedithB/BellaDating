// Performance middleware placeholder to resolve dependencies
export interface PerformanceMiddlewareInterface {
  disabled: true;
}

export class PerformanceMiddleware implements PerformanceMiddlewareInterface {
  disabled = true as const;
  
  performanceTracker() {
    throw new Error("Performance middleware disabled - missing dependencies");
  }
  
  responseCache() {
    throw new Error("Performance middleware disabled - missing dependencies");
  }
  
  rateLimiter() {
    throw new Error("Performance middleware disabled - missing dependencies");
  }
  
  compressionMiddleware() {
    throw new Error("Performance middleware disabled - missing dependencies");
  }
}

export const performanceMiddleware = new PerformanceMiddleware();
