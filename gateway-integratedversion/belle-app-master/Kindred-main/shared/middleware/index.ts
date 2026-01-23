import { AppError } from '../types';
import { generateRequestId, createTimer } from '../utils/helpers';
import { Logger } from '../utils/logger';

// Basic types for Express-like request/response objects
export interface BaseRequest {
  method: string;
  url: string;
  body?: any;
  params?: any;
  query?: any;
  headers?: any;
  ip?: string;
  requestId?: string;
  timer?: any;
  user?: {
    id: string;
    email: string;
    role: string;
  };
  get?(header: string): string | undefined;
}

export interface BaseResponse {
  status(code: number): BaseResponse;
  json(data: any): BaseResponse;
  setHeader(name: string, value: string): BaseResponse;
  send(data: any): BaseResponse;
  end(): void;
}

export type NextFunction = (error?: any) => void;

/**
 * Request ID middleware - adds unique request ID to each request
 */
export function requestId(req: BaseRequest, res: BaseResponse, next: NextFunction): void {
  req.requestId = generateRequestId();
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

/**
 * Request timer middleware - tracks request duration
 */
export function requestTimer(req: BaseRequest, res: BaseResponse, next: NextFunction): void {
  req.timer = createTimer();
  next();
}

/**
 * Request logging middleware factory
 */
export function requestLogger(logger: Logger) {
  return (req: BaseRequest, res: BaseResponse, next: NextFunction): void => {
    // Log incoming request
    logger.info(`Incoming ${req.method} ${req.url}`, {
      method: req.method,
      url: req.url,
      userAgent: req.get?.('User-Agent'),
      ip: req.ip,
      requestId: req.requestId,
    });

    // Note: In a real Express app, you'd wrap res.send to log the response
    next();
  };
}

/**
 * CORS middleware factory
 */
export function cors(allowedOrigins: string[], allowCredentials: boolean = true) {
  return (req: BaseRequest, res: BaseResponse, next: NextFunction): void => {
    const origin = req.get?.('Origin');
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    if (allowCredentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Request-ID'
    );
    
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, PATCH, OPTIONS'
    );
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    next();
  };
}

/**
 * Rate limiting middleware factory
 */
export function rateLimit(windowMs: number, maxRequests: number, keyGenerator?: (req: BaseRequest) => string) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: BaseRequest, res: BaseResponse, next: NextFunction): void => {
    const key = keyGenerator ? keyGenerator(req) : req.ip || 'unknown';
    const now = Date.now();
    
    // Clean up expired entries
    for (const [k, v] of requests.entries()) {
      if (now > v.resetTime) {
        requests.delete(k);
      }
    }
    
    const requestInfo = requests.get(key);
    
    if (requestInfo) {
      if (now < requestInfo.resetTime) {
        if (requestInfo.count >= maxRequests) {
          res.setHeader('X-RateLimit-Limit', maxRequests.toString());
          res.setHeader('X-RateLimit-Remaining', '0');
          res.setHeader('X-RateLimit-Reset', Math.ceil(requestInfo.resetTime / 1000).toString());
          
          const error = new AppError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED');
          return next(error);
        }
        
        requestInfo.count++;
      } else {
        // Reset window
        requests.set(key, { count: 1, resetTime: now + windowMs });
      }
    } else {
      // First request from this key
      requests.set(key, { count: 1, resetTime: now + windowMs });
    }
    
    const current = requests.get(key)!;
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current.count).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(current.resetTime / 1000).toString());
    
    next();
  };
}

/**
 * Request validation middleware factory
 */
export function validateRequest(schema: any) {
  return (req: BaseRequest, res: BaseResponse, next: NextFunction): void => {
    // Simple validation (in a real app, you'd use Joi or similar)
    if (schema.body) {
      const { error } = validateObject(req.body, schema.body);
      if (error) {
        const appError = new AppError('Request validation failed', 400, 'VALIDATION_ERROR', 
          [{ field: 'body', message: error }]
        );
        return next(appError);
      }
    }
    
    if (schema.params) {
      const { error } = validateObject(req.params, schema.params);
      if (error) {
        const appError = new AppError('Parameter validation failed', 400, 'VALIDATION_ERROR',
          [{ field: 'params', message: error }]
        );
        return next(appError);
      }
    }
    
    if (schema.query) {
      const { error } = validateObject(req.query, schema.query);
      if (error) {
        const appError = new AppError('Query validation failed', 400, 'VALIDATION_ERROR',
          [{ field: 'query', message: error }]
        );
        return next(appError);
      }
    }
    
    next();
  };
}

// Simple validation helper (replace with Joi in production)
function validateObject(obj: any, schema: any): { error?: string } {
  // This is a simplified validation - in production use Joi or similar
  if (!obj || typeof obj !== 'object') {
    return { error: 'Invalid object' };
  }
  
  // Add your validation logic here
  return {};
}

/**
 * Global error handler middleware
 */
export function errorHandler(logger: Logger) {
  return (error: any, req: BaseRequest, res: BaseResponse, next: NextFunction): void => {
    // Log the error
    logger.error('Request error', {
      error: error.message,
      stack: error.stack,
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      userId: req.user?.id,
    });

    // Handle AppError instances
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        status: 'error',
        message: error.message,
        code: error.code,
        details: error.details,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    // Handle validation errors (from libraries like Joi)
    if (error.name === 'ValidationError') {
      res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.details || [{ message: error.message }],
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    // Handle JWT errors
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        status: 'error',
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        status: 'error',
        message: 'Token expired',
        code: 'TOKEN_EXPIRED',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    // Handle database errors
    if (error.code === '23505') { // PostgreSQL unique violation
      res.status(409).json({
        status: 'error',
        message: 'Resource already exists',
        code: 'DUPLICATE_RESOURCE',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    if (error.code === '23503') { // PostgreSQL foreign key violation
      res.status(400).json({
        status: 'error',
        message: 'Invalid reference',
        code: 'INVALID_REFERENCE',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
      return;
    }

    // Default error response
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  };
}

/**
 * 404 handler middleware
 */
export function notFoundHandler(req: BaseRequest, res: BaseResponse): void {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.method} ${req.url} not found`,
    code: 'ROUTE_NOT_FOUND',
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    },
  });
}

/**
 * Health check middleware
 */
export function healthCheck(serviceName: string, version: string = '1.0.0') {
  return (req: BaseRequest, res: BaseResponse): void => {
    const healthData = {
      service: serviceName,
      version,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: 0, // Will be populated by actual implementation
      environment: 'development', // Default value
    };

    res.status(200).json({
      status: 'success',
      data: healthData,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      },
    });
  };
}

/**
 * Async middleware wrapper
 */
export function asyncHandler(fn: (req: BaseRequest, res: BaseResponse, next: NextFunction) => Promise<any>) {
  return (req: BaseRequest, res: BaseResponse, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}