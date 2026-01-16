# Services Status

## ✅ Running Services

| Service | Port | Status | Health | Documentation |
|---------|------|--------|--------|---------------|
| **User Service** | 3001 | ✅ Running | Healthy | [API Docs](../api-tests/USER_SERVICE.md) |
| **Queuing Service** | 3002 | ✅ Running | Healthy | [API Docs](../api-tests/QUEUING_SERVICE.md) |
| **Interaction Service** | 3003 | ✅ Running | Healthy | WebRTC Calls & Events |
| **History Service** | 3004 | ✅ Running | Healthy | Session History & Analytics |
| **Communication Service** | 3005 | ✅ Running | Healthy | Real-time Messaging & Socket.IO |
| **Notification Service** | 3006 | ✅ Running | Healthy | Push Notifications |
| **Moderation Service** | 3007 | ✅ Running | Healthy | AI Content Moderation |
| **Subscription Service** | 3010 | ✅ Running | Healthy | [API Docs](../api-tests/SUBSCRIPTION_SERVICE.md) |
| **GraphQL Gateway** | 4000 | ✅ Running | Healthy | API Gateway & Federation |

## 🔧 Infrastructure

| Component | Status | Port | Purpose |
|-----------|--------|------|---------|
| **PostgreSQL** | ✅ Healthy | 5432 | Database |
| **Redis** | ✅ Healthy | 6379 | Cache & Sessions |
| **RabbitMQ** | ✅ Healthy | 5672, 15672 | Message Queue |

## 📊 Quick Health Check

```powershell
# Check all services
Invoke-RestMethod -Uri "http://localhost:3001/health"  # User
Invoke-RestMethod -Uri "http://localhost:3002/health"  # Queuing
Invoke-RestMethod -Uri "http://localhost:3003/health"  # Interaction
Invoke-RestMethod -Uri "http://localhost:3004/health"  # History
Invoke-RestMethod -Uri "http://localhost:3005/health"  # Communication
Invoke-RestMethod -Uri "http://localhost:3006/health"  # Notification
Invoke-RestMethod -Uri "http://localhost:3007/health"  # Moderation
Invoke-RestMethod -Uri "http://localhost:3010/health"  # Subscription
Invoke-RestMethod -Uri "http://localhost:4000/health"  # GraphQL Gateway
```

## 🚀 Start Services

```powershell
# Start infrastructure
docker compose up -d postgres redis rabbitmq

# Start services
docker compose up -d user-service queuing-service subscription-service
```

## 🛑 Stop Services

```powershell
# Stop all
docker compose down

# Stop specific service
docker compose stop queuing-service
```

## 📝 View Logs

```powershell
# All services
docker compose logs -f

# Specific service
docker compose logs -f queuing-service

# Last 100 lines
docker compose logs --tail=100 queuing-service
```

## 🔄 Restart Service

```powershell
docker compose restart queuing-service
```

## 🏗️ Rebuild Service

```powershell
docker compose build queuing-service
docker compose up -d queuing-service
```

## ⚠️ Pending Services

The following services are not yet configured:

- Interaction Service (Port 3003)
- History Service (Port 3004)
- Communication Service (Port 3005)
- Notification Service (Port 3006)
- Moderation Service (Port 3007)
- Analytics Service (Port 3008)
- Admin Service (Port 3009)
- GraphQL Gateway (Port 4000)

## 📈 Next Steps

1. Test the running services with API calls
2. Set up remaining services one by one
3. Configure service-to-service communication
4. Add monitoring and logging
5. Set up CI/CD pipelines
