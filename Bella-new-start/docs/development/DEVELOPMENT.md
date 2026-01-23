# KINDRED - Development Guide

Complete guide for developers working on the Kindred platform.

---

## 🎯 Development Philosophy

**"No BS, Just Code"** - This project is designed for maximum developer efficiency:
- ✅ One command to start everything
- ✅ No external scripts or Makefiles
- ✅ Standard Docker commands only
- ✅ Automatic migrations on startup
- ✅ Hot reload for development

---

## 🏗️ Project Structure

```
kindred/
├── docker-compose.yml          # Single source of truth
├── .env                        # All configuration
├── init-databases.sql          # Database initialization
├── Dockerfile.template         # Universal Dockerfile
│
├── services/                   # 12 Microservices
│   ├── user-service/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── src/
│   │       ├── index.ts
│   │       ├── routes/
│   │       ├── middleware/
│   │       └── utils/
│   │
│   ├── queuing-service/
│   ├── interaction-service/
│   ├── history-service/
│   ├── communication-service/
│   ├── notification-service/
│   ├── moderation-service/
│   ├── analytics-service/
│   ├── admin-service/
│   ├── subscription-service/
│   └── graphql-gateway/
│
└── shared/                     # Shared libraries
    ├── cache/
    ├── config/
    ├── i18n/
    ├── middleware/
    ├── types/
    └── utils/
```

---

## 🚀 Getting Started

### 1. Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd kindred

# Copy environment file
cp .env.example .env

# Edit .env and set JWT_SECRET (REQUIRED)
nano .env

# Start everything
docker compose up -d

# Wait for services to be healthy (~60 seconds)
docker compose ps

# Check logs
docker compose logs -f
```

### 2. Verify Installation

```bash
# Check all services are running
docker compose ps

# Test health endpoints
curl http://localhost:3001/health  # user-service
curl http://localhost:3002/health  # queuing-service
curl http://localhost:4000/.well-known/apollo/server-health  # graphql-gateway

# Check infrastructure
docker compose exec postgres pg_isready -U postgres
docker compose exec redis redis-cli ping
docker compose exec rabbitmq rabbitmq-diagnostics ping
```

---

## 💻 Development Workflows

### Workflow 1: Full Stack Development (All Services)

```bash
# Start everything
docker compose up -d

# Watch logs for all services
docker compose logs -f

# Or watch specific services
docker compose logs -f user-service interaction-service
```

### Workflow 2: Single Service Development

```bash
# Start infrastructure + dependencies
docker compose up postgres redis rabbitmq user-service -d

# Work on interaction-service
docker compose up interaction-service -d

# Watch logs
docker compose logs -f interaction-service

# Make code changes...

# Rebuild and restart
docker compose up --build interaction-service -d
```

### Workflow 3: Local Development (Outside Docker)

```bash
# Start infrastructure only
docker compose up postgres redis rabbitmq -d

# Set environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/users"
export REDIS_URL="redis://localhost:6379"
export RABBITMQ_URL="amqp://admin:admin123@localhost:5672"
export JWT_SECRET="your-secret-key"
export PORT=3001

# Install dependencies
cd services/user-service
npm install

# Run migrations
npx prisma migrate dev

# Start development server with hot reload
npm run dev
```

### Workflow 4: Testing Changes

```bash
# Rebuild specific service
docker compose build user-service

# Restart with new build
docker compose up -d user-service

# Or do both in one command
docker compose up --build -d user-service

# Watch logs for errors
docker compose logs -f user-service
```

---

## 🗄️ Database Development

### Prisma Workflow

```bash
# 1. Make changes to prisma/schema.prisma
nano services/user-service/prisma/schema.prisma

# 2. Create migration (local development)
cd services/user-service
npx prisma migrate dev --name add_user_preferences

# 3. Apply migration in Docker
docker compose exec user-service npx prisma migrate deploy

# 4. Generate Prisma Client
docker compose exec user-service npx prisma generate

# 5. View database
docker compose exec user-service npx prisma studio
```

### Database Operations

```bash
# Access PostgreSQL CLI
docker compose exec postgres psql -U postgres -d users

# List all databases
docker compose exec postgres psql -U postgres -c "\l"

# Backup database
docker compose exec postgres pg_dump -U postgres users > backup.sql

# Restore database
cat backup.sql | docker compose exec -T postgres psql -U postgres users

# Reset database (WARNING: deletes all data)
docker compose exec user-service npx prisma migrate reset

# Seed database
docker compose exec user-service npx prisma db seed
```

---

## 🔧 Service-Specific Development

### User Service (Port 3001)

**Key Features:**
- Authentication (JWT)
- User profiles
- Photo uploads (S3)
- Preferences

**Development:**
```bash
# Start with dependencies
docker compose up postgres redis user-service -d

# Watch logs
docker compose logs -f user-service

# Test registration
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}'

# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

### Interaction Service (Port 3003)

**Key Features:**
- Likes/dislikes
- Matches
- Super likes
- Match notifications

**Development:**
```bash
# Start with dependencies
docker compose up postgres redis rabbitmq user-service interaction-service -d

# Test like
TOKEN="your_jwt_token"
curl -X POST http://localhost:3003/api/interactions/like \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetUserId":"user-id-here"}'
```

### Communication Service (Port 3005)

**Key Features:**
- Real-time chat (WebSocket)
- Message history
- File attachments
- Read receipts

**Development:**
```bash
# Start with dependencies
docker compose up postgres redis rabbitmq user-service communication-service -d

# Test WebSocket connection
npm install -g wscat
wscat -c "ws://localhost:3005?token=your_jwt_token"

# Send message
curl -X POST http://localhost:3005/api/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipientId":"user-id","content":"Hello!"}'
```

### GraphQL Gateway (Port 4000)

**Key Features:**
- Unified GraphQL API
- Service aggregation
- Authentication
- Caching

**Development:**
```bash
# Start all services
docker compose up -d

# Open GraphQL Playground
open http://localhost:4000/graphql

# Test query
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"{ me { id email name } }"}'
```

---

## 🧪 Testing

### Manual Testing

```bash
# Health checks
for port in {3001..3010} 4000; do
  echo -n "Port $port: "
  curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health
  echo
done

# Load testing with Apache Bench
ab -n 1000 -c 10 http://localhost:3001/health

# WebSocket testing
npm install -g wscat
wscat -c "ws://localhost:3005?token=your_token"
```

### Automated Testing

```bash
# Run tests in container
docker compose exec user-service npm test

# Run tests with coverage
docker compose exec user-service npm run test:coverage

# Run specific test file
docker compose exec user-service npm test -- user.test.ts
```

---

## 🐛 Debugging

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f user-service

# Last 100 lines
docker compose logs --tail=100 user-service

# Follow logs with timestamps
docker compose logs -f --timestamps user-service

# Search logs
docker compose logs user-service | grep ERROR
```

### Interactive Debugging

```bash
# Access container shell
docker compose exec user-service sh

# Check environment variables
docker compose exec user-service env

# Check file system
docker compose exec user-service ls -la /app

# Check process
docker compose exec user-service ps aux

# Check network connectivity
docker compose exec user-service wget -O- http://postgres:5432
```

### Database Debugging

```bash
# Check database connection
docker compose exec user-service npx prisma db pull

# View database schema
docker compose exec postgres psql -U postgres -d users -c "\dt"

# Check table contents
docker compose exec postgres psql -U postgres -d users -c "SELECT * FROM users LIMIT 10;"

# Check database size
docker compose exec postgres psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('users'));"
```

### Performance Debugging

```bash
# Check resource usage
docker stats

# Check container logs for slow queries
docker compose logs user-service | grep "slow query"

# Profile Node.js application
docker compose exec user-service node --prof dist/index.js
```

---

## 🔄 Common Tasks

### Add New Microservice

1. **Create service directory:**
```bash
mkdir -p services/new-service/src
cd services/new-service
```

2. **Initialize package.json:**
```bash
npm init -y
npm install express prisma @prisma/client
npm install -D typescript @types/node @types/express ts-node
```

3. **Create Dockerfile:**
```bash
cp ../user-service/Dockerfile ./Dockerfile
# Edit SERVICE_NAME in Dockerfile
```

4. **Add to docker-compose.yml:**
```yaml
new-service:
  build:
    context: .
    dockerfile: services/new-service/Dockerfile
    args:
      SERVICE_NAME: new-service
  container_name: kindred-new-service
  ports:
    - "3011:3011"
  environment:
    PORT: 3011
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/new_service
    # ... other env vars
  depends_on:
    postgres:
      condition: service_healthy
  networks:
    - kindred-network
```

5. **Add database to init-databases.sql:**
```sql
CREATE DATABASE new_service;
GRANT ALL PRIVILEGES ON DATABASE new_service TO postgres;
```

### Update Dependencies

```bash
# Update single service
cd services/user-service
npm update

# Rebuild container
docker compose build user-service
docker compose up -d user-service

# Update all services
for service in services/*/; do
  cd "$service"
  npm update
  cd ../..
done

# Rebuild all
docker compose build
docker compose up -d
```

### Clean Up

```bash
# Stop all services
docker compose down

# Remove volumes (WARNING: deletes all data)
docker compose down -v

# Remove images
docker compose down --rmi all

# Full cleanup
docker compose down -v --rmi all
docker system prune -a --volumes
```

---

## 🔐 Security Best Practices

### Environment Variables

```bash
# Never commit .env file
echo ".env" >> .gitignore

# Use strong secrets
openssl rand -base64 32  # Generate JWT_SECRET

# Rotate secrets regularly
# Update .env and restart services
docker compose restart
```

### Database Security

```bash
# Use strong passwords
POSTGRES_PASSWORD=$(openssl rand -base64 32)

# Limit database access
# Only expose ports in development
# In production, remove port mappings
```

### Container Security

```bash
# Run as non-root user (already configured)
# Scan images for vulnerabilities
docker scan kindred-user-service

# Keep base images updated
docker compose pull
docker compose up -d
```

---

## 📊 Monitoring & Observability

### Health Checks

```bash
# Check all services
./scripts/health-check.sh

# Or manually
for port in {3001..3010} 4000; do
  curl -f http://localhost:$port/health || echo "Port $port failed"
done
```

### Metrics

```bash
# RabbitMQ Management UI
open http://localhost:15672
# Username: admin, Password: admin123

# Redis CLI
docker compose exec redis redis-cli INFO

# PostgreSQL Stats
docker compose exec postgres psql -U postgres -c "SELECT * FROM pg_stat_activity;"
```

### Logs

```bash
# Aggregate logs
docker compose logs > all-logs.txt

# Filter by level
docker compose logs | grep ERROR
docker compose logs | grep WARN

# Export logs
docker compose logs --since 1h > last-hour.log
```

---

## 🚀 Performance Optimization

### Database Optimization

```bash
# Add indexes
docker compose exec postgres psql -U postgres -d users -c "CREATE INDEX idx_email ON users(email);"

# Analyze query performance
docker compose exec postgres psql -U postgres -d users -c "EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';"

# Vacuum database
docker compose exec postgres psql -U postgres -d users -c "VACUUM ANALYZE;"
```

### Redis Optimization

```bash
# Check memory usage
docker compose exec redis redis-cli INFO memory

# Clear cache
docker compose exec redis redis-cli FLUSHALL

# Set memory limit (already configured in docker-compose.yml)
```

### Container Optimization

```bash
# Check resource usage
docker stats

# Adjust resource limits in docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 1G
```

---

## 📚 Additional Resources

- **API Documentation:** See `API_SPECIFICATIONS.md`
- **Database Schemas:** See `DATABASE_SCHEMA.md`
- **Architecture:** See `ARCHITECTURE.md`
- **Docker Compose Reference:** https://docs.docker.com/compose/

---

## 🆘 Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose logs service-name

# Check dependencies
docker compose ps

# Restart service
docker compose restart service-name

# Rebuild service
docker compose up --build service-name -d
```

### Database Issues

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check database exists
docker compose exec postgres psql -U postgres -l

# Reset database
docker compose down -v
docker compose up -d
```

### Network Issues

```bash
# Check network
docker network ls
docker network inspect kindred-network

# Recreate network
docker compose down
docker compose up -d
```

---

**Happy Coding! 🚀**
