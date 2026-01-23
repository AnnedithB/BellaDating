import winston from 'winston';
import { config } from './config';

const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.colorize({
    all: true
  })
);

export const logger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  defaultMeta: {
    service: 'history-service',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add file transport in production
if (config.nodeEnv === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.json()
    })
  );
  
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.json()
    })
  );
}