# Quick Reference Card

## 🚀 Common Commands

```bash
# Build all services
docker compose build

# Build single service
docker compose build user-service

# Start all services
docker compose up -d

# Start single service
docker compose up -d user-service

# Stop all services
docker compose down

# View logs
docker compose logs -f user-service

# Check status
docker compose ps

# Restart service
docker compose restart user-service

# Rebuild and restart
docker compose up -d --build user-service
```

## 📊 Check Image Sizes

```bash
docker images | grep kindred
```

## 🔍 Debugging

```bash
# Enter container
docker compose exec user-service sh

# View full logs
docker compose logs user-service

# Check health
docker compose ps user-service

# Inspect container
docker inspect kindred-user-service
```

## 📁 File Locations

```
services/
├── user-service/
│   ├── Dockerfile              # Optimized 3-stage build
│   ├── docker-entrypoint.sh    # Startup script
│   └── package.json            # Updated with @types
├── admin-service/
│   ├── Dockerfile
│   └── docker-entrypoint.sh
└── ... (8 more services)

Documentation:
├── COMPLETION_SUMMARY.md       # Final results
├── DOCKER_OPTIMIZATION_SUMMARY.md
├── DOCKER_ENTRYPOINT_GUIDE.md
├── USER_SERVICE_OPTIMIZATION_DETAILS.md
├── QUICK_START_OPTIMIZED.md
├── OPTIMIZATION_CHECKLIST.md
└── QUICK_REFERENCE.md (this file)
```

## ✅ What Changed

1. **Entrypoint Scripts**: Each service has docker-entrypoint.sh
2. **Dockerfiles**: 3-stage builds (deps → builder → production)
3. **Docker Compose**: No more inline commands
4. **Image Size**: 65% reduction (800MB → 278MB for user-service)

## 🎯 Key Features

- ✅ Automatic Prisma migrations on startup
- ✅ Clear logging with emojis (🚀📦✅🎯)
- ✅ Proper error handling
- ✅ Non-root user execution
- ✅ Signal handling with dumb-init
- ✅ Health checks included

## 📝 Entrypoint Script Pattern

```bash
#!/bin/sh
set -e

echo "🚀 Starting <service-name> entrypoint..."
echo "📦 Running Prisma migrations..."
npx prisma migrate deploy
echo "✅ Migrations complete!"
echo "🎯 Starting <service-name>..."
exec node dist/index.js
```

## 🏗️ Dockerfile Pattern

```dockerfile
# Stage 1: Production dependencies
FROM node:18-alpine AS deps
RUN npm ci --omit=dev

# Stage 2: Build with all dependencies
FROM node:18-alpine AS builder
RUN npm ci
RUN npm run build

# Stage 3: Production runtime
FROM node:18-alpine AS production
COPY --from=deps node_modules
COPY --from=builder dist
CMD ["sh", "docker-entrypoint.sh"]
```

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails | Check package.json and package-lock.json are in sync |
| Service won't start | Check logs: `docker compose logs <service>` |
| Migration fails | Verify DATABASE_URL environment variable |
| Module not found | Ensure dependencies are in `dependencies` not `devDependencies` |
| Permission denied | Check entrypoint script is executable |

## 📈 Performance

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Image Size | 800MB | 278MB | 65% ↓ |
| Build Time | ~8 min | ~6 min | 25% ↓ |
| Pull Time | ~2 min | ~1 min | 50% ↓ |
| Disk Usage | ~8GB | ~2.8GB | 65% ↓ |

## 🎉 Success Indicators

```bash
# Healthy service
docker compose ps user-service
# STATUS: Up X minutes (healthy)

# Successful logs
🚀 Starting user-service entrypoint...
📦 Running Prisma migrations...
✅ Migrations complete!
🎯 Starting user-service...
Connected to Redis
Connected to PostgreSQL
User service started on 0.0.0.0:3001
```

## 📚 Documentation

- **Overview**: COMPLETION_SUMMARY.md
- **Details**: DOCKER_OPTIMIZATION_SUMMARY.md
- **Guide**: DOCKER_ENTRYPOINT_GUIDE.md
- **Deep Dive**: USER_SERVICE_OPTIMIZATION_DETAILS.md
- **Quick Start**: QUICK_START_OPTIMIZED.md
- **Checklist**: OPTIMIZATION_CHECKLIST.md

## 🆘 Need Help?

1. Check documentation files
2. Review logs: `docker compose logs -f <service>`
3. Verify health: `docker compose ps`
4. Check environment variables in .env
5. Ensure Docker and Docker Compose are up to date

---

**Quick Tip**: Use `docker compose build --parallel` to build multiple services simultaneously!
