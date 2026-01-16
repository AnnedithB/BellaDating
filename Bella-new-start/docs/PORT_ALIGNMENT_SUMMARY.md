# Port Alignment Summary

## Backend Services (docker-compose.yml)

| Service | Port | Container Name |
|---------|------|----------------|
| user-service | 3001 | kindred-user-service |
| queuing-service | 3002 | kindred-queuing-service |
| interaction-service | 3003 | kindred-interaction-service |
| history-service | 3004 | kindred-history-service |
| communication-service | 3005 | kindred-communication-service |
| notification-service | 3006 | kindred-notification-service |
| moderation-service | 3007 | kindred-moderation-service |
| analytics-service | 3008 | kindred-analytics-service |
| admin-service | 3009 | kindred-admin-service |
| subscription-service | 3010 | kindred-subscription-service |
| graphql-gateway | 4000 | kindred-graphql-gateway |
| dev-proxy | 4100 | kindred-dev-proxy |

## Frontend Configuration (.env)

| Variable | Port | Service |
|----------|------|---------|
| API_URL | 4000 | GraphQL Gateway |
| USER_SERVICE_URL | 3001 | User Service |
| WS_URL | 3005 | Communication Service (WebSocket) |
| INTERACTION_SERVICE_URL | 3003 | Interaction Service |
| SUBSCRIPTION_SERVICE_URL | 3010 | Subscription Service |
| COMMUNICATION_SERVICE_URL | 3005 | Communication Service |
| NOTIFICATION_SERVICE_URL | 3006 | Notification Service |

## Frontend Default Values (app.config.js)

All default values have been updated to match backend ports:
- `getApiUrl()`: `localhost:4000` ✓
- `getUserServiceUrl()`: `localhost:3001` ✓
- `getWsUrl()`: `localhost:3005` ✓ (was 3006)
- `getCommunicationServiceUrl()`: `localhost:3005` ✓ (was 3006)
- `getInteractionServiceUrl()`: `localhost:3003` ✓ (was 3457)
- `getSubscriptionServiceUrl()`: `localhost:3010` ✓ (was 3009)
- `getNotificationServiceUrl()`: `localhost:3006` ✓ (was 3004)

## Frontend Default Values (config.js)

- `DEFAULT_DEV_WS_URL`: `3005` ✓
- `DEFAULT_DEV_COMMUNICATION_SERVICE_URL`: `3005` ✓
- `DEFAULT_DEV_INTERACTION_SERVICE_URL`: `3003` ✓ (was 3457)
- `DEFAULT_DEV_SUBSCRIPTION_SERVICE_URL`: `3010` ✓ (was 3006)

## CORS Configuration

### GraphQL Gateway
- CORS_ORIGIN: `http://localhost:3000,http://localhost:8081,http://localhost:8080` ✓

### Communication Service
- ALLOWED_ORIGINS: `http://localhost:3000,http://localhost:8081,http://localhost:8080` ✓

### Interaction Service
- ALLOWED_ORIGINS: `http://localhost:3000,http://localhost:8081,http://localhost:8080` ✓
- SOCKET_CORS_ORIGIN: `http://localhost:3000,http://localhost:8081,http://localhost:8080` ✓

## Fixed Issues

1. ✅ Fixed interaction-service default port from 3457 → 3003
2. ✅ Fixed subscription-service default port from 3009 → 3010
3. ✅ Fixed communication-service default port from 3006 → 3005
4. ✅ Fixed notification-service default port from 3004 → 3006
5. ✅ Fixed WebSocket URL from 3006 → 3005
6. ✅ Added CORS configuration for communication-service and interaction-service
7. ✅ Updated interaction-service service URLs to match actual ports

## Notes

- All ports are now aligned between backend and frontend
- CORS is configured to allow `localhost:8081` (your frontend port)
- WebSocket connections use port 3005 (communication-service)
- Interaction service WebSocket also uses port 3003

