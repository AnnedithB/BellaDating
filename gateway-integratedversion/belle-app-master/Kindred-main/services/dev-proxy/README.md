## Dev Proxy Service

Unified reverse proxy and lightweight API gateway that exposes every Kindred microservice under a single origin for local development and staging deployments.

### Why this exists

- One stable base URL (`http://localhost:4100` by default) for the mobile app, web app, GraphQL playground, etc.
- Central place to enable TLS, headers, auth, rate limits, or request logging without modifying every microservice.
- Easy service mocking: point any service target (`SERVICE_<NAME>_URL`) at a teammate’s tunnel or a mocked server.
- Shareable configuration: check in this proxy, deploy it to dev/staging, and everyone talks to the exact same routing table.

### Quick start

```bash
cd Kindred-main/services/dev-proxy
cp .env.example .env            # optional overrides
npm install
npm run dev                     # ts-node-dev watcher
# or build + run
npm run build && npm start
```

Then configure clients to hit `http://localhost:4100`. Example mappings:

| Mount path | Service | Default target | Notes |
|------------|---------|----------------|-------|
| `/api/user` | User service | `http://localhost:3001` | Auth + profiles |
| `/api/queue` | Queuing service | `http://localhost:3002` | Supports WebSockets |
| `/api/interaction` | Interaction service | `http://localhost:3003` | WebRTC signalling |
| `/api/history` | History service | `http://localhost:3007` | Analytics/history |
| `/api/communication` | Communication service | `http://localhost:3008` | WebSockets/chat |
| `/api/moderation` | Moderation service | `http://localhost:3009` | AI moderation |
| `/api/admin` | Admin service | `http://localhost:3006` | Admin dashboard |
| `/api/analytics` | Analytics service | `http://localhost:3005` | Metrics |
| `/api/notification` | Notification service | `http://localhost:3004` | Push delivery |
| `/api/subscription` | Subscription service | `http://localhost:3010` | Billing |
| `/graphql` | GraphQL gateway | `http://localhost:4000` | Disabled until gateway dependencies return |

See `/services` (JSON) for the live routing table and `/health` for proxy status.

### Configuration

All knobs are environment variables. Every service can override:

```
SERVICE_<KEY>_URL=http://localhost:3001
SERVICE_<KEY>_MOUNT_PATH=/api/custom
SERVICE_<KEY>_HEALTH_PATH=/readyz
SERVICE_<KEY>_STRIP_PREFIX=false     # keep the mount path when forwarding
SERVICE_<KEY>_WS=true                # enable WebSocket upgrades
SERVICE_<KEY>_ENABLED=false          # turn off when a backend is down
```

`<KEY>` matches the entries defined in `src/config/services.ts` (e.g., `USER`, `QUEUE`, `GRAPHQL`).

Global knobs (set these if your local services use different ports than the defaults above):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4100` | Listener port |
| `HOST` | `0.0.0.0` | Bind address |
| `CORS_ORIGIN` | `*` | Comma-separated allowlist |
| `DEV_PROXY_DEBUG` | `false` | Enables verbose log output |

### Testing & linting

```bash
npm run test         # vitest unit tests (SuperTest + local upstream stubs)
npm run build        # emits dist/
npm run typecheck    # tsc --noEmit
```

### Deployment

Use the included Dockerfile:

```bash
docker build -t kindred/dev-proxy .
docker run --env-file .env -p 4100:4100 kindred/dev-proxy
```

In Kubernetes or ECS you would run this proxy alongside the microservices and point clients at it; the proxy will forward to the per-service ClusterIP/Service URLs you configure via environment variables.
