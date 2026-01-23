# Getting Started

Quick guide to set up and run the Kindred backend.

## Prerequisites

- Docker Desktop
- Git
- PowerShell (Windows) or Bash (Linux/Mac)

## Quick Setup

1. **Clone and Configure**
```powershell
git clone <repo-url>
cd Kindred-main
cp .env.example .env
# Edit .env with your values
```

2. **Start Services**
```powershell
docker compose up -d postgres redis
docker compose up -d user-service
docker compose up -d subscription-service
```

3. **Verify**
```powershell
# Check health
Invoke-RestMethod -Uri "http://localhost:3001/health"
Invoke-RestMethod -Uri "http://localhost:3010/health"
```

## Next Steps

- [Test User Service API](../api-tests/USER_SERVICE.md)
- [Test Subscription Service API](../api-tests/SUBSCRIPTION_SERVICE.md)
- [Setup Migrations](./MIGRATIONS.md)
