import compression from 'compression';
import cors from 'cors';
import express, { Application, Request, RequestHandler, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { ClientRequest, IncomingMessage, Server, ServerResponse } from 'http';
import { Socket } from 'net';
import { parse as parseUrl } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { loadServiceConfig, ProxyServiceConfig } from './config/services';
import { createLogger } from './utils/logger';

export interface CreateAppOptions {
  services?: ProxyServiceConfig[];
}

const logger = createLogger('dev-proxy:app');
const WS_ENTRIES_KEY = 'dev-proxy:wsEntries';
type ProxyMiddleware = RequestHandler & {
  upgrade: (req: IncomingMessage, socket: Socket, head: Buffer) => void;
};

interface WebSocketEntry {
  service: ProxyServiceConfig;
  proxy: ProxyMiddleware;
  mountPath: string;
}

const sanitizeMountPath = (path: string) => {
  if (path === '/') {
    return path;
  }

  const withPrefix = path.startsWith('/') ? path : `/${path}`;
  return withPrefix.replace(/\/+$/, '');
};

const createServiceProxy = (service: ProxyServiceConfig, mountPath: string) => {
  const stripPrefix = service.stripPrefix;
  const proxy = createProxyMiddleware<Request, Response>({
    target: service.target,
    changeOrigin: true,
    ws: service.ws,
    pathRewrite: stripPrefix
      ? (path) => path.replace(new RegExp(`^${mountPath}`), '') || '/'
      : undefined,
    on: {
      proxyReq: (proxyReq: ClientRequest, req: Request) => {
        proxyReq.setHeader('x-dev-proxy-service', service.key);
        proxyReq.setHeader('x-forwarded-proto', req.protocol);
      },
      proxyRes: (proxyRes: IncomingMessage) => {
        proxyRes.headers['x-dev-proxy-service'] = service.key;
      },
      error: (err: Error, req: Request, res: Response | Socket) => {
        logger.error('Proxy error', {
          service: service.key,
          path: req.originalUrl,
          message: err.message,
        });

        if ('setHeader' in res) {
          const expressRes = res as Response;
          if (!expressRes.headersSent) {
            expressRes.status(502).json({
              status: 'error',
              message: `Failed to reach ${service.label}`,
              details: err.message,
            });
          }
        } else if (!res.writableEnded) {
          res.end();
        }
      },
    },
  });

  return proxy;
};

const formatServices = (services: ProxyServiceConfig[]) =>
  services.map((service) => ({
    key: service.key,
    label: service.label,
    description: service.description,
    target: service.target,
    mountPath: service.mountPath,
    ws: service.ws,
    stripPrefix: service.stripPrefix,
    enabled: service.enabled,
    healthPath: service.healthPath,
  }));

const fetchServiceHealth = async (service: ProxyServiceConfig) => {
  try {
    const url = new URL(service.healthPath, service.target);
    const response = await fetch(url, {
      headers: {
        'x-forwarded-by': 'dev-proxy',
      },
    });

    const contentType = response.headers.get('content-type');
    const payload =
      contentType && contentType.includes('application/json')
        ? await response.json()
        : await response.text();

    return {
      key: service.key,
      status: response.ok ? 'healthy' : 'degraded',
      upstreamStatus: response.status,
      body: payload,
    };
  } catch (error) {
    return {
      key: service.key,
      status: 'unreachable',
      upstreamStatus: null,
      error: (error as Error).message,
    };
  }
};

export const createApp = ({ services: providedServices }: CreateAppOptions = {}) => {
  const services = providedServices ?? loadServiceConfig();
  const app = express();
  const wsEntries: WebSocketEntry[] = [];

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.set(WS_ENTRIES_KEY, wsEntries);
  app.set('dev-proxy:services', services);

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()) || '*',
      credentials: true,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      skip: () => process.env.NODE_ENV === 'test',
    })
  );

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      services: services.filter((service) => service.enabled).length,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/services', (_req, res) => {
    res.json({
      services: formatServices(services),
    });
  });

  app.get('/services/:serviceKey/health', async (req, res) => {
    const service = services.find((entry) => entry.key === req.params.serviceKey);

    if (!service) {
      return res.status(404).json({
        status: 'error',
        message: `Unknown service "${req.params.serviceKey}"`,
      });
    }

    const payload = await fetchServiceHealth(service);
    res.json(payload);
  });

  services
    .filter((service) => service.enabled)
    .forEach((service) => {
      const mountPath = sanitizeMountPath(service.mountPath);
      const proxy = createServiceProxy(service, mountPath);

      app.use(mountPath, proxy as any);

      logger.info('Registered proxy route', {
        service: service.key,
        mountPath,
        target: service.target,
        ws: service.ws,
      });

      if (service.ws) {
        wsEntries.push({
          service,
          proxy,
          mountPath,
        });
      }
    });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      status: 'error',
      message: 'Route not found',
    });
  });

  return app;
};

export const registerWebSocketHandlers = (server: Server, app: Application) => {
  const entries = (app.get(WS_ENTRIES_KEY) as WebSocketEntry[]) ?? [];
  if (!entries.length) {
    return;
  }

  server.on('upgrade', (req, socket: Socket, head) => {
    const pathname = req.url ? parseUrl(req.url).pathname ?? '' : '';
    const match = entries.find(
      ({ mountPath }) => pathname === mountPath || pathname.startsWith(`${mountPath}/`)
    );

    if (match) {
      match.proxy.upgrade(req, socket, head);
    }
  });
};
