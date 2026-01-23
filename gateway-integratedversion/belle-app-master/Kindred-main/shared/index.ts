// Cache exports
export { cacheService } from './cache';

// Database exports
export { DatabaseOptimizer, createOptimizedPrismaClient, createDatabaseConnection } from './database/optimizer';

// Monitoring exports
export { monitoringService } from './monitoring';

// Performance exports
export { performanceMiddleware } from './performance/middleware';

// Session exports
export { sessionManager } from './session/manager';

// Configuration exports
export { getPerformanceConfig, productionConfig, developmentConfig, testConfig, serviceOptimizations } from './config/performance';

// Internationalization exports
export { 
  i18nService, 
  initI18n, 
  formatters,
  t,
  getLocalizationContext,
  ServerI18nService,
  ServerLanguageDetector,
  createServerI18n,
  getLocalizedGreeting,
  isRTLLanguage,
  getLanguageDirection,
  SUPPORTED_LANGUAGES
} from './i18n';

// i18n middleware exports
export { 
  i18nMiddleware
} from './i18n/middleware';

// Types exports
export type { PerformanceConfig, ServiceOptimizations } from './config/performance';
export type { 
  ISupportedLanguage,
  ILocalizationContext,
  ICulturalPreferences,
  ITranslationConfig,
  IFormattingOptions
} from './types';
// Type exports from i18n
export type { I18nMiddlewareInterface } from './i18n/middleware';