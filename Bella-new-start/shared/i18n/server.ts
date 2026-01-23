/**
 * Server-side internationalization utilities for Real-time Connect
 * This module provides server-safe i18n functionality without browser dependencies
 */

import { ISupportedLanguage, ICulturalPreferences, ILocalizationContext } from '../types';

/**
 * Supported languages for the platform
 */
export const SUPPORTED_LANGUAGES: ISupportedLanguage[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    region: 'US',
    direction: 'ltr',
    flag: '🇺🇸',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    numberFormat: 'en-US',
    currency: 'USD'
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    region: 'ES',
    direction: 'ltr',
    flag: '🇪🇸',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    numberFormat: 'es-ES',
    currency: 'EUR'
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    region: 'FR',
    direction: 'ltr',
    flag: '🇫🇷',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    numberFormat: 'fr-FR',
    currency: 'EUR'
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    region: 'DE',
    direction: 'ltr',
    flag: '🇩🇪',
    dateFormat: 'DD.MM.YYYY',
    timeFormat: '24h',
    numberFormat: 'de-DE',
    currency: 'EUR'
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    region: 'JP',
    direction: 'ltr',
    flag: '🇯🇵',
    dateFormat: 'YYYY/MM/DD',
    timeFormat: '24h',
    numberFormat: 'ja-JP',
    currency: 'JPY'
  },
  {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    region: 'KR',
    direction: 'ltr',
    flag: '🇰🇷',
    dateFormat: 'YYYY.MM.DD',
    timeFormat: '12h',
    numberFormat: 'ko-KR',
    currency: 'KRW'
  },
  {
    code: 'zh',
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    region: 'CN',
    direction: 'ltr',
    flag: '🇨🇳',
    dateFormat: 'YYYY/MM/DD',
    timeFormat: '24h',
    numberFormat: 'zh-CN',
    currency: 'CNY'
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    region: 'SA',
    direction: 'rtl',
    flag: '🇸🇦',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h',
    numberFormat: 'ar-SA',
    currency: 'SAR'
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    region: 'IN',
    direction: 'ltr',
    flag: '🇮🇳',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h',
    numberFormat: 'hi-IN',
    currency: 'INR'
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    region: 'BR',
    direction: 'ltr',
    flag: '🇧🇷',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    numberFormat: 'pt-BR',
    currency: 'BRL'
  },
  {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    region: 'RU',
    direction: 'ltr',
    flag: '🇷🇺',
    dateFormat: 'DD.MM.YYYY',
    timeFormat: '24h',
    numberFormat: 'ru-RU',
    currency: 'RUB'
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    region: 'IT',
    direction: 'ltr',
    flag: '🇮🇹',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    numberFormat: 'it-IT',
    currency: 'EUR'
  }
];

/**
 * Translation resources cache
 */
const translationCache = new Map<string, Record<string, any>>();

/**
 * Simple translation service for server-side use
 */
export class ServerI18nService {
  private currentLanguage: string = 'en';
  private fallbackLanguage: string = 'en';
  private translations: Record<string, any> = {};
  private ready: boolean = false;

  constructor(language: string = 'en', fallbackLanguage: string = 'en') {
    this.currentLanguage = language;
    this.fallbackLanguage = fallbackLanguage;
  }

  /**
   * Load translations for a language
   */
  async loadTranslations(language: string): Promise<void> {
    try {
      const cacheKey = language;
      
      if (translationCache.has(cacheKey)) {
        this.translations = translationCache.get(cacheKey)!;
        this.ready = true;
        return;
      }

      // In a real implementation, you would load from files or database
      // For now, we'll use a simple mock
      const mockTranslations = this.getMockTranslations(language);
      
      this.translations = mockTranslations;
      translationCache.set(cacheKey, mockTranslations);
      this.ready = true;
    } catch (error) {
      console.error(`Failed to load translations for ${language}:`, error);
      // Fallback to English if available
      if (language !== this.fallbackLanguage) {
        await this.loadTranslations(this.fallbackLanguage);
      }
    }
  }

  /**
   * Get translation for a key
   */
  t(key: string, options: Record<string, any> = {}): string {
    const value = this.getNestedValue(this.translations, key);
    
    if (value === undefined) {
      console.warn(`Translation missing for key: ${key} in language: ${this.currentLanguage}`);
      return key;
    }

    // Simple interpolation
    if (typeof value === 'string') {
      return this.interpolate(value, options);
    }

    return String(value);
  }

  /**
   * Change current language
   */
  async changeLanguage(language: string): Promise<void> {
    if (!this.isLanguageSupported(language)) {
      throw new Error(`Language ${language} is not supported`);
    }

    this.currentLanguage = language;
    await this.loadTranslations(language);
  }

  /**
   * Track whether translations are loaded
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Initialize translations for a language
   */
  async init(language: string = this.currentLanguage): Promise<void> {
    await this.changeLanguage(language);
    this.ready = true;
  }

  /**
   * Placeholder for namespace loading to keep React helpers type-safe
   */
  async loadNamespace(namespace: string): Promise<void> {
    await this.loadTranslations(namespace);
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): string {
    return this.currentLanguage;
  }

  /**
   * Get supported language info
   */
  getSupportedLanguage(code: string): ISupportedLanguage | undefined {
    return SUPPORTED_LANGUAGES.find(lang => lang.code === code);
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): ISupportedLanguage[] {
    return SUPPORTED_LANGUAGES;
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(language: string): boolean {
    return SUPPORTED_LANGUAGES.some(lang => lang.code === language);
  }

  /**
   * Get localization context
   */
  getLocalizationContext(): ILocalizationContext {
    const supportedLang = this.getSupportedLanguage(this.currentLanguage);
    
    return {
      language: this.currentLanguage,
      region: supportedLang?.region || 'US',
      direction: supportedLang?.direction || 'ltr',
      locale: `${this.currentLanguage}-${supportedLang?.region || 'US'}`,
      culturalPreferences: {
        dateFormat: supportedLang?.dateFormat,
        timeFormat: supportedLang?.timeFormat,
        numberFormat: supportedLang?.numberFormat,
        currency: supportedLang?.currency,
        direction: supportedLang?.direction
      },
      supportedLanguage: supportedLang
    };
  }

  /**
   * Format number according to locale
   */
  formatNumber(value: number, options: Intl.NumberFormatOptions = {}): string {
    const context = this.getLocalizationContext();
    return new Intl.NumberFormat(context.locale, options).format(value);
  }

  /**
   * Format currency according to locale
   */
  formatCurrency(value: number, currency?: string): string {
    const context = this.getLocalizationContext();
    const currencyCode = currency || context.culturalPreferences.currency || 'USD';
    
    return new Intl.NumberFormat(context.locale, {
      style: 'currency',
      currency: currencyCode
    }).format(value);
  }

  /**
   * Format date according to locale
   */
  formatDate(date: Date, options: Intl.DateTimeFormatOptions = {}): string {
    const context = this.getLocalizationContext();
    return new Intl.DateTimeFormat(context.locale, options).format(date);
  }

  /**
   * Format time according to locale
   */
  formatTime(date: Date, options: Intl.DateTimeFormatOptions = {}): string {
    const context = this.getLocalizationContext();
    const supportedLang = context.supportedLanguage;
    const timeFormat = supportedLang?.timeFormat || '12h';
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: 'numeric',
      hour12: timeFormat === '12h'
    };

    return new Intl.DateTimeFormat(context.locale, { ...defaultOptions, ...options }).format(date);
  }

  /**
   * Format relative time
   */
  formatRelativeTime(date: Date, options: Intl.RelativeTimeFormatOptions = {}): string {
    const context = this.getLocalizationContext();
    const rtf = new Intl.RelativeTimeFormat(context.locale, { numeric: 'auto', ...options });
    
    const diff = date.getTime() - Date.now();
    const diffInDays = Math.floor(diff / (1000 * 60 * 60 * 24));
    const diffInHours = Math.floor(diff / (1000 * 60 * 60));
    const diffInMinutes = Math.floor(diff / (1000 * 60));

    if (Math.abs(diffInDays) >= 1) {
      return rtf.format(diffInDays, 'day');
    } else if (Math.abs(diffInHours) >= 1) {
      return rtf.format(diffInHours, 'hour');
    } else {
      return rtf.format(diffInMinutes, 'minute');
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Simple string interpolation
   */
  private interpolate(template: string, values: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return values[key] !== undefined ? String(values[key]) : match;
    });
  }

  /**
   * Mock translations for demonstration
   */
  private getMockTranslations(language: string): Record<string, any> {
    // In a real implementation, this would load from JSON files or database
    const translations: Record<string, Record<string, any>> = {
      en: {
        common: {
          buttons: {
            submit: 'Submit',
            cancel: 'Cancel',
            save: 'Save',
            delete: 'Delete'
          },
          errors: {
            generic: 'An error occurred. Please try again.',
            network: 'Network error. Please check your connection.'
          }
        },
        auth: {
          login: {
            title: 'Welcome Back',
            email_label: 'Email Address',
            password_label: 'Password'
          }
        }
      },
      es: {
        common: {
          buttons: {
            submit: 'Enviar',
            cancel: 'Cancelar',
            save: 'Guardar',
            delete: 'Eliminar'
          },
          errors: {
            generic: 'Ocurrió un error. Por favor, inténtalo de nuevo.',
            network: 'Error de red. Por favor, verifica tu conexión.'
          }
        },
        auth: {
          login: {
            title: 'Bienvenido de nuevo',
            email_label: 'Dirección de email',
            password_label: 'Contraseña'
          }
        }
      },
      fr: {
        common: {
          buttons: {
            submit: 'Soumettre',
            cancel: 'Annuler',
            save: 'Enregistrer',
            delete: 'Supprimer'
          },
          errors: {
            generic: 'Une erreur est survenue. Veuillez réessayer.',
            network: 'Erreur réseau. Veuillez vérifier votre connexion.'
          }
        },
        auth: {
          login: {
            title: 'Bon retour',
            email_label: 'Adresse e-mail',
            password_label: 'Mot de passe'
          }
        }
      }
    };

    return translations[language] || translations.en;
  }
}

/**
 * Language detection utilities for server environments
 */
export class ServerLanguageDetector {
  /**
   * Detect language from Accept-Language header
   */
  static detectFromHeader(acceptLanguage: string): string {
    if (!acceptLanguage) return 'en';

    const languages = acceptLanguage
      .split(',')
      .map(lang => {
        const [code, quality = '1'] = lang.trim().split(';q=');
        return {
          code: code.split('-')[0].toLowerCase(),
          quality: parseFloat(quality)
        };
      })
      .sort((a, b) => b.quality - a.quality);

    for (const lang of languages) {
      if (SUPPORTED_LANGUAGES.some(supported => supported.code === lang.code)) {
        return lang.code;
      }
    }

    return 'en';
  }

  /**
   * Detect language from user agent
   */
  static detectFromUserAgent(userAgent: string): string | null {
    // Simple user agent language detection
    const langPatterns = {
      zh: /zh-CN|zh-TW|zh-HK/i,
      ja: /ja/i,
      ko: /ko/i,
      ar: /ar/i,
      ru: /ru/i,
      de: /de/i,
      fr: /fr/i,
      es: /es/i,
      pt: /pt/i,
      it: /it/i
    };

    for (const [lang, pattern] of Object.entries(langPatterns)) {
      if (pattern.test(userAgent)) {
        return lang;
      }
    }

    return null;
  }

  /**
   * Detect language from IP address (would need external service)
   */
  static async detectFromIP(ipAddress: string): Promise<string | null> {
    // This would typically use a geolocation service
    // For demo purposes, return null
    return null;
  }

  /**
   * Comprehensive language detection
   */
  static detectLanguage(
    acceptLanguage?: string,
    userAgent?: string,
    ipAddress?: string
  ): string {
    // Priority order: Accept-Language > User-Agent > IP > Default
    
    if (acceptLanguage) {
      const headerLang = this.detectFromHeader(acceptLanguage);
      if (headerLang !== 'en') return headerLang;
    }

    if (userAgent) {
      const uaLang = this.detectFromUserAgent(userAgent);
      if (uaLang) return uaLang;
    }

    // IP detection would be async, so we'll skip for now
    
    return 'en'; // fallback
  }
}

/**
 * Create a server i18n instance for a specific request
 */
export function createServerI18n(
  language: string = 'en',
  fallbackLanguage: string = 'en'
): ServerI18nService {
  const service = new ServerI18nService(language, fallbackLanguage);
  service.loadTranslations(language);
  return service;
}

/**
 * Utility to get greeting based on time and language
 */
export function getLocalizedGreeting(language: string, hour: number = new Date().getHours()): string {
  const greetings: Record<string, { morning: string; afternoon: string; evening: string }> = {
    en: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
    es: { morning: 'Buenos días', afternoon: 'Buenas tardes', evening: 'Buenas noches' },
    fr: { morning: 'Bonjour', afternoon: 'Bon après-midi', evening: 'Bonsoir' },
    de: { morning: 'Guten Morgen', afternoon: 'Guten Tag', evening: 'Guten Abend' },
    ja: { morning: 'おはようございます', afternoon: 'こんにちは', evening: 'こんばんは' },
    ko: { morning: '좋은 아침', afternoon: '안녕하세요', evening: '좋은 저녁' },
    zh: { morning: '早上好', afternoon: '下午好', evening: '晚上好' },
    ar: { morning: 'صباح الخير', afternoon: 'مساء الخير', evening: 'مساء الخير' },
    hi: { morning: 'सुप्रभात', afternoon: 'नमस्ते', evening: 'शुभ संध्या' },
    pt: { morning: 'Bom dia', afternoon: 'Boa tarde', evening: 'Boa noite' },
    ru: { morning: 'Доброе утро', afternoon: 'Добрый день', evening: 'Добрый вечер' },
    it: { morning: 'Buongiorno', afternoon: 'Buon pomeriggio', evening: 'Buonasera' }
  };

  const langGreetings = greetings[language] || greetings.en;
  
  if (hour < 12) return langGreetings.morning;
  if (hour < 18) return langGreetings.afternoon;
  return langGreetings.evening;
}

/**
 * Check if a language uses RTL direction
 */
export function isRTLLanguage(language: string): boolean {
  const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
  return rtlLanguages.includes(language.toLowerCase());
}

/**
 * Get language direction
 */
export function getLanguageDirection(language: string): 'ltr' | 'rtl' {
  return isRTLLanguage(language) ? 'rtl' : 'ltr';
}

export default {
  ServerI18nService,
  ServerLanguageDetector,
  createServerI18n,
  getLocalizedGreeting,
  isRTLLanguage,
  getLanguageDirection,
  SUPPORTED_LANGUAGES
};