# Communication Service API Debugging Guide

## Error: "Failed to create conversation"

When you get this error, follow these debugging steps:

### Step 1: Check Service Health
First, verify both services are running properly:

```bash
# Check User Service health
curl http://localhost:3001/health

# Check Communication Service health  
curl http://localhost:3005/health
```

**Expected responses:**
- Both should return `200 OK` with service status
- Communication service should show `socketConnections: 0` or similar

### Step 2: Verify JWT Token is Valid
Test your authentication token with the user service:

```bash
# Replace YOUR_TOKEN with actual token from login
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/auth/me
```

**Expected response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "user_id_here",
      "username": "testuser1",
      "email": "test1@example.com",
      "permissionRole": "USER",
      "isActive": true
    }
  }
}
```

### Step 3: Check JWT Secret Consistency
Both services must use the same JWT_SECRET. Check your environment:

```bash
# Check if JWT_SECRET is set in your environment
echo $JWT_SECRET

# Or check docker-compose logs for JWT secret issues
docker-compose logs user-service | grep -i jwt
docker-compose logs communication-service | grep -i jwt
```

### Step 4: Test with Minimal Request
Try creating a conversation with minimal data:

```bash
curl -X POST http://localhost:3005/api/chat/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{}'
```

### Step 5: Check Database Connection
Verify the communication service can connect to its database:

```bash
# Check communication service logs for database errors
docker-compose logs communication-service | grep -i database
docker-compose logs communication-service | grep -i prisma
```

### Step 6: Detailed Error Investigation
Get more detailed error information by checking the logs:

```bash
# View real-time logs from communication service
docker-compose logs -f communication-service

# Then make your API request in another terminal to see the actual error
```

## Common Issues & Solutions

### Issue 1: JWT Secret Mismatch
**Symptoms:** `403 Invalid or expired token`
**Solution:** Ensure both services use the same JWT_SECRET environment variable

### Issue 2: Database Not Connected
**Symptoms:** `500 Internal Server Error` with database connection errors in logs
**Solution:** 
```bash
# Restart the communication service
docker-compose restart communication-service

# Check if postgres is healthy
docker-compose ps postgres
```

### Issue 3: Missing User ID in Token
**Symptoms:** `401 User not authenticated`
**Solution:** Re-login to get a fresh token with proper user ID

### Issue 4: Invalid participant2Id
**Symptoms:** Database constraint errors
**Solution:** Make sure the `participant2Id` exists in the users database

## Step-by-Step Token Debugging

### 1. Get Fresh Tokens
```bash
# Login User 1
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test1@example.com", "password": "password123"}'

# Save the token and user ID from response
```

### 2. Verify Token Structure
Decode your JWT token at https://jwt.io to check:
- `userId` field exists
- `email` field exists  
- `role` field exists
- Token is not expired

### 3. Test Authentication Endpoint
```bash
# Test if communication service accepts your token
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3005/api/chat/conversations
```

### 4. Create Conversation with Correct User IDs
```bash
# Use actual user IDs from login responses
curl -X POST http://localhost:3005/api/chat/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer USER1_TOKEN" \
  -d '{"participant2Id": "ACTUAL_USER2_ID", "isAnonymous": true}'
```

## Environment Variables Check

Make sure these environment variables are set correctly in docker-compose.yml:

```yaml
communication-service:
  environment:
    JWT_SECRET: ${JWT_SECRET}  # Must match user-service
    DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD:-postgres}@postgres:5432/communications
    NODE_ENV: ${NODE_ENV:-production}
```

## Quick Fix Commands

```bash
# Restart both services
docker-compose restart user-service communication-service

# Check all service statuses
docker-compose ps

# View all logs for errors
docker-compose logs user-service communication-service
```

## Success Indicators

You know it's working when:
1. Health checks return 200 OK
2. JWT token validation works on user service
3. Communication service logs show successful database connection
4. No JWT secret mismatch errors in logs
5. Conversation creation returns 201 with conversation data