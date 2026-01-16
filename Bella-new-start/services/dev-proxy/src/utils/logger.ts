type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const levelToConsole: Record<LogLevel, typeof console.log> = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug ?? console.log,
};

const shouldDebug = () =>
  process.env.NODE_ENV === 'development' || process.env.DEV_PROXY_DEBUG === 'true';

export interface Logger {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
}

const formatPayload = (
  scope: string,
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>
) => ({
  scope,
  level,
  message,
  meta,
  timestamp: new Date().toISOString(),
});

export const createLogger = (scope: string): Logger => {
  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    if (level === 'debug' && !shouldDebug()) {
      return;
    }

    const payload = formatPayload(scope, level, message, meta);
    levelToConsole[level](JSON.stringify(payload));
  };

  return {
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta),
    debug: (message, meta) => log('debug', message, meta),
  };
};

export const globalLogger = createLogger('dev-proxy');
