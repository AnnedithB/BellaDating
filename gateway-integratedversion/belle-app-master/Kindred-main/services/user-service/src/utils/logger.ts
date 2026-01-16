export class Logger {
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      service: this.serviceName,
      message,
      ...meta
    };
    return JSON.stringify(logData);
  }

  info(message: string, meta?: any): void {
    console.log(this.formatMessage('info', message, meta));
  }

  error(message: string, error?: Error | any, meta?: any): void {
    const errorMeta = error instanceof Error 
      ? { error: error.message, stack: error.stack, ...meta }
      : { error, ...meta };
    console.error(this.formatMessage('error', message, errorMeta));
  }

  warn(message: string, meta?: any): void {
    console.warn(this.formatMessage('warn', message, meta));
  }

  debug(message: string, meta?: any): void {
    console.debug(this.formatMessage('debug', message, meta));
  }
}

// Default logger instance
export const logger = new Logger('user-service');