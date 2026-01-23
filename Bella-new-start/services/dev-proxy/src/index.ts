import http from 'http';
import dotenv from 'dotenv';
import { createApp, registerWebSocketHandlers } from './app';
import { globalLogger } from './utils/logger';

dotenv.config();

const PORT = parseInt(process.env.PORT || '4100', 10);
const HOST = process.env.HOST || '0.0.0.0';

const app = createApp();
const server = http.createServer(app);

registerWebSocketHandlers(server, app);

const shutdown = (signal: NodeJS.Signals) => {
  globalLogger.info(`Received ${signal}, shutting down proxy`);
  server.close(() => {
    globalLogger.info('Proxy server closed');
    process.exit(0);
  });

  setTimeout(() => {
    globalLogger.warn('Force exiting after graceful timeout');
    process.exit(1);
  }, 10_000).unref();
};

server.listen(PORT, HOST, () => {
  globalLogger.info('Development proxy running', {
    host: HOST,
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
  });
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
