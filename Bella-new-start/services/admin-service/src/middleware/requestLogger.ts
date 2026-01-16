import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Log the incoming request
  logger.info('Incoming request:', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Override the end function to log response
  const originalEnd = res.end.bind(res);
  res.end = ((chunk?: any, encoding?: any): Response => {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed:', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

    return originalEnd(chunk, encoding);
  }) as any;

  next();
};