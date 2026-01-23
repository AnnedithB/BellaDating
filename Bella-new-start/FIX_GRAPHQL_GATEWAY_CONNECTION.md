# Fix: GraphQL Gateway Connection to User Service

## Problem
The GraphQL gateway is trying to connect to `127.0.0.1:3001` (localhost) instead of the Docker service `kindred-user-service:3001`.

## Root Cause
The `config.ts` file has a fallback to `localhost:3001` when `USER_SERVICE_URL` environment variable is not properly set.

## Solution

### Option 1: Verify Docker Compose Environment Variables (Recommended)

The `docker-compose.yml` already has the correct configuration:
```yaml
graphql-gateway:
  environment:
    USER_SERVICE_URL: http://kindred-user-service:3001
```

**Check if the environment variable is being read:**
1. SSH into your EC2 instance
2. Check if the service is running:
   ```bash
   docker compose ps
   ```
3. Check the logs:
   ```bash
   docker compose logs graphql-gateway | grep USER_SERVICE_URL
   ```
4. Restart the service to pick up environment variables:
   ```bash
   docker compose restart graphql-gateway
   ```

### Option 2: Update config.ts to Use Docker Service Names by Default

If running in Docker, the default should use Docker service names instead of localhost.

### Option 3: Create .env file for GraphQL Gateway

Create a `.env` file in the `services/graphql-gateway` directory:
```env
USER_SERVICE_URL=http://kindred-user-service:3001
QUEUING_SERVICE_URL=http://kindred-queuing-service:3002
INTERACTION_SERVICE_URL=http://kindred-interaction-service:3003
HISTORY_SERVICE_URL=http://kindred-history-service:3004
COMMUNICATION_SERVICE_URL=http://kindred-communication-service:3005
NOTIFICATION_SERVICE_URL=http://kindred-notification-service:3006
MODERATION_SERVICE_URL=http://kindred-moderation-service:3007
ANALYTICS_SERVICE_URL=http://kindred-analytics-service:3008
ADMIN_SERVICE_URL=http://kindred-admin-service:3009
SUBSCRIPTION_SERVICE_URL=http://kindred-subscription-service:3010
```

## Quick Fix Commands (Run on EC2)

```bash
# Navigate to project directory
cd /path/to/Bella-new-start

# Restart graphql-gateway to pick up environment variables
docker compose restart graphql-gateway

# Check if it's connecting correctly
docker compose logs -f graphql-gateway

# Test the connection
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}'
```

## Verification

After applying the fix, test with:
```bash
curl -X POST http://51.20.160.210:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation Register($input: UserInput!) { register(input: $input) { token user { id email username } expiresIn } }",
    "variables": {
      "input": {
        "email": "test@example.com",
        "username": "testuser",
        "password": "Test123!@#"
      }
    }
  }'
```

You should get a successful response instead of `ECONNREFUSED 127.0.0.1:3001`.

