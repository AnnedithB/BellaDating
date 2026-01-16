import http from 'http';
import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app';
import type { ProxyServiceConfig } from '../src/config/services';

const startUpstream = async (handler: http.RequestListener) => {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Failed to grab upstream port');
  }

  return {
    server,
    port: address.port,
  };
};

const buildService = (overrides: Partial<ProxyServiceConfig>): ProxyServiceConfig => ({
  key: 'test',
  label: 'Test Service',
  description: 'Test-only upstream',
  target: 'http://127.0.0.1:0',
  mountPath: '/api/test',
  ws: false,
  stripPrefix: true,
  enabled: true,
  healthPath: '/health',
  ...overrides,
});

describe('dev proxy app', () => {
  let upstream: { server: http.Server; port: number };

  beforeAll(async () => {
    upstream = await startUpstream((req, res) => {
      if (!req.url) {
        res.statusCode = 400;
        res.end('Missing url');
        return;
      }

      if (req.url.startsWith('/health')) {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          path: req.url,
          method: req.method,
          headers: req.headers,
        })
      );
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => upstream.server.close(() => resolve()));
  });

  it('exposes the routing table', async () => {
    const services = [
      buildService({
        key: 'alpha',
        label: 'Alpha Service',
        mountPath: '/api/alpha',
        target: `http://127.0.0.1:${upstream.port}`,
      }),
    ];

    const app = createApp({ services });
    const response = await request(app).get('/services').expect(200);

    expect(response.body.services).toEqual([
      expect.objectContaining({
        key: 'alpha',
        mountPath: '/api/alpha',
        target: `http://127.0.0.1:${upstream.port}`,
        ws: false,
        enabled: true,
      }),
    ]);
  });

  it('proxies requests and strips mount prefixes by default', async () => {
    const services = [
      buildService({
        mountPath: '/api/test',
        target: `http://127.0.0.1:${upstream.port}`,
      }),
    ];

    const app = createApp({ services });
    const response = await request(app).get('/api/test/example/path?foo=bar').expect(200);

    expect(response.body.path).toBe('/example/path?foo=bar');
  });

  it('queries upstream health endpoints via /services/:key/health', async () => {
    const services = [
      buildService({
        key: 'alpha',
        target: `http://127.0.0.1:${upstream.port}`,
      }),
    ];

    const app = createApp({ services });
    const response = await request(app).get('/services/alpha/health').expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        key: 'alpha',
        status: 'healthy',
        upstreamStatus: 200,
      })
    );
  });
});
