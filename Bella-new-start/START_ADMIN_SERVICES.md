# How to Start Admin Services for Development

## Option 1: Using Docker Compose (Recommended)

If you have Docker running:

```bash
cd Bella-new-start

# Start only admin and analytics services with dependencies
docker compose up -d postgres redis admin-service analytics-service

# Check if services are running
docker compose ps

# View logs
docker compose logs -f admin-service
docker compose logs -f analytics-service
```

## Option 2: Running Locally (Without Docker)

### Prerequisites
1. PostgreSQL running on `localhost:5432`
2. Redis running on `localhost:6379`
3. Node.js and npm installed

### Step 1: Start Admin Service

```bash
cd Bella-new-start/services/admin-service

# Install dependencies (if not already done)
npm install

# Create .env file if it doesn't exist
cat > .env << EOF
NODE_ENV=development
PORT=3009
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/admin_db
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
JWT_SECRET=admin-super-secret-key
FRONTEND_URL=http://localhost:5005
CORS_ORIGIN=http://localhost:5005
EOF

# Generate Prisma client
npm run prisma:generate

# Run migrations (if needed)
npm run prisma:migrate

# Start the service
npm run dev
```

### Step 2: Start Analytics Service

Open a **new terminal window**:

```bash
cd Bella-new-start/services/analytics-service

# Install dependencies (if not already done)
npm install

# Create .env file if it doesn't exist
cat > .env << EOF
NODE_ENV=development
PORT=3008
API_PORT=3008
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/analytics
FRONTEND_URL=http://localhost:5005
CORS_ORIGIN=http://localhost:5005
EOF

# Generate Prisma client
npm run prisma:generate

# Run migrations (if needed)
npm run prisma:migrate

# Start the service
npm run dev
```

### Step 3: Verify Services Are Running

Open a browser or use curl:

```bash
# Check admin service
curl http://localhost:3009/health

# Check analytics service
curl http://localhost:3008/health
```

You should see JSON responses with `status: "healthy"`.

## Troubleshooting

### Port Already in Use

If you get "port already in use" error:

```bash
# Windows - Find process using port 3009
netstat -ano | findstr ":3009"
# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Windows - Find process using port 3008
netstat -ano | findstr ":3008"
taskkill /PID <PID> /F
```

### Database Connection Error

Make sure PostgreSQL is running:

```bash
# Check if PostgreSQL is running
# Windows
sc query postgresql-x64-*

# Or check if port 5432 is listening
netstat -ano | findstr ":5432"
```

### Redis Connection Error

Make sure Redis is running:

```bash
# Check if Redis is running
# Windows - if installed as service
sc query Redis

# Or check if port 6379 is listening
netstat -ano | findstr ":6379"
```

### CORS Errors

If you still get CORS errors, make sure:
1. The services have `FRONTEND_URL=http://localhost:5005` in their `.env` files
2. You've restarted the services after updating the environment variables

## Quick Start Script (Windows PowerShell)

Save this as `start-admin-services.ps1`:

```powershell
# Start Admin Service
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Bella-new-start\services\admin-service; npm run dev"

# Wait a bit
Start-Sleep -Seconds 3

# Start Analytics Service
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Bella-new-start\services\analytics-service; npm run dev"

Write-Host "Services starting in new windows..."
Write-Host "Admin Service: http://localhost:3009/health"
Write-Host "Analytics Service: http://localhost:3008/health"
```

Run it:
```powershell
.\start-admin-services.ps1
```
