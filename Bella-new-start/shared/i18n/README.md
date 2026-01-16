# Internationalization (i18n) System for Real-time Connect

This document provides a comprehensive guide to the internationalization system implemented across all microservices in the Real-time Connect platform.

## Overview

The i18n system provides:
- **Multi-language Support**: 12 languages with proper cultural formatting
- **Server-side Translation**: Backend API responses in user's preferred language
- **Cultural Formatting**: Dates, numbers, currencies, and names according to cultural norms
- **RTL Support**: Right-to-left languages like Arabic
- **Auto-detection**: Language detection from multiple sources
- **Middleware Integration**: Express middleware for seamless integration
- **Performance Optimized**: Caching and lazy loading for efficient translation delivery

## Supported Languages

| Code | Language | Native Name | Region | Direction | Currency |
|------|----------|-------------|---------|-----------|----------|
| `en` | English | English | US | LTR | USD |
| `es` | Spanish | Español | ES | LTR | EUR |
| `fr` | French | Français | FR | LTR | EUR |
| `de` | German | Deutsch | DE | LTR | EUR |
| `ja` | Japanese | 日本語 | JP | LTR | JPY |
| `ko` | Korean | 한국어 | KR | LTR | KRW |
| `zh` | Chinese | 简体中文 | CN | LTR | CNY |
| `ar` | Arabic | العربية | SA | RTL | SAR |
| `hi` | Hindi | हिन्दी | IN | LTR | INR |
| `pt` | Portuguese | Português | BR | LTR | BRL |
| `ru` | Russian | Русский | RU | LTR | RUB |
| `it` | Italian | Italiano | IT | LTR | EUR |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Client Request                                │
│  Browser Language: Accept-Language: en-US,es;q=0.9,fr;q=0.8    │
│  URL Parameter: ?lng=es                                         │
│  Cookie: rtc_language=fr                                        │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Language Detection                               │
│  Priority: URL Param > Cookie > Header > Default               │
│  Result: Detected Language = 'es'                              │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                 i18n Middleware                                 │
│  • Load translation resources                                   │
│  • Set cultural preferences                                     │
│  • Extend request with i18n functions                          │
│  • Set response locals                                          │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Service Logic                                   │
│  req.t('auth.login.title')                                     │
│  req.formatCurrency(123.45)                                    │
│  req.formatDate(new Date())                                     │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Localized Response                              │
│  {                                                              │
│    "message": "Bienvenido de nuevo",                           │
│    "date": "15 de enero de 2024",                             │
│    "amount": "€123,45"                                         │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Basic Service Integration

```typescript
import express from 'express';
import { createI18nMiddleware, I18nRequest } from '@realtime-connect/shared';

const app = express();

// Add i18n middleware
app.use(createI18nMiddleware({
  defaultLanguage: 'en',
  allowedLanguages: ['en', 'es', 'fr', 'de'],
  enableDetection: true
}));

// Use in routes
app.get('/api/welcome', (req: I18nRequest, res) => {
  res.json({
    message: req.t('common.welcome'),
    time: req.formatTime(new Date()),
    currency: req.formatCurrency(99.99)
  });
});
```

### 2. Language Management Routes

```typescript
import { 
  createLanguageSwitchHandler,
  createLanguageInfoHandler 
} from '@realtime-connect/shared';

// Switch language endpoint
app.post('/api/language/switch', createLanguageSwitchHandler());

// Get language info endpoint  
app.get('/api/language/info', createLanguageInfoHandler());
```

### 3. Direct Translation Usage

```typescript
import { t, formatters } from '@realtime-connect/shared';

// Direct translation
const message = t('auth.login.title', 'es');

// Direct formatting
const price = formatters.currency(123.45, 'es');
const date = formatters.date(new Date(), 'es');
```

## Translation Keys Structure

Translation keys follow a hierarchical structure using dot notation:

```json
{
  "common": {
    "buttons": {
      "submit": "Submit",
      "cancel": "Cancel"
    },
    "errors": {
      "generic": "An error occurred",
      "network": "Network error"
    }
  },
  "auth": {
    "login": {
      "title": "Welcome Back",
      "email_label": "Email Address"
    }
  },
  "profile": {
    "view": {
      "age": "{{age}} years old",
      "last_seen": "Last seen {{time}}"
    }
  }
}
```

### Key Naming Conventions

- **Modules**: `auth`, `profile`, `chat`, `settings`
- **Components**: `login`, `signup`, `view`, `edit`
- **Elements**: `title`, `subtitle`, `button`, `label`, `placeholder`
- **States**: `loading`, `error`, `success`, `empty`

### Interpolation

Support for variable interpolation using `{{variable}}` syntax:

```typescript
// Translation: "Welcome back, {{name}}!"
req.t('auth.welcome', { name: 'John' });
// Result: "Welcome back, John!"

// Translation: "{{count}} new message"
req.t('notifications.new_messages', { count: 5 });
// Result: "5 new messages"
```

## Cultural Formatting

### Date & Time Formatting

```typescript
const date = new Date();

// US Format (MM/DD/YYYY)
req.formatDate(date); // "01/15/2024"

// European Format (DD/MM/YYYY) 
req.formatDate(date); // "15/01/2024" (when language is 'fr', 'de', etc.)

// Asian Format (YYYY/MM/DD)
req.formatDate(date); // "2024/01/15" (when language is 'ja', 'ko', 'zh')

// Custom formatting
req.formatDate(date, { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
});
// "Monday, January 15, 2024" (English)
// "lunes, 15 de enero de 2024" (Spanish)
```

### Number & Currency Formatting

```typescript
const amount = 1234.56;

// Number formatting
req.formatNumber(amount);
// English: "1,234.56"
// French: "1 234,56"
// German: "1.234,56"

// Currency formatting
req.formatCurrency(amount);
// US: "$1,234.56"
// EU: "1.234,56 €"
// Japan: "¥1,235"

// Specific currency
req.formatCurrency(amount, 'GBP');
// "£1,234.56"
```

### Relative Time Formatting

```typescript
const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

req.formatRelativeTime(pastDate);
// English: "2 hours ago"
// Spanish: "hace 2 horas"
// French: "il y a 2 heures"
// Japanese: "2時間前"
```

## Language Detection

### Detection Priority

1. **URL Parameter**: `?lng=es` or `?language=es`
2. **URL Path**: `/es/profile` (when path detection enabled)
3. **Cookie**: `rtc_language=es`
4. **Accept-Language Header**: `Accept-Language: es-ES,es;q=0.9,en;q=0.8`
5. **Default Language**: Fallback to configured default

### Configuration Options

```typescript
const middleware = createI18nMiddleware({
  // Basic settings
  defaultLanguage: 'en',
  allowedLanguages: ['en', 'es', 'fr', 'de'],
  
  // Detection settings
  enableDetection: true,
  queryParam: 'lng',
  cookieName: 'rtc_language',
  headerName: 'Accept-Language',
  
  // Path detection
  enablePathDetection: true,
  pathPrefix: '', // '/api' for API-only detection
  
  // Cookie settings
  cookieOptions: {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  },
  
  // Debugging
  debug: process.env.NODE_ENV === 'development'
});
```

## RTL (Right-to-Left) Support

### Automatic Direction Detection

```typescript
import { isRTLLanguage, getLanguageDirection } from '@realtime-connect/shared';

isRTLLanguage('ar'); // true
isRTLLanguage('en'); // false

getLanguageDirection('ar'); // 'rtl'
getLanguageDirection('en'); // 'ltr'
```

### RTL-Aware Styling

```typescript
// In response data
app.get('/api/ui-config', (req: I18nRequest, res) => {
  const isRTL = req.culturalPreferences.direction === 'rtl';
  
  res.json({
    direction: req.culturalPreferences.direction,
    textAlign: isRTL ? 'right' : 'left',
    paddingLeft: isRTL ? '0' : '16px',
    paddingRight: isRTL ? '16px' : '0'
  });
});
```

## Error Handling

### Localized Error Messages

```typescript
app.use((error: Error, req: I18nRequest, res: Response, next: NextFunction) => {
  let errorKey = 'common.errors.generic';
  let statusCode = 500;

  if (error.message.includes('validation')) {
    errorKey = 'common.errors.validation';
    statusCode = 400;
  } else if (error.message.includes('unauthorized')) {
    errorKey = 'common.errors.unauthorized';
    statusCode = 401;
  }

  res.status(statusCode).json({
    error: req.t(errorKey),
    timestamp: req.formatDate(new Date(), { 
      dateStyle: 'short', 
      timeStyle: 'medium' 
    })
  });
});
```

### Validation Error Localization

```typescript
// Validation middleware
const validateEmail = (req: I18nRequest, res: Response, next: NextFunction) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      error: req.t('common.errors.required_field'),
      field: 'email'
    });
  }
  
  if (!isValidEmail(email)) {
    return res.status(400).json({
      error: req.t('common.errors.invalid_email')
    });
  }
  
  next();
};
```

## Best Practices

### 1. Translation Key Organization

```typescript
// ✅ Good: Hierarchical and descriptive
'auth.login.email_placeholder'
'profile.edit.save_button'
'chat.message.voice_note'

// ❌ Bad: Flat and unclear
'email_placeholder'
'save'
'voice'
```

### 2. Interpolation Usage

```typescript
// ✅ Good: Clear variable names
req.t('notifications.friend_request', { 
  senderName: 'Alice',
  timeAgo: '2 minutes ago'
});

// ❌ Bad: Unclear variables
req.t('notifications.friend_request', { 
  name: 'Alice',
  time: '2 minutes ago'
});
```

### 3. Cultural Sensitivity

```typescript
// ✅ Good: Consider cultural context
if (req.language === 'ar') {
  // Arabic: Family name first in formal contexts
  displayName = `${user.familyName} ${user.givenName}`;
} else {
  // Western: Given name first
  displayName = `${user.givenName} ${user.familyName}`;
}
```

### 4. Performance Optimization

```typescript
// ✅ Good: Cache translations per language
const translationCache = new Map();

app.get('/api/menu', async (req: I18nRequest, res) => {
  const cacheKey = `menu_${req.language}`;
  
  if (translationCache.has(cacheKey)) {
    return res.json(translationCache.get(cacheKey));
  }
  
  const menu = {
    items: [
      { label: req.t('menu.home'), path: '/' },
      { label: req.t('menu.profile'), path: '/profile' }
    ]
  };
  
  translationCache.set(cacheKey, menu);
  res.json(menu);
});
```

## Testing

### Unit Testing Translations

```typescript
import { createServerI18n } from '@realtime-connect/shared';

describe('Translations', () => {
  test('should return correct English translation', async () => {
    const i18n = createServerI18n('en');
    await i18n.loadTranslations('en');
    
    expect(i18n.t('auth.login.title')).toBe('Welcome Back');
  });
  
  test('should return correct Spanish translation', async () => {
    const i18n = createServerI18n('es');
    await i18n.loadTranslations('es');
    
    expect(i18n.t('auth.login.title')).toBe('Bienvenido de nuevo');
  });
  
  test('should format currency correctly', () => {
    const i18n = createServerI18n('es');
    expect(i18n.formatCurrency(123.45)).toBe('123,45 €');
  });
});
```

### Integration Testing

```typescript
import request from 'supertest';
import app from './app';

describe('i18n Integration', () => {
  test('should respond in Spanish when language is set', async () => {
    const response = await request(app)
      .get('/api/welcome')
      .set('Accept-Language', 'es-ES,es;q=0.9')
      .expect(200);
    
    expect(response.body.message).toContain('Bienvenido');
  });
  
  test('should switch language via API', async () => {
    const response = await request(app)
      .post('/api/language/switch')
      .send({ language: 'fr' })
      .expect(200);
    
    expect(response.body.language).toBe('fr');
  });
});
```

## Deployment Considerations

### Environment Variables

```bash
# Development
NODE_ENV=development
I18N_DEBUG=true
I18N_DEFAULT_LANGUAGE=en
I18N_CACHE_TTL=300

# Production
NODE_ENV=production
I18N_DEBUG=false
I18N_DEFAULT_LANGUAGE=en
I18N_CACHE_TTL=3600
I18N_CDN_URL=https://cdn.realtime-connect.com/translations
```

### CDN Integration

```typescript
// Load translations from CDN in production
const i18nConfig = createI18nMiddleware({
  backend: {
    loadPath: process.env.NODE_ENV === 'production'
      ? 'https://cdn.realtime-connect.com/translations/{{lng}}/{{ns}}.json'
      : '/locales/{{lng}}/{{ns}}.json'
  }
});
```

### Performance Monitoring

```typescript
import { monitoringService } from '@realtime-connect/shared';

// Track translation performance
app.use((req: I18nRequest, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    monitoringService.timer('i18n.request_duration', duration, {
      language: req.language,
      endpoint: req.path
    });
  });
  
  next();
});
```

## Troubleshooting

### Common Issues

**1. Missing Translations**
```typescript
// Enable debug mode to see missing keys
const middleware = createI18nMiddleware({
  debug: true,
  missingKeyHandler: (languages, namespace, key, fallbackValue) => {
    console.warn(`Missing translation: ${key} for ${languages.join(', ')}`);
  }
});
```

**2. Incorrect Formatting**
```typescript
// Check locale-specific formatting
const context = req.getLocalizationContext();
console.log('Current locale:', context.locale);
console.log('Cultural preferences:', context.culturalPreferences);
```

**3. Performance Issues**
```typescript
// Enable caching for frequently used translations
const translationCache = new Map();

// Monitor cache hit rates
app.get('/api/i18n/stats', (req, res) => {
  res.json({
    cacheSize: translationCache.size,
    supportedLanguages: req.getSupportedLanguages().length,
    currentLanguage: req.language
  });
});
```

## Migration Guide

### From Legacy System

```typescript
// Before: Manual string concatenation
const message = language === 'es' 
  ? 'Bienvenido, ' + userName 
  : 'Welcome, ' + userName;

// After: i18n system
const message = req.t('common.welcome_user', { name: userName });
```

### Adding New Languages

1. **Add language configuration** in `SUPPORTED_LANGUAGES`
2. **Create translation files** in `/shared/locales/{lang}/`
3. **Update middleware** to include new language in `allowedLanguages`
4. **Test formatting** for the new locale
5. **Update documentation** with new language support

## API Reference

### Middleware Functions

- `createI18nMiddleware(config)` - Main i18n middleware
- `createLanguageSwitchHandler(config)` - Language switching endpoint
- `createLanguageInfoHandler()` - Language information endpoint
- `createI18nErrorHandler()` - Error handler with i18n support

### Service Functions

- `t(key, language, options)` - Direct translation function
- `formatters.currency(value, language, currency)` - Currency formatting
- `formatters.date(date, language, options)` - Date formatting
- `getLocalizedGreeting(language, hour)` - Cultural greetings
- `isRTLLanguage(language)` - RTL language detection

### Request Extensions (I18nRequest)

- `req.t(key, options)` - Translate key
- `req.formatNumber(value, options)` - Format number
- `req.formatCurrency(value, currency)` - Format currency
- `req.formatDate(date, options)` - Format date
- `req.formatTime(date, options)` - Format time
- `req.formatRelativeTime(date, options)` - Format relative time
- `req.changeLanguage(language)` - Switch language
- `req.language` - Current language code
- `req.locale` - Current locale string
- `req.culturalPreferences` - Cultural formatting preferences

This comprehensive i18n system ensures that Real-time Connect can provide a localized experience for users across different cultures and languages, maintaining both technical excellence and cultural sensitivity.