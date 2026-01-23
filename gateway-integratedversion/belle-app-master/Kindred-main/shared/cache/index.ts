// Cache service placeholder to resolve dependencies
export interface CacheServiceInterface {
  disabled: true;
}

export class CacheService implements CacheServiceInterface {
  disabled = true as const;
  
  async connect() {
    throw new Error("Cache service disabled - missing dependencies");
  }
  
  async disconnect() {
    // No-op
  }
  
  async get() {
    throw new Error("Cache service disabled - missing dependencies");
  }
  
  async set() {
    throw new Error("Cache service disabled - missing dependencies");
  }
  
  async del() {
    throw new Error("Cache service disabled - missing dependencies");
  }
}

export const cacheService = new CacheService();
