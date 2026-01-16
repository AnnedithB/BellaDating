# Complete Microservices Setup Guide

## 📋 Overview

This guide will help you setup all 9 remaining microservices using the same pattern we used for user-service.

## ✅ What's Been Done

### User Service (COMPLETED ✓)
- ✅ Dockerfile optimized (3-stage build)
- ✅ Prisma client copying fixed
- ✅ Missing @types packages added
- ✅ Migrations created
- ✅ Service running perfectly
- ✅ All endpoints working

### Subscription Service (READY)
- ✅ Dockerfile fixed (Prisma client copying added)
- ⏭️ Needs: Build, start, and create migrations

## 🚀 Quick Setup (Automated)

### Option 1: Setup All Services at Once
```powershell
.\setup-all-services.ps1
```

This script will:
1. Build each service
2. Start each service
3. Create database migrations
4. Show health check results
5. Display summary report

### Option 2: Setup One Service at a Time

For each service, run these 3 commands:

```bash
# 1. Build
docker compose build <service-name>

# 2. Start
docker compose up -d <service-name>

# 3. Create migrations
docker compose exec <service-name> sh -c "cd /app/services/<service-name> && npx prisma migrate dev --name init"
```

## 📊 Services to Setup

| # | Service | Port | Database | Status |
|---|---------|------|----------|--------|
| 1 | user-service | 3001 | users | ✅ DONE |
| 2 | queuing-service | 3002 | queuing | ⏭️ TODO |
| 3 | interaction-service | 3003 | interactions | ⏭️ TODO |
| 4 | history-service | 3004 | history | ⏭️ TODO |
| 5 | communication-service | 3005 | communications | ⏭️ TODO |
| 6 | notification-service | 3006 | notifications | ⏭️ TODO |
| 7 | moderation-service | 3007 | moderation | ⏭️ TODO |
| 8 | analytics-service | 3008 | analytics | ⏭️ TODO |
| 9 | admin-service | 3009 | admin | ⏭️ TODO |
| 10 | subscription-service | 3010 | subscriptions | ⏭️ TODO |

## 🔧 Manual Setup Steps

### For Each Service:

#### Step 1: Build the Service
```bash
docker compose build subscription-service
```

#### Step 2: Start the Service
```bash
docker compose up -d subscription-service
```

#### Step 3: Create Migrations
```bash
docker compose exec subscription-service sh -c "cd /app/services/subscription-service && npx prisma migrate dev --name init"
```

#### Step 4: Verify
```bash
# Check status
docker compose ps subscription-service

# Check logs
docker compose logs -f subscription-service

# Test health
curl http://localhost:3010/health

# Check database tables
docker compose exec postgres psql -U postgres -d subscriptions -c "\dt"
```

## 📝 Service-Specific Commands

### Queuing Service
```bash
docker compose build queuing-service
docker compose up -d queuing-service
docker compose exec queuing-service sh -c "cd /app/services/queuing-service && npx prisma migrate dev --name init"
curl http://localhost:3002/health
```

### Interaction Service
```bash
docker compose build interaction-service
docker compose up -d interaction-service
docker compose exec interaction-service sh -c "cd /app/services/interaction-service && npx prisma migrate dev --name init"
curl http://localhost:3003/health
```

### History Service
```bash
docker compose build history-service
docker compose up -d history-service
docker compose exec history-service sh -c "cd /app/services/history-service && npx prisma migrate dev --name init"
curl http://localhost:3004/health
```

### Communication Service
```bash
docker compose build communication-service
docker compose up -d communication-service
docker compose exec communication-service sh -c "cd /app/services/communication-service && npx prisma migrate dev --name init"
curl http://localhost:3005/health
```

### Notification Service
```bash
docker compose build notification-service
docker compose up -d notification-service
docker compose exec notification-service sh -c "cd /app/services/notification-service && npx prisma migrate dev --name init"
curl http://localhost:3006/health
```

### Moderation Service
```bash
docker compose build moderation-service
docker compose up -d moderation-service
docker compose exec moderation-service sh -c "cd /app/services/moderation-service && npx prisma migrate dev --name init"
curl http://localhost:3007/health
```

### Analytics Service
```bash
docker compose build analytics-service
docker compose up -d analytics-service
docker compose exec analytics-service sh -c "cd /app/services/analytics-service && npx prisma migrate dev --name init"
curl http://localhost:3008/health
```

### Admin Service
```bash
docker compose build admin-service
docker compose up -d admin-service
docker compose exec admin-service sh -c "cd /app/services/admin-service && npx prisma migrate dev --name init"
curl http://localhost:3009/health
```

### Subscription Service
```bash
docker compose build subscription-service
docker compose up -d subscription-service
docker compose exec subscription-service sh -c "cd /app/services/subscription-service && npx prisma migrate dev --name init"
curl http://localhost:3010/health
```

## ✅ Verification Checklist

For each service, verify:

- [ ] Service builds successfully
- [ ] Service starts without errors
- [ ] Migrations are created
- [ ] Database tables exist
- [ ] Health endpoint responds
- [ ] Service logs show no errors

### Quick Verification Commands

```bash
# Check all services status
docker compose ps

# Check all services health
for port in 3001 3002 3003 3004 3005 3006 3007 3008 3009 3010; do
  echo "Testing port $port..."
  curl -s http://localhost:$port/health || echo "Failed"
done

# Check all databases
for db in users queuing interactions history communications notifications moderation analytics admin subscriptions; do
  echo "Database: $db"
  docker compose exec postgres psql -U postgres -d $db -c "\dt"
done
```

## 🐛 Common Issues & Solutions

### Issue 1: Build Fails with Network Timeout
**Solution:** Wait and retry:
```bash
docker compose build <service-name>
```

### Issue 2: Service Won't Start
**Check logs:**
```bash
docker compose logs <service-name>
```

**Common causes:**
- Database not ready → Wait for postgres healthcheck
- Port conflict → Check if port is in use
- Missing environment variables → Check .env file

### Issue 3: No Tables in Database
**Solution:** Create migrations:
```bash
docker compose exec <service-name> sh -c "cd /app/services/<service-name> && npx prisma migrate dev --name init"
```

### Issue 4: Migration Fails
**Possible causes:**
- Service not running → Start it first
- DATABASE_URL wrong → Check .env file
- Schema has errors → Check prisma/schema.prisma

### Issue 5: Prisma Client Not Found
**Solution:** Already fixed in Dockerfiles! Just rebuild:
```bash
docker compose build <service-name>
docker compose up -d <service-name>
```

## 📊 Expected Results

After setup, you should see:

### Docker Compose Status
```bash
$ docker compose ps

NAME                          STATUS
kindred-user-service          Up (healthy)
kindred-queuing-service       Up (healthy)
kindred-interaction-service   Up (healthy)
kindred-history-service       Up (healthy)
kindred-communication-service Up (healthy)
kindred-notification-service  Up (healthy)
kindred-moderation-service    Up (healthy)
kindred-analytics-service     Up (healthy)
kindred-admin-service         Up (healthy)
kindred-subscription-service  Up (healthy)
```

### Health Checks
All services should respond with:
```json
{
  "status": "success",
  "data": {
    "service": "<service-name>",
    "uptime": 123.456
  }
}
```

### Database Tables
Each database should have its respective tables created.

## 🎯 Success Criteria

✅ All services built successfully  
✅ All services running (healthy status)  
✅ All migrations created  
✅ All database tables exist  
✅ All health endpoints respond  
✅ No errors in logs  

## 📚 Related Documentation

- `SUBSCRIPTION_SERVICE_SETUP.md` - Detailed subscription service guide
- `PRISMA_MIGRATIONS_GUIDE.md` - Understanding migrations
- `USER_SERVICE_API_TESTS.md` - API testing guide (user-service example)
- `POSTMAN_TESTING_GUIDE.md` - Postman testing guide

## 🎉 Final Steps

Once all services are running:

1. **Test each service:**
   ```bash
   curl http://localhost:3001/health  # user-service
   curl http://localhost:3002/health  # queuing-service
   # ... and so on
   ```

2. **Check logs for errors:**
   ```bash
   docker compose logs -f
   ```

3. **Verify databases:**
   ```bash
   docker compose exec postgres psql -U postgres -l
   ```

4. **Start testing APIs:**
   - Use Postman collections
   - Test authentication flows
   - Test business logic

## 🚀 You're Ready!

All the fixes from user-service have been applied to subscription-service Dockerfile. The pattern is:

1. **3-stage Dockerfile** (deps → builder → production)
2. **Copy Prisma client** from builder to production
3. **docker-entrypoint.sh** runs migrations automatically
4. **Create migrations once** with `migrate dev`
5. **Migrations deploy automatically** on container restart

Just run the setup commands and you're good to go! 🎉
