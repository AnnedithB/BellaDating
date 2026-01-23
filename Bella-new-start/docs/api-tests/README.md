# API Testing Guide

Test the Kindred backend services using these guides.

## Available Services

1. **[User Service](./USER_SERVICE.md)** - Port 3001
   - Authentication (register, login)
   - User profiles
   - Safety features (report, block)

2. **[Queuing Service](./QUEUING_SERVICE.md)** - Port 3002
   - Queue management
   - Advanced matching algorithm
   - Dating preferences

3. **[Subscription Service](./SUBSCRIPTION_SERVICE.md)** - Port 3010
   - Subscription plans
   - Billing and payments
   - Admin management

## Testing Tools

- **cURL** - Command line testing
- **PowerShell** - Windows scripting
- **Postman** - GUI testing
- **REST Client** - VS Code extension

## Quick Test

```powershell
# Test user service
Invoke-RestMethod -Uri "http://localhost:3001/health"

# Test queuing service
Invoke-RestMethod -Uri "http://localhost:3002/health"

# Test subscription service
Invoke-RestMethod -Uri "http://localhost:3010/api/subscription-plans"
```

## Common Flow

1. Register/Login → Get JWT token
2. Use token for authenticated requests
3. Test CRUD operations
4. Verify responses
