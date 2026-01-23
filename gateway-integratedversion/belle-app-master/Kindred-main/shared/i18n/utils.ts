import { ISupportedLanguage, ICulturalPreferences } from '../types';

// Browser environment type declarations
declare const window: any;

/**
 * Language detection and management utilities
 */

/**
 * Detect user's preferred language from various sources
 */
export class LanguageDetector {
  /**
   * Detect language from browser settings
   */
  static detectFromBrowser(): string {
    if (typeof navigator === 'undefined') return 'en';
    
    // Get browser languages in order of preference
    const languages = navigator.languages || [navigator.language];
    
    for (const lang of languages) {
      const langCode = lang.split('-')[0].toLowerCase();
      if (this.isSupportedLanguage(langCode)) {
        return langCode;
      }
    }
    
    return 'en'; // fallback
  }

  /**
   * Detect language from URL parameters
   */
  static detectFromUrl(): string | null {
    if (typeof window === 'undefined') return null;
    
    const urlParams = new URLSearchParams(window.location.search);
    const lang = urlParams.get('lang') || urlParams.get('lng');
    
    return lang && this.isSupportedLanguage(lang) ? lang : null;
  }

  /**
   * Detect language from domain/subdomain
   */
  static detectFromDomain(): string | null {
    if (typeof window === 'undefined') return null;
    
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    
    // Check for language subdomain (e.g., es.example.com)
    if (parts.length > 2) {
      const subdomain = parts[0];
      if (this.isSupportedLanguage(subdomain)) {
        return subdomain;
      }
    }
    
    // Check for ccTLD (e.g., example.es)
    if (parts.length >= 2) {
      const tld = parts[parts.length - 1];
      const langFromTld = this.tldToLanguage(tld);
      if (langFromTld) {
        return langFromTld;
      }
    }
    
    return null;
  }

  /**
   * Detect language from user's IP location (would need external service)
   */
  static async detectFromLocation(): Promise<string | null> {
    try {
      // This would typically use a geolocation API
      // For demo purposes, we'll return null
      // In production, you might use services like:
      // - MaxMind GeoIP
      // - IP-API
      // - CloudFlare's CF-IPCountry header
      return null;
    } catch (error) {
      console.warn('Failed to detect language from location:', error);
      return null;
    }
  }

  /**
   * Get comprehensive language detection result
   */
  static async detectLanguage(): Promise<{
    detected: string;
    confidence: number;
    sources: { source: string; language: string; confidence: number }[];
  }> {
    const sources = [];
    
    // URL has highest priority
    const urlLang = this.detectFromUrl();
    if (urlLang) {
      sources.push({ source: 'url', language: urlLang, confidence: 1.0 });
    }
    
    // Domain detection
    const domainLang = this.detectFromDomain();
    if (domainLang) {
      sources.push({ source: 'domain', language: domainLang, confidence: 0.9 });
    }
    
    // Browser language
    const browserLang = this.detectFromBrowser();
    sources.push({ source: 'browser', language: browserLang, confidence: 0.8 });
    
    // Location-based detection
    const locationLang = await this.detectFromLocation();
    if (locationLang) {
      sources.push({ source: 'location', language: locationLang, confidence: 0.6 });
    }
    
    // Choose the highest confidence detection
    const bestDetection = sources.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
    
    return {
      detected: bestDetection.language,
      confidence: bestDetection.confidence,
      sources
    };
  }

  /**
   * Check if a language code is supported
   */
  private static isSupportedLanguage(code: string): boolean {
    const supportedCodes = [
      'en', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'ar', 'hi', 'pt', 'ru', 'it'
    ];
    return supportedCodes.includes(code.toLowerCase());
  }

  /**
   * Map TLD to language
   */
  private static tldToLanguage(tld: string): string | null {
    const tldMap: Record<string, string> = {
      'es': 'es',
      'fr': 'fr',
      'de': 'de',
      'jp': 'ja',
      'kr': 'ko',
      'cn': 'zh',
      'sa': 'ar',
      'in': 'hi',
      'br': 'pt',
      'ru': 'ru',
      'it': 'it'
    };
    
    return tldMap[tld.toLowerCase()] || null;
  }
}

/**
 * Language preference management
 */
export class LanguagePreferenceManager {
  private static STORAGE_KEY = 'rtc_language_preferences';

  /**
   * Save language preferences to localStorage
   */
  static savePreferences(preferences: {
    language: string;
    region?: string;
    culturalPreferences?: ICulturalPreferences;
  }): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        ...preferences,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to save language preferences:', error);
    }
  }

  /**
   * Load language preferences from localStorage
   */
  static loadPreferences(): {
    language: string;
    region?: string;
    culturalPreferences?: ICulturalPreferences;
    timestamp?: number;
  } | null {
    if (typeof localStorage === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('Failed to load language preferences:', error);
      return null;
    }
  }

  /**
   * Clear saved preferences
   */
  static clearPreferences(): void {
    if (typeof localStorage === 'undefined') return;
    
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear language preferences:', error);
    }
  }

  /**
   * Check if preferences are stale (older than 30 days)
   */
  static arePreferencesStale(): boolean {
    const preferences = this.loadPreferences();
    if (!preferences || !preferences.timestamp) return true;
    
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    return Date.now() - preferences.timestamp > thirtyDaysMs;
  }
}

/**
 * Cultural formatting utilities
 */
export class CulturalFormatter {
  /**
   * Format names according to cultural conventions
   */
  static formatName(
    firstName: string, 
    lastName: string, 
    language: string
  ): string {
    switch (language) {
      case 'ja':
      case 'ko':
      case 'zh':
        // Family name first in East Asian cultures
        return `${lastName} ${firstName}`;
      
      case 'ar':
        // Arabic names may have different conventions
        return `${firstName} ${lastName}`;
      
      default:
        // Western convention: first name, last name
        return `${firstName} ${lastName}`;
    }
  }

  /**
   * Format addresses according to cultural conventions
   */
  static formatAddress(
    street: string,
    city: string,
    region: string,
    country: string,
    language: string
  ): string {
    switch (language) {
      case 'ja':
        // Japanese: Country, Region, City, Street
        return `${country} ${region} ${city} ${street}`;
      
      case 'ko':
        // Korean: Country, Region, City, Street
        return `${country} ${region} ${city} ${street}`;
      
      case 'zh':
        // Chinese: Country, Region, City, Street
        return `${country} ${region} ${city} ${street}`;
      
      default:
        // Western: Street, City, Region, Country
        return `${street}, ${city}, ${region}, ${country}`;
    }
  }

  /**
   * Get appropriate greeting based on culture and time
   */
  static getGreeting(language: string, hour: number): string {
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
   * Get culturally appropriate color meanings
   */
  static getColorMeaning(color: string, language: string): string {
    const colorMeanings: Record<string, Record<string, string>> = {
      red: {
        en: 'passion, love, danger',
        zh: 'luck, prosperity, joy',
        ja: 'life, vitality',
        ar: 'power, strength'
      },
      white: {
        en: 'purity, peace',
        zh: 'mourning, death',
        ja: 'purity, cleanliness',
        ar: 'purity, peace'
      },
      black: {
        en: 'elegance, mystery',
        zh: 'water, career',
        ja: 'formality',
        ar: 'elegance, formality'
      }
    };

    return colorMeanings[color]?.[language] || colorMeanings[color]?.en || 'neutral';
  }

  /**
   * Format phone numbers according to regional conventions
   */
  static formatPhoneNumber(number: string, region: string): string {
    // Remove all non-digits
    const digits = number.replace(/\D/g, '');
    
    switch (region) {
      case 'US':
      case 'CA':
        // North American format: (123) 456-7890
        if (digits.length === 10) {
          return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        }
        break;
      
      case 'GB':
        // UK format: +44 1234 567890
        if (digits.length === 11) {
          return `+44 ${digits.slice(1, 5)} ${digits.slice(5)}`;
        }
        break;
      
      case 'DE':
        // German format: +49 123 456789
        if (digits.length >= 10) {
          return `+49 ${digits.slice(2, 5)} ${digits.slice(5)}`;
        }
        break;
      
      case 'JP':
        // Japanese format: +81 12-3456-7890
        if (digits.length === 11) {
          return `+81 ${digits.slice(1, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
        }
        break;
    }
    
    // Default: return as-is if no specific format found
    return number;
  }
}

/**
 * RTL (Right-to-Left) utilities for Arabic and Hebrew
 */
export class RTLUtils {
  /**
   * Check if a language uses RTL direction
   */
  static isRTL(language: string): boolean {
    const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
    return rtlLanguages.includes(language.toLowerCase());
  }

  /**
   * Apply RTL direction to CSS styles
   */
  static getRTLStyles(language: string): Record<string, string> {
    if (!this.isRTL(language)) return {};
    
    return {
      direction: 'rtl',
      textAlign: 'right'
    };
  }

  /**
   * Flip margin/padding values for RTL
   */
  static flipSpacing(
    value: string | number, 
    language: string
  ): string | number {
    if (!this.isRTL(language)) return value;
    
    if (typeof value === 'string' && value.includes(' ')) {
      const parts = value.split(' ');
      if (parts.length === 4) {
        // top right bottom left -> top left bottom right
        return `${parts[0]} ${parts[3]} ${parts[2]} ${parts[1]}`;
      }
    }
    
    return value;
  }

  /**
   * Get appropriate icon direction for RTL
   */
  static getIconDirection(iconName: string, language: string): string {
    if (!this.isRTL(language)) return iconName;
    
    const directionMap: Record<string, string> = {
      'arrow-right': 'arrow-left',
      'arrow-left': 'arrow-right',
      'chevron-right': 'chevron-left',
      'chevron-left': 'chevron-right',
      'caret-right': 'caret-left',
      'caret-left': 'caret-right'
    };
    
    return directionMap[iconName] || iconName;
  }
}

export default {
  LanguageDetector,
  LanguagePreferenceManager,
  CulturalFormatter,
  RTLUtils
};