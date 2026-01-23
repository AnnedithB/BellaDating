import { config } from '../config';

// Log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Log entry interface
export interface LogEntry {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  meta?: Record<string, any>;
  stack?: string;
  requestId?: string;
  userId?: string;
}

// Simple logger utility class
export class Logger {
  private serviceName: string;
  private logLevel: LogLevel;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.logLevel = this.getLogLevel(config.logging.level);
  }

  private getLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private formatMessage(level: string, message: string, meta?: Record<string, any>, stack?: string): string {
    const timestamp = new Date().toISOString();
    
    if (config.isDevelopment()) {
      // Colorful console output for development
      const colors: Record<string, string> = {
        ERROR: '\x1b[31m', // Red
        WARN: '\x1b[33m',  // Yellow
        INFO: '\x1b[32m',  // Green
        DEBUG: '\x1b[36m', // Cyan
      };
      const reset = '\x1b[0m';
      
      let log = `${timestamp} ${colors[level]}[${level}]${reset} [${this.serviceName}]: ${message}`;
      
      if (meta?.requestId) {
        log += ` [${meta.requestId}]`;
      }
      
      if (meta && Object.keys(meta).filter(k => k !== 'requestId').length > 0) {
        log += `\n${JSON.stringify(meta, null, 2)}`;
      }
      
      if (stack) {
        log += `\n${stack}`;
      }
      
      return log;
    } else {
      // JSON format for production
      const logEntry: LogEntry = {
        timestamp,
        level,
        service: this.serviceName,
        message,
        meta,
        stack,
      };
      
      return JSON.stringify(logEntry);
    }
  }

  private writeLog(level: LogLevel, levelName: string, message: string, meta?: Record<string, any>, stack?: string): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(levelName, message, meta, stack);
    
    if (level === LogLevel.ERROR) {
      console.error(formattedMessage);
    } else if (level === LogLevel.WARN) {
      console.warn(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
  }

  // Method to create child logger with request context
  child(meta: Record<string, any>): Logger {
    const childLogger = new Logger(this.serviceName);
    childLogger.defaultMeta = { ...this.defaultMeta, ...meta };
    return childLogger;
  }

  private defaultMeta: Record<string, any> = {};

  // Convenience methods
  info(message: string, meta?: Record<string, any>): void {
    this.writeLog(LogLevel.INFO, 'INFO', message, { ...this.defaultMeta, ...meta });
  }

  error(message: string, error?: Error | Record<string, any>): void {
    let meta: Record<string, any> = { ...this.defaultMeta };
    let stack: string | undefined;

    if (error instanceof Error) {
      meta.error = error.message;
      stack = error.stack;
    } else if (error) {
      meta = { ...meta, ...error };
    }

    this.writeLog(LogLevel.ERROR, 'ERROR', message, meta, stack);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.writeLog(LogLevel.WARN, 'WARN', message, { ...this.defaultMeta, ...meta });
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.writeLog(LogLevel.DEBUG, 'DEBUG', message, { ...this.defaultMeta, ...meta });
  }

  // Request logging
  request(req: any, res: any, duration?: number): void {
    const meta = {
      ...this.defaultMeta,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id,
      requestId: req.requestId,
      duration: duration ? `${duration}ms` : undefined,
    };

    const message = `${req.method} ${req.url} - ${res.statusCode}`;
    
    if (res.statusCode >= 400) {
      this.error(message, meta);
    } else {
      this.info(message, meta);
    }
  }

  // Database operation logging
  database(operation: string, table: string, duration?: number, meta?: Record<string, any>): void {
    this.debug(`Database ${operation} on ${table}`, {
      ...this.defaultMeta,
      operation,
      table,
      duration: duration ? `${duration}ms` : undefined,
      ...meta,
    });
  }

  // WebSocket event logging
  socket(event: string, userId?: string, meta?: Record<string, any>): void {
    this.info(`Socket event: ${event}`, {
      ...this.defaultMeta,
      event,
      userId,
      ...meta,
    });
  }

  // Queue operation logging
  queue(operation: string, intent: string, meta?: Record<string, any>): void {
    this.info(`Queue ${operation} for intent: ${intent}`, {
      ...this.defaultMeta,
      operation,
      intent,
      ...meta,
    });
  }

  // Performance logging
  performance(operation: string, duration: number, meta?: Record<string, any>): void {
    const message = `Performance: ${operation} took ${duration}ms`;
    const logMeta = {
      ...this.defaultMeta,
      operation,
      duration,
      ...meta,
    };

    if (duration > 1000) {
      this.warn(message, logMeta);
    } else {
      this.info(message, logMeta);
    }
  }

  // Security event logging
  security(event: string, severity: 'low' | 'medium' | 'high', meta?: Record<string, any>): void {
    this.warn(`Security event: ${event}`, {
      ...this.defaultMeta,
      event,
      severity,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }
}

// Create logger factory function
export function createLogger(serviceName: string): Logger {
  return new Logger(serviceName);
}

// Export default logger factory
export default Logger;