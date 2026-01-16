/**
 * Server-side internationalization for Real-time Connect
 * This module provides comprehensive i18n support for the backend services
 */

import { 
  ServerI18nService, 
  ServerLanguageDetector, 
  createServerI18n,
  getLocalizedGreeting,
  isRTLLanguage,
  getLanguageDirection,
  SUPPORTED_LANGUAGES
} from './server';

import { 
  ISupportedLanguage, 
  ILocalizationContext,
  ICulturalPreferences,
  ITranslationConfig,
  IFormattingOptions
} from '../types';

/**
 * Default i18n service instance
 */
export const i18nService = new ServerI18nService();

/**
 * Initialize i18n service with specific language
 */
export async function initI18n(language: string = 'en'): Promise<ServerI18nService> {
  const service = createServerI18n(language);
  await service.loadTranslations(language);
  return service;
}

/**
 * Common formatting functions
 */
export const formatters = {
  number: (value: number, language: string = 'en', options?: Intl.NumberFormatOptions) => {
    const service = createServerI18n(language);
    return service.formatNumber(value, options);
  },
  
  currency: (value: number, language: string = 'en', currency?: string) => {
    const service = createServerI18n(language);
    return service.formatCurrency(value, currency);
  },
  
  date: (date: Date, language: string = 'en', options?: Intl.DateTimeFormatOptions) => {
    const service = createServerI18n(language);
    return service.formatDate(date, options);
  },
  
  time: (date: Date, language: string = 'en', options?: Intl.DateTimeFormatOptions) => {
    const service = createServerI18n(language);
    return service.formatTime(date, options);
  },
  
  relativeTime: (date: Date, language: string = 'en', options?: Intl.RelativeTimeFormatOptions) => {
    const service = createServerI18n(language);
    return service.formatRelativeTime(date, options);
  }
};

/**
 * Translation function for quick usage
 */
export function t(key: string, language: string = 'en', options: Record<string, any> = {}): string {
  const service = createServerI18n(language);
  return service.t(key, options);
}

/**
 * Get localization context for a language
 */
export function getLocalizationContext(language: string = 'en'): ILocalizationContext {
  const service = createServerI18n(language);
  return service.getLocalizationContext();
}

// Re-export everything from server module
export {
  ServerI18nService,
  ServerLanguageDetector,
  createServerI18n,
  getLocalizedGreeting,
  isRTLLanguage,
  getLanguageDirection,
  SUPPORTED_LANGUAGES
};

// Re-export types
export type {
  ISupportedLanguage,
  ILocalizationContext,
  ICulturalPreferences,
  ITranslationConfig,
  IFormattingOptions
};

export default {
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
};