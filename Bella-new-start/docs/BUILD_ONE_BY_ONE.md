# Build Services One at a Time

## Prerequisites

### Environment Variables Setup

Before building services, ensure you have the following environment variables configured:

#### User Service - Photo Verification (NEW)
The user service now includes photo verification functionality. Configure one of the following providers:

**AWS Rekognition (Default - CONFIGURED):**
```env
VERIFICATION_PROVIDER=aws
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REKOGNITION_MIN_SIMILARITY=80
```

> **Note:** These credentials are already configured in `docker-compose.yml`. For EC2 deployment, set these as environment variables in your shell or `.env` file before running `docker compose up`.

**Face++ Alternative:**
```env
VERIFICATION_PROVIDER=facepp
FACEPP_API_KEY=your_facepp_api_key
FACEPP_API_SECRET=your_facepp_api_secret
FACEPP_MIN_SIMILARITY=80
```

**Luxand Alternative:**
```env
VERIFICATION_PROVIDER=luxand
LUXAND_API_KEY=your_luxand_api_key
LUXAND_MIN_SIMILARITY=80
```

**Google Cloud Vision (Future):**
```env
VERIFICATION_PROVIDER=google
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

> **Note:** See `services/user-service/VERIFICATION_ENV_SETUP.md` for detailed setup instructions.

#### Subscription Service - CORS Configuration (UPDATED)
The subscription service now supports multiple development origins:
```env
CORS_ORIGINS=http://localhost:3000,http://localhost:8081,http://localhost:19006
```

### Database Migrations

**AUTOMATIC:** Database migrations run automatically when the user-service container starts via the `docker-entrypoint.sh` script. The script executes `npx prisma migrate deploy` before starting the service.

The user service now includes the following new database fields:
- `isPhotoVerified` (Boolean)
- `photoVerificationAttempts` (Int)
- `photoVerifiedAt` (DateTime)

> **Note:** Prisma client is generated during Docker build, and migrations are deployed automatically on container startup. No manual migration steps are required.

### New Dependencies

The user service now requires additional npm packages:
- `@aws-sdk/client-rekognition` (for AWS Rekognition)
- `axios` (for alternative verification providers)
- `form-data` (for image uploads)

These should be installed automatically during `npm install`, but if you encounter issues:

```bash
cd services/user-service
npm install @aws-sdk/client-rekognition axios form-data
```

## Step 1: Build Infrastructure Services First

```bash
# 1. Build postgres (if needed)
seerabbitmq

# Wait for them to be healthy (check status)
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml ps
```

## Step 3: Build Core Services (One at a Time)

```bash
# 1. User Service (most critical - needed by others)
# NOTE: Ensure photo verification environment variables are set before building
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build user-service

# 2. Start user-service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d user-service


# Wait a moment, then check logs
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml logs user-service --tail=20

# Verify photo verification is configured (check for provider initialization)
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml logs user-service | grep -i "verification\|rekognition\|face"
```

## Step 4: Build Remaining Services

```bash
# 3. Queuing Service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build queuing-service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d queuing-service

# 4. Interaction Service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build interaction-service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d interaction-service

# 5. History Service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build history-service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d history-service

# 6. Communication Service

sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build communication-service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d communication-service

# 7. Notification Service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build notification-service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d notification-service

# 8. Moderation Service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build moderation-service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d moderation-service

# 9. Analytics Service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build analytics-service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d analytics-service

# 10. Admin Service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build admin-service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d admin-service

# 11. Subscription Service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build subscription-service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d subscription-service

# 12. GraphQL Gateway (needs other services)
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build queuing-service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d queuing-service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build communication-service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d communication-service
  sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build graphql-gateway
  sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d graphql-gateway

# 13. Dev Proxy (optional)
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build dev-proxy
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d dev-proxy
```

## Quick Check Commands

After each build, check if it's working:

```bash
# Check if service is running
sudo docker ps | grep [service-name]

# Check logs
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml logs [service-name] --tail=20

# Check health endpoint (if available)
curl http://localhost:[port]/health

# For user-service, verify photo verification endpoints:
curl -X POST http://localhost:3001/profile/verify-photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "selfie=@test-image.jpg"
```

## Important Notes

### Photo Verification Service
- **Required for matching**: Users must verify their photo before using auto-matching features
- **Provider selection**: Set `VERIFICATION_PROVIDER` environment variable (default: `aws`)
- **Fallback support**: System supports multiple providers (AWS, Face++, Luxand, Google)
- **See documentation**: `services/user-service/VERIFICATION_ENV_SETUP.md` and `VERIFICATION_PROVIDERS.md`

### CORS Configuration
- **Subscription Service**: Updated to support multiple development origins (localhost:3000, 8081, 19006)
- **GraphQL Gateway**: Updated CORS to include development origins
- **Production**: Ensure CORS is properly restricted in production environments

### Database Schema Updates
- User service schema now includes photo verification fields
- Run migrations before starting services: `cd services/user-service && npm run db:migrate`
- Migration includes: `isPhotoVerified`, `photoVerificationAttempts`, `photoVerifiedAt`

## All-in-One Script (Copy and paste each section)

```bash
# === INFRASTRUCTURE ===
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build postgres redis rabbitmq
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d postgres redis rabbitmq
sleep 10

# === CORE SERVICES ===
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build user-service && \
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d user-service && \
sleep 5

sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build queuing-service && \
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d queuing-service && \
sleep 5

sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build interaction-service && \
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d interaction-service && \
sleep 5

sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build history-service && \
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d history-service && \
sleep 5

sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build communication-service && \
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d communication-service && \
sleep 5

sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build notification-service && \
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d notification-service && \
sleep 5

sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build moderation-service && \
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d moderation-service && \
sleep 5

sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build analytics-service && \
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d analytics-service && \
sleep 5

sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build admin-service && \
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d admin-service && \
sleep 5

sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build subscription-service && \
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d subscription-service && \
sleep 5

# === GATEWAY (needs other services) ===
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build graphql-gateway && \
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d graphql-gateway && \
sleep 5

# Watch logs in real-time
sudo docker logs -f kindred-graphql-gateway

# === OPTIONAL ===
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml build dev-proxy && \
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d dev-proxy

# === FINAL STATUS ===
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml ps

# === VERIFY PHOTO VERIFICATION SETUP ===
# Check user-service logs for verification provider initialization
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml logs user-service | grep -i verification

# Test photo verification endpoint (requires authentication token)
# curl -X POST http://localhost:3001/profile/verify-photo \
#   -H "Authorization: Bearer YOUR_TOKEN" \
#   -F "selfie=@test-image.jpg"
```

## Troubleshooting

### Photo Verification Not Working
1. **Check environment variables**: Ensure `VERIFICATION_PROVIDER` and provider-specific credentials are set
2. **Check logs**: Look for initialization errors in user-service logs
3. **Verify AWS credentials**: If using AWS Rekognition, ensure IAM permissions are correct
4. **See documentation**: Check `services/user-service/VERIFICATION_ENV_SETUP.md`

### CORS Errors
1. **Check CORS_ORIGINS**: Ensure your frontend origin is included in `CORS_ORIGINS` environment variable
2. **Subscription Service**: Verify `CORS_ORIGINS` includes `http://localhost:8081` and `http://localhost:19006` for Expo development
3. **Restart service**: After changing CORS settings, restart the affected service

### Database Migration Issues
1. **Migrations are automatic**: The `docker-entrypoint.sh` script runs `npx prisma migrate deploy` on container start
2. **Check logs**: If migrations fail, check user-service logs: `docker compose logs user-service`
3. **Manual migration**: Only needed if automatic migration fails - run `npx prisma migrate deploy` inside the container

### AWS Rekognition Credentials
1. **Set environment variables**: On EC2, export these before running docker compose:
   ```bash
   export AWS_ACCESS_KEY_ID=your_aws_access_key_id
   export AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
   export AWS_REGION=us-east-2
   export VERIFICATION_PROVIDER=aws
   export AWS_REKOGNITION_MIN_SIMILARITY=80
   ```
2. **Or use .env file**: Create a `.env` file in the project root with these variables
3. **Verify in logs**: Check user-service logs to confirm verification provider initialized correctly
```

