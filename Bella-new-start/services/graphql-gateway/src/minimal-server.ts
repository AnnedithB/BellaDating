import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';

const app = express();

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(config.cors));
app.use(express.json());

// Health check endpoint
app.get('/.well-known/apollo/server-health', (req, res) => {
  res.json({
    status: 'pass',
    service: 'graphql-gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Health check alias
app.get('/health', (req, res) => {
  res.json({
    status: 'success',
    data: {
      service: 'graphql-gateway',
      version: '1.0.0',
      status: 'healthy',
      timestamp: new Date().toISOString()
    }
  });
});

// GraphQL endpoint placeholder
app.post('/graphql', (req, res) => {
  res.json({
    data: {
      message: 'GraphQL Gateway is running. Full GraphQL functionality coming soon.'
    }
  });
});

// GraphQL playground
app.get('/graphql', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>GraphQL Gateway</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
          }
          h1 { color: #333; }
          .status { color: #28a745; font-weight: bold; }
          .info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
          code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <h1>GraphQL Gateway</h1>
        <p class="status">✓ Service is running</p>
        <div class="info">
          <h3>Available Endpoints:</h3>
          <ul>
            <li><code>GET /health</code> - Health check</li>
            <li><code>GET /.well-known/apollo/server-health</code> - Apollo health check</li>
            <li><code>POST /graphql</code> - GraphQL endpoint (placeholder)</li>
          </ul>
        </div>
        <div class="info">
          <h3>Connected Services:</h3>
          <ul>
            <li>User Service: ${config.services.user}</li>
            <li>Queuing Service: ${config.services.queuing}</li>
            <li>Interaction Service: ${config.services.interaction}</li>
            <li>History Service: ${config.services.history}</li>
            <li>Notification Service: ${config.services.notification}</li>
            <li>Moderation Service: ${config.services.moderation}</li>
          </ul>
        </div>
      </body>
    </html>
  `);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found'
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
});

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`GraphQL Gateway running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
  console.log(`Environment: ${config.nodeEnv}`);
});

export default app;
