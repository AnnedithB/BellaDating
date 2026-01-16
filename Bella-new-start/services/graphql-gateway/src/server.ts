import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { config } from './config';
import { createContext } from './context';

export async function startApolloServer() {
  const app = express();
  const httpServer = http.createServer(app);

  // Apollo Server setup
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        requestDidStart() {
          return Promise.resolve({
            didResolveOperation: async (requestContext: any) => {
              const operationName = requestContext.request.operationName;
              const query = requestContext.request.query;
              console.log(`[GraphQL] Operation: ${operationName || 'unnamed'}`);
              if (query) {
                // Log first 200 chars of query to see what's being called
                const queryPreview = query.substring(0, 200).replace(/\s+/g, ' ');
                console.log(`[GraphQL] Query preview: ${queryPreview}...`);
              }
            },
            willSendResponse: async (requestContext: any) => {
              if (requestContext.errors && requestContext.errors.length > 0) {
                console.error(`[GraphQL] Errors in response:`, requestContext.errors);
              }
            },
          });
        },
      },
    ],
    introspection: true, // Enable GraphQL Playground
    formatError: (error) => {
      // Log full error details for debugging
      const errorDetails: any = {
        message: error.message,
        code: error.extensions?.code,
        path: error.path,
        locations: error.locations,
      };
      
      // Type assertion to access properties that may exist on the underlying error
      const errorAny = error as any;
      if (errorAny.stack) {
        errorDetails.stack = errorAny.stack;
      }
      if (errorAny.originalError) {
        errorDetails.originalError = errorAny.originalError?.message;
      }
      
      console.error('GraphQL Error:', errorDetails);
      
      // Return sanitized error for client
      const formattedError: any = {
        message: error.message,
        code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
        path: error.path,
      };
      
      // Include additional context in development
      if (process.env.NODE_ENV === 'development') {
        if (error.locations) {
          formattedError.locations = error.locations;
        }
        if (errorAny.stack) {
          formattedError.stack = errorAny.stack;
        }
      }
      
      return formattedError;
    },
  });

  await server.start();

  // Middleware - CORS before helmet to ensure CORS headers aren't blocked
  app.use(cors(config.cors));
  app.use(helmet({ 
    contentSecurityPolicy: config.nodeEnv === 'production',
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  }));

  // Proxy all /profile/* routes to user-service - BEFORE express.json()
  // This allows the frontend to use the GraphQL gateway URL for all API calls
  // Must be before express.json() to handle multipart/form-data correctly
  app.use('/profile', createProxyMiddleware({
    target: config.services.user,
    changeOrigin: true,
    pathRewrite: {
      '^/profile': '/profile', // Keep the path as-is
    },
    logLevel: 'debug',
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[PROXY] Proxying ${req.method} ${req.originalUrl} to ${config.services.user}${proxyReq.path}`);
      console.log(`[PROXY] Content-Type: ${req.headers['content-type']}`);
      // Forward the authorization header if present
      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
        console.log(`[PROXY] Authorization header forwarded`);
      }
      // Preserve Content-Type for multipart/form-data
      if (req.headers['content-type']) {
        proxyReq.setHeader('Content-Type', req.headers['content-type']);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`[PROXY] Response status: ${proxyRes.statusCode} for ${req.originalUrl}`);
      if (proxyRes.statusCode >= 400) {
        console.log(`[PROXY] Error response for ${req.originalUrl}`);
      }
    },
    onError: (err, req, res) => {
      console.error('[PROXY] Proxy error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Proxy error', message: err.message });
      }
    },
  }));

  // Proxy /uploads/* routes to user-service for serving uploaded files
  // This allows files to be accessed through the gateway URL
  app.use('/uploads', createProxyMiddleware({
    target: config.services.user,
    changeOrigin: true,
    pathRewrite: {
      '^/uploads': '/uploads', // Keep the path as-is
    },
    logLevel: 'info',
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[PROXY] Proxying file request ${req.method} ${req.originalUrl} to ${config.services.user}${proxyReq.path}`);
    },
    onProxyRes: (proxyRes, req, res) => {
      // Ensure CORS headers are forwarded from user-service
      const origin = req.headers.origin;
      if (origin) {
        // Extract allowed origins array from environment or use defaults
        const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
          'http://localhost:3000',
          'http://localhost:4000',
          'http://localhost:8080',
          'http://localhost:8081',
          'http://localhost:8082',
          'http://localhost:8083',
          'http://localhost:8084',
          'http://localhost:8085',
          'http://localhost:8086',
          'http://localhost:8087',
          'http://localhost:8088',
          'http://localhost:8089',
          'http://localhost:8090',
          'http://localhost:19006',
          'http://127.0.0.1:8081',
          'http://127.0.0.1:8082',
          'http://51.20.160.210:4000',
          'http://51.20.160.210:3000',
          'http://51.20.160.210:8081',
        ];
        
        const isAllowed = allowedOrigins.some(allowed => {
          try {
            const allowedUrl = new URL(allowed.trim());
            const originUrl = new URL(origin.trim());
            return originUrl.origin === allowedUrl.origin || origin.includes(allowedUrl.hostname);
          } catch {
            return origin.includes(allowed.trim());
          }
        });
        
        if (isAllowed || origin.includes('localhost') || origin.includes('127.0.0.1')) {
          proxyRes.headers['access-control-allow-origin'] = origin;
        }
      }
      
      // Ensure cross-origin resource policy is set
      if (!proxyRes.headers['cross-origin-resource-policy']) {
        proxyRes.headers['cross-origin-resource-policy'] = 'cross-origin';
      }
      
      // Forward other CORS headers if present
      if (proxyRes.headers['access-control-allow-methods']) {
        res.setHeader('Access-Control-Allow-Methods', proxyRes.headers['access-control-allow-methods']);
      }
      if (proxyRes.headers['access-control-allow-headers']) {
        res.setHeader('Access-Control-Allow-Headers', proxyRes.headers['access-control-allow-headers']);
      }
      if (proxyRes.headers['access-control-allow-credentials']) {
        res.setHeader('Access-Control-Allow-Credentials', proxyRes.headers['access-control-allow-credentials']);
      }
    },
    onError: (err, req, res) => {
      console.error('[PROXY] File proxy error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Proxy error', message: err.message });
      }
    },
  }));

  // JSON parsing middleware (after proxy routes)
  app.use(express.json());

  // Health check endpoints
  app.get('/health', (req, res) => {
    res.json({
      status: 'success',
      data: {
        service: 'graphql-gateway',
        version: '1.0.0',
        status: 'healthy',
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.get('/.well-known/apollo/server-health', (req, res) => {
    res.json({
      status: 'pass',
      service: 'graphql-gateway',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Request logging middleware for GraphQL
  app.use('/graphql', (req, res, next) => {
    console.log(`[GraphQL] ${req.method} ${req.path}`, {
      hasAuth: !!req.headers.authorization,
      contentType: req.headers['content-type'],
      origin: req.headers.origin,
    });
    next();
  });

  // GraphQL endpoint
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: createContext,
    })
  );

  // 404 handler for unmatched routes (after all other routes)
  app.use((req, res, next) => {
    console.log(`[404] Unmatched route: ${req.method} ${req.url}`);
    res.status(404).json({
      status: 'error',
      message: 'Not found',
      path: req.url,
      method: req.method,
    });
  });

  const PORT = config.port;

  await new Promise<void>((resolve) => httpServer.listen({ port: PORT }, resolve));

  console.log(`🚀 GraphQL Gateway ready at http://localhost:${PORT}/graphql`);
  console.log(`📊 Health check at http://localhost:${PORT}/health`);
  console.log(`🔍 Environment: ${config.nodeEnv}`);

  return { server, app, httpServer };
}

// Start server if this file is run directly
if (require.main === module) {
  startApolloServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
