# Common Issues

## Service Won't Start

**Check logs:**
```powershell
docker compose logs -f user-service
docker compose logs -f subscription-service
```

**Common causes:**
- Database not ready → Wait 10 seconds and retry
- Port already in use → Stop conflicting service
- Missing env vars → Check .env file

## Database Connection Failed

```powershell
# Restart postgres
docker compose restart postgres

# Check postgres logs
docker compose logs postgres
```

## 401 Unauthorized

- Token expired (24h default)
- Missing "Bearer " prefix
- Wrong token format

## Build Failures

```powershell
# Clean rebuild
docker compose down
docker compose build --no-cache user-service
docker compose up -d user-service
```

## Migration Issues

See [Migrations Guide](../setup/MIGRATIONS.md)
