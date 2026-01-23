class Logger {
  constructor(private service: string) {}

  info(message: string, meta?: any) {
    console.log(`[${new Date().toISOString()}] [${this.service}] INFO: ${message}`, meta || '');
  }

  error(message: string, error?: Error, meta?: any) {
    console.error(`[${new Date().toISOString()}] [${this.service}] ERROR: ${message}`, error || '', meta || '');
  }

  warn(message: string, meta?: any) {
    console.warn(`[${new Date().toISOString()}] [${this.service}] WARN: ${message}`, meta || '');
  }

  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${new Date().toISOString()}] [${this.service}] DEBUG: ${message}`, meta || '');
    }
  }
}

export const logger = new Logger('moderation-service');
export default logger;