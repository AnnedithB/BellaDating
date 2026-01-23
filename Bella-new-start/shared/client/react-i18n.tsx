import React, { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { i18nService, formatters } from '..';
import { ISupportedLanguage, ILocalizationContext } from '../types';

/**
 * i18n Context for React components
 */
interface I18nContextValue {
  language: string;
  region: string;
  locale: string;
  culturalPreferences: any;
  supportedLanguage?: ISupportedLanguage;
  supportedLanguages: ISupportedLanguage[];
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  t: (key: string, options?: any) => string;
  changeLanguage: (language: string) => Promise<void>;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (value: number, currency?: string) => string;
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatRelativeTime: (date: Date, options?: Intl.RelativeTimeFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * i18n Provider component
 */
interface I18nProviderProps {
  children: ReactNode;
  fallbackLanguage?: string;
  onLanguageChange?: (language: string) => void;
  loadingComponent?: ReactNode;
  errorComponent?: (error: string) => ReactNode;
}

export function I18nProvider({ 
  children, 
  fallbackLanguage = 'en',
  onLanguageChange,
  loadingComponent,
  errorComponent
}: I18nProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<ILocalizationContext | null>(null);
  const [supportedLanguages, setSupportedLanguages] = useState<ISupportedLanguage[]>([]);

  useEffect(() => {
    let mounted = true;

    const initializeI18n = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Wait for i18n service to be ready
        if (!i18nService.isReady()) {
          await i18nService.init();
        }

        if (!mounted) return;

        // Get initial context and supported languages
        const initialContext = i18nService.getLocalizationContext();
        const languages = i18nService.getSupportedLanguages();

        setContext(initialContext);
        setSupportedLanguages(languages);
        setIsReady(true);
      } catch (err) {
        if (!mounted) return;
        
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize i18n';
        setError(errorMessage);
        console.error('i18n initialization error:', err);
        
        // Try to fallback to default language
        try {
          await i18nService.changeLanguage(fallbackLanguage);
          const fallbackContext = i18nService.getLocalizationContext();
          setContext(fallbackContext);
          setIsReady(true);
        } catch (fallbackErr) {
          console.error('Failed to fallback to default language:', fallbackErr);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeI18n();

    return () => {
      mounted = false;
    };
  }, [fallbackLanguage]);

  const changeLanguage = async (language: string) => {
    try {
      setIsLoading(true);
      await i18nService.changeLanguage(language);
      
      const newContext = i18nService.getLocalizationContext();
      setContext(newContext);
      
      if (onLanguageChange) {
        onLanguageChange(language);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to change language';
      setError(errorMessage);
      console.error('Language change error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const contextValue: I18nContextValue = {
    language: context?.language || fallbackLanguage,
    region: context?.region || 'US',
    locale: context?.locale || `${fallbackLanguage}-US`,
    culturalPreferences: context?.culturalPreferences || {},
    supportedLanguage: context?.supportedLanguage,
    supportedLanguages,
    isReady,
    isLoading,
    error,
    t: (key: string, options?: any) => i18nService.t(key, options),
    changeLanguage,
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      formatters.number(value, context?.language || fallbackLanguage, options),
    formatCurrency: (value: number, currency?: string) =>
      formatters.currency(value, context?.language || fallbackLanguage, currency),
    formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) =>
      formatters.date(date, context?.language || fallbackLanguage, options),
    formatTime: (date: Date, options?: Intl.DateTimeFormatOptions) =>
      formatters.time(date, context?.language || fallbackLanguage, options),
    formatRelativeTime: (date: Date, options?: Intl.RelativeTimeFormatOptions) =>
      formatters.relativeTime(date, context?.language || fallbackLanguage, options)
  };

  if (isLoading && !isReady) {
    return loadingComponent || <div>Loading translations...</div>;
  }

  if (error && !isReady) {
    return errorComponent?.(error) || <div>Error loading translations: {error}</div>;
  }

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * Hook to use i18n in React components
 */
export function useTranslation() {
  const context = useContext(I18nContext);
  
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  
  return context;
}

/**
 * Hook for language-specific formatting
 */
export function useFormatters() {
  const { formatNumber, formatCurrency, formatDate, formatTime, formatRelativeTime } = useTranslation();
  
  return {
    formatNumber,
    formatCurrency,
    formatDate,
    formatTime,
    formatRelativeTime
  };
}

/**
 * Hook for cultural preferences
 */
export function useCulturalPreferences() {
  const { culturalPreferences, supportedLanguage } = useTranslation();
  
  return {
    preferences: culturalPreferences,
    language: supportedLanguage,
    isRTL: supportedLanguage?.direction === 'rtl',
    dateFormat: culturalPreferences.dateFormat,
    timeFormat: culturalPreferences.timeFormat,
    currency: culturalPreferences.currency
  };
}

/**
 * HOC for adding i18n props to components
 */
export function withTranslation<P extends object>(
  Component: React.ComponentType<P & I18nContextValue>
) {
  const WrappedComponent = (props: P) => {
    const i18nProps = useTranslation();
    return <Component {...props} {...i18nProps} />;
  };
  
  WrappedComponent.displayName = `withTranslation(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Component for conditional rendering based on language
 */
interface LanguageConditionalProps {
  language: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function LanguageConditional({ 
  language, 
  children, 
  fallback = null 
}: LanguageConditionalProps) {
  const { language: currentLanguage } = useTranslation();
  
  const languages = Array.isArray(language) ? language : [language];
  const shouldRender = languages.includes(currentLanguage);
  
  return shouldRender ? <>{children}</> : <>{fallback}</>;
}

/**
 * Component for RTL-aware styling
 */
interface RTLWrapperProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function RTLWrapper({ children, className, style }: RTLWrapperProps) {
  const { supportedLanguage } = useTranslation();
  const isRTL = supportedLanguage?.direction === 'rtl';
  
  const rtlStyle: React.CSSProperties = {
    ...style,
    direction: isRTL ? 'rtl' : 'ltr',
    textAlign: isRTL ? 'right' : 'left'
  };
  
  return (
    <div className={className} style={rtlStyle} dir={isRTL ? 'rtl' : 'ltr'}>
      {children}
    </div>
  );
}

/**
 * Language selector component
 */
interface LanguageSelectorProps {
  className?: string;
  showFlags?: boolean;
  showNativeNames?: boolean;
  onLanguageChange?: (language: string) => void;
}

export function LanguageSelector({ 
  className, 
  showFlags = true, 
  showNativeNames = true,
  onLanguageChange
}: LanguageSelectorProps) {
  const { language, supportedLanguages, changeLanguage, isLoading } = useTranslation();
  
  const handleLanguageChange = async (newLanguage: string) => {
    try {
      await changeLanguage(newLanguage);
      if (onLanguageChange) {
        onLanguageChange(newLanguage);
      }
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  };
  
  return (
    <select
      className={className}
      value={language}
      onChange={(e) => handleLanguageChange(e.target.value)}
      disabled={isLoading}
    >
      {supportedLanguages.map((lang: ISupportedLanguage) => (
        <option key={lang.code} value={lang.code}>
          {showFlags && lang.flag} {showNativeNames ? lang.nativeName : lang.name}
        </option>
      ))}
    </select>
  );
}

/**
 * Translation component for inline translations
 */
interface TranslationProps {
  i18nKey: string;
  values?: Record<string, any>;
  components?: Record<string, React.ReactElement>;
  fallback?: string;
}

export function Translation({ 
  i18nKey, 
  values, 
  components, 
  fallback 
}: TranslationProps) {
  const { t } = useTranslation();
  
  let translation = t(i18nKey, values) || fallback || i18nKey;
  
  // Simple component interpolation
  if (components) {
    Object.entries(components).forEach(([key, component]) => {
      const placeholder = `<${key}>`;
      const closingPlaceholder = `</${key}>`;
      
      if (translation.includes(placeholder) && translation.includes(closingPlaceholder)) {
        const startIndex = translation.indexOf(placeholder);
        const endIndex = translation.indexOf(closingPlaceholder) + closingPlaceholder.length;
        
        const before = translation.slice(0, startIndex);
        const content = translation.slice(startIndex + placeholder.length, endIndex - closingPlaceholder.length);
        const after = translation.slice(endIndex);
        
        // For simplicity, we'll return the content with the component
        // In a real implementation, you'd want more sophisticated interpolation
        return (
          <>
            {before}
            {React.cloneElement(component, {}, content)}
            {after}
          </>
        );
      }
    });
  }
  
  return <>{translation}</>;
}

/**
 * Hook for lazy loading translation namespaces
 */
export function useNamespace(namespace: string) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let mounted = true;
    
    const loadNamespace = async () => {
      try {
        await i18nService.loadNamespace(namespace);
        if (mounted) {
          setIsLoaded(true);
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load namespace';
          setError(errorMessage);
          console.error(`Failed to load namespace ${namespace}:`, err);
        }
      }
    };
    
    loadNamespace();
    
    return () => {
      mounted = false;
    };
  }, [namespace]);
  
  return { isLoaded, error };
}

/**
 * Hook for detecting user's preferred language
 */
export function useLanguageDetection() {
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [isDetecting, setIsDetecting] = useState(true);
  
  useEffect(() => {
    let mounted = true;
    
    const detectLanguage = async () => {
      try {
        // In a browser environment, you could use the LanguageDetector
        // For now, we'll use a simple browser language detection
        if (typeof navigator !== 'undefined') {
          const browserLang = navigator.language.split('-')[0];
          const supportedLanguages = i18nService.getSupportedLanguages();
          const isSupported = supportedLanguages.some((lang: ISupportedLanguage) => lang.code === browserLang);
          
          if (mounted) {
            setDetectedLanguage(isSupported ? browserLang : 'en');
            setConfidence(isSupported ? 0.8 : 0.5);
            setIsDetecting(false);
          }
        } else {
          if (mounted) {
            setDetectedLanguage('en');
            setConfidence(0.5);
            setIsDetecting(false);
          }
        }
      } catch (error) {
        if (mounted) {
          console.error('Language detection failed:', error);
          setDetectedLanguage('en');
          setConfidence(0.5);
          setIsDetecting(false);
        }
      }
    };
    
    detectLanguage();
    
    return () => {
      mounted = false;
    };
  }, []);
  
  return { detectedLanguage, confidence, isDetecting };
}

export default {
  I18nProvider,
  useTranslation,
  useFormatters,
  useCulturalPreferences,
  withTranslation,
  LanguageConditional,
  RTLWrapper,
  LanguageSelector,
  Translation,
  useNamespace,
  useLanguageDetection
};