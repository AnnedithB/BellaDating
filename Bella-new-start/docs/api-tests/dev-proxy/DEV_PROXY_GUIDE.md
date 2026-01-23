# Dev Proxy - Unified Development Gateway

## 🎯 What is Dev-Proxy?

**Dev-Proxy is a unified reverse proxy and API gateway** that sits in front of all your microservices during development. Instead of remembering 10+ different ports, you access everything through **one single port: 4100**.

## 🤔 Why Do We Need It?

### Without Dev-Proxy (Current Setup):
```
User Service:          http://localhost:3001
Queuing Service:       http://localhost:3002
Interaction Service:   http://localhost:3003
History Service:       http://localhost:3004
Communication Service: http://localhost:3005
Notification Service:  http://localhost:3006
Moderation Service:    http://localhost:3007
Analytics Service:     http://localhost:3008
Admin Service:         http://localhost:3009
Subscription Service:  http://localhost:3010
GraphQL Gateway:       http://localhost:4000
```

**Problems:**
- ❌ Remember 11 different ports
- ❌ Configure CORS for each service
- ❌ No unified logging
- ❌ Hard to test frontend integration
- ❌ Difficult to switch between services

### With Dev-Proxy:
```
ALL SERVICES: http://localhost:4100
```

**Benefits:**
- ✅ Single entry point for all services
- ✅ Automatic routing to correct service
- ✅ WebSocket support for real-time features
- ✅ Unified logging and monitoring
- ✅ Easy CORS configuration
- ✅ Health checks for all services
- ✅ Production-like environment

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│         Frontend / Client / Postman             │
│                                                 │
│         http://localhost:4100                   │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│           Dev-Proxy (Port 4100)                 │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │   Routing Rules:                         │  │
│  │   /api/user/*        → User Service      │  │
│  │   /api/queue/*       → Queue Service     │  │
│  │   /api/interaction/* → Interaction       │  │
│  │   /api/history/*     → History           │  │
│  │   /api/communication/* → Communication   │  │
│  │   /api/moderation/*  → Moderation        │  │
│  │   /api/admin/*       → Admin             │  │
│  │   /api/analytics/*   → Analytics         │  │
│  │   /api/notification/* → Notification     │  │
│  │   /api/subscription/* → Subscription     │  │
│  │   /graphql           → GraphQL Gateway   │  │
│  └──────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
        ▼         ▼         ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │  User  │ │ Queue  │ │History │
    │ (3001) │ │ (3002) │ │ (3004) │
    └────────┘ └────────┘ └────────┘
```

---

## 📋 Service Routing Table

| Service | Mount Path | Target Port | WebSocket | Strip Prefix |
|---------|-----------|-------------|-----------|--------------|
| User | `/api/user` | 3001 | ❌ | ✅ |
| Queue | `/api/queue` | 3002 | ✅ | ✅ |
| Interaction | `/api/interaction` | 3003 | ✅ | ✅ |
| History | `/api/history` | 3007 | ❌ | ✅ |
| Communication | `/api/communication` | 3008 | ✅ | ✅ |
| Moderation | `/api/moderation` | 3009 | ❌ | ✅ |
| Admin | `/api/admin` | 3006 | ❌ | ✅ |
| Analytics | `/api/analytics` | 3005 | ❌ | ✅ |
| Notification | `/api/notification` | 3004 | ❌ | ✅ |
| Subscription | `/api/subscription` | 3010 | ❌ | ✅ |
| GraphQL | `/graphql` | 4000 | ❌ | ❌ |

---

## 🚀 How It Works

### 1. Path Rewriting (Strip Prefix)

**Request:**
```
GET http://localhost:4100/api/user/profile
```

**Dev-Proxy:**
1. Matches `/api/user` → User Service
2. Strips `/api/user` prefix
3. Forwards to: `http://localhost:3001/profile`

**Without Strip Prefix (GraphQL):**
```
POST http://localhost:4100/graphql
```
Forwards to: `http://localhost:4000/graphql` (no stripping)

### 2. WebSocket Support

Services with `ws: true` support WebSocket connections:

**Example:**
```javascript
// Connect to queue service via proxy
const ws = new WebSocket('ws://localhost:4100/api/queue/match');

// Dev-proxy automatically forwards to:
// ws://localhost:3002/match
```

### 3. Header Injection

Dev-proxy adds headers to every request:

```
x-dev-proxy-service: user
x-forwarded-proto: http
```

Services can use these headers for logging and debugging.

---

## 🔧 Configuration

### Environment Variables

Each service can be configured via environment variables:

```bash
# User Service Example
SERVICE_USER_URL=http://localhost:3001
SERVICE_USER_MOUNT_PATH=/api/user
SERVICE_USER_HEALTH_PATH=/health
SERVICE_USER_WS=false
SERVICE_USER_STRIP_PREFIX=true
SERVICE_USER_ENABLED=true

# Queue Service Example
SERVICE_QUEUE_URL=http://localhost:3002
SERVICE_QUEUE_MOUNT_PATH=/api/queue
SERVICE_QUEUE_WS=true
SERVICE_QUEUE_ENABLED=true
```

### Default Configuration

If no environment variables are set, dev-proxy uses defaults from `services.ts`:

```typescript
{
  key: 'user',
  label: 'User Service',
  defaultTarget: 'http://localhost:3001',
  mountPath: '/api/user',
  ws: false,
  stripPrefix: true,
  enabledByDefault: true,
  healthPath: '/health'
}
```

---

## 📡 API Endpoints

### Health Check
```
GET http://localhost:4100/health
```

**Response:**
```json
{
  "status": "ok",
  "services": 10,
  "timestamp": "2025-12-14T10:00:00.000Z"
}
```

### List All Services
```
GET http://localhost:4100/services
```

**Response:**
```json
{
  "services": [
    {
      "key": "user",
      "label": "User Service",
      "description": "Authentication, profiles and account management.",
      "target": "http://localhost:3001",
      "mountPath": "/api/user",
      "ws": false,
      "stripPrefix": true,
      "enabled": true,
      "healthPath": "/health"
    },
    ...
  ]
}
```

### Check Service Health
```
GET http://localhost:4100/services/user/health
```

**Response:**
```json
{
  "key": "user",
  "status": "healthy",
  "upstreamStatus": 200,
  "body": {
    "status": "success",
    "data": {
      "service": "user-service",
      "version": "1.0.0"
    }
  }
}
```

---

## 💡 Usage Examples

### Example 1: Register User

**Without Dev-Proxy:**
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}'
```

**With Dev-Proxy:**
```bash
curl -X POST http://localhost:4100/api/user/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}'
```

### Example 2: Join Queue

**Without Dev-Proxy:**
```bash
curl -X POST http://localhost:3002/api/queue/join \
  -H "Authorization: Bearer TOKEN"
```

**With Dev-Proxy:**
```bash
curl -X POST http://localhost:4100/api/queue/api/queue/join \
  -H "Authorization: Bearer TOKEN"
```

### Example 3: GraphQL Query

**Without Dev-Proxy:**
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { me { id } }"}'
```

**With Dev-Proxy:**
```bash
curl -X POST http://localhost:4100/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { me { id } }"}'
```

### Example 4: WebSocket Connection

**JavaScript:**
```javascript
// Connect to interaction service for WebRTC signaling
const ws = new WebSocket('ws://localhost:4100/api/interaction/signal');

ws.onopen = () => {
  console.log('Connected via dev-proxy');
};

ws.onmessage = (event) => {
  console.log('Message:', event.data);
};
```

---

## 🎨 Frontend Integration

### React Example

```typescript
// config.ts
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4100';

export const api = {
  user: `${API_BASE_URL}/api/user`,
  queue: `${API_BASE_URL}/api/queue`,
  interaction: `${API_BASE_URL}/api/interaction`,
  graphql: `${API_BASE_URL}/graphql`,
};

// userService.ts
import { api } from './config';

export const registerUser = async (data) => {
  const response = await fetch(`${api.user}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
};
```

### Environment Variables

```bash
# Development
REACT_APP_API_URL=http://localhost:4100

# Production
REACT_APP_API_URL=https://api.kindred.com
```

---

## 🔍 Debugging

### Enable Debug Logging

```bash
NODE_ENV=development npm run dev
```

### Check Service Status

```bash
# Check if dev-proxy is running
curl http://localhost:4100/health

# Check specific service
curl http://localhost:4100/services/user/health

# List all services
curl http://localhost:4100/services
```

### Common Issues

#### 1. Service Unreachable

**Error:**
```json
{
  "status": "error",
  "message": "Failed to reach User Service"
}
```

**Solution:**
- Check if the service is running: `docker ps | grep user-service`
- Verify the service port is correct
- Check service health: `curl http://localhost:3001/health`

#### 2. WebSocket Connection Failed

**Error:** `WebSocket connection failed`

**Solution:**
- Ensure service has `ws: true` in configuration
- Check if service supports WebSocket
- Verify WebSocket endpoint exists

#### 3. CORS Error

**Error:** `Access-Control-Allow-Origin`

**Solution:**
- Dev-proxy handles CORS automatically
- Check `CORS_ORIGIN` environment variable
- Default allows all origins in development

---

## 🚦 Running Dev-Proxy

### Option 1: Standalone (Development)

```bash
cd services/dev-proxy
npm install
npm run dev
```

### Option 2: Docker (Production-like)

```bash
docker compose up -d dev-proxy
```

### Option 3: Docker Build

```bash
docker build -t kindred/dev-proxy -f services/dev-proxy/Dockerfile .
docker run -p 4100:4100 kindred/dev-proxy
```

---

## 📊 Monitoring

### Request Logging

Dev-proxy logs all requests in development:

```
GET /api/user/profile 200 45ms
POST /api/queue/join 201 123ms
WS /api/interaction/signal - -
```

### Service Health Dashboard

```bash
# Check all services at once
curl http://localhost:4100/services | jq '.services[] | {key, enabled, target}'
```

---

## 🎯 Benefits Summary

### For Developers:
- ✅ Single URL to remember
- ✅ No CORS configuration needed
- ✅ Easy to test full stack
- ✅ Production-like routing
- ✅ Unified logging

### For Frontend:
- ✅ One API base URL
- ✅ Easy environment switching
- ✅ WebSocket support
- ✅ Consistent error handling

### For Testing:
- ✅ Test all services together
- ✅ Easy to mock services
- ✅ Health check all services
- ✅ Monitor request flow

---

## 🔄 Comparison

### Direct Access vs Dev-Proxy

| Feature | Direct Access | Dev-Proxy |
|---------|--------------|-----------|
| Ports to remember | 11 | 1 |
| CORS setup | Per service | Once |
| WebSocket | Complex | Automatic |
| Logging | Scattered | Unified |
| Health checks | Manual | Built-in |
| Production-like | ❌ | ✅ |
| Easy frontend integration | ❌ | ✅ |

---

## 📝 Quick Reference

### All Endpoints via Dev-Proxy

```
# User Service
http://localhost:4100/api/user/*

# Queue Service
http://localhost:4100/api/queue/*

# Interaction Service
http://localhost:4100/api/interaction/*

# History Service
http://localhost:4100/api/history/*

# Communication Service
http://localhost:4100/api/communication/*

# Moderation Service
http://localhost:4100/api/moderation/*

# Admin Service
http://localhost:4100/api/admin/*

# Analytics Service
http://localhost:4100/api/analytics/*

# Notification Service
http://localhost:4100/api/notification/*

# Subscription Service
http://localhost:4100/api/subscription/*

# GraphQL Gateway
http://localhost:4100/graphql
```

---

## 🎓 Summary

**Dev-Proxy is your unified development gateway** that makes working with microservices as easy as working with a monolith. Instead of juggling 11 different ports, you get:

- **One port:** 4100
- **One URL:** http://localhost:4100
- **All services:** Accessible through intuitive paths
- **Production-ready:** Same routing as production
- **Developer-friendly:** Automatic logging, health checks, and WebSocket support

**Start using dev-proxy today and simplify your development workflow!** 🚀
