# Fix Backend Access from Vercel

## Problem
Vercel proxy is getting 500/404 errors when trying to reach your EC2 backend at `http://51.20.160.210:3009`.

## Root Causes & Solutions

### 1. EC2 Security Group (MOST LIKELY ISSUE)

**Problem**: EC2 Security Group is blocking inbound traffic from Vercel's servers.

**Fix**:
1. Go to AWS Console → EC2 → Security Groups
2. Find the security group attached to your EC2 instance (`51.20.160.210`)
3. Edit Inbound Rules → Add Rule:
   - **Type**: Custom TCP
   - **Port**: 3009
   - **Source**: 0.0.0.0/0 (or restrict to Vercel IPs if known)
   - **Description**: Allow Vercel proxy
4. Repeat for port 3008 (analytics service)
5. Save rules

**Verify**:
```bash
# From your local machine, test if backend is accessible
curl http://51.20.160.210:3009/api/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}'
```

### 2. EC2 Instance Firewall (ufw/iptables)

**Problem**: Linux firewall on EC2 is blocking the ports.

**Fix** (SSH into EC2):
```bash
# Check if ufw is active
sudo ufw status

# If active, allow ports
sudo ufw allow 3009/tcp
sudo ufw allow 3008/tcp

# Or check iptables
sudo iptables -L -n
```

### 3. Backend Service Not Running

**Check** (SSH into EC2):
```bash
# Check if admin service is running
ps aux | grep admin-service
# OR
pm2 list
# OR
docker ps | grep admin-service

# Check service logs
pm2 logs admin-service
# OR
docker logs <container-name>
```

**Restart if needed**:
```bash
# If using PM2
pm2 restart admin-service

# If using Docker
docker compose restart admin-service

# If using systemd
sudo systemctl restart admin-service
```

### 4. Backend Service Binding

**Problem**: Service might be bound to `localhost` instead of `0.0.0.0`.

**Check** (in your admin service code):
```typescript
// Should be:
app.listen(3009, '0.0.0.0', () => {
  console.log('Server running on port 3009');
});

// NOT:
app.listen(3009, 'localhost', () => {
  // This only accepts local connections
});
```

### 5. Test Backend Directly

**From your local machine**:
```bash
# Test health endpoint
curl http://51.20.160.210:3009/health

# Test login endpoint
curl http://51.20.160.210:3009/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"your-admin@email.com","password":"your-password"}'
```

**Expected**: Should return JSON response (even if it's an error, it means server is reachable)

**If this fails**: Backend is not accessible from outside → Fix Security Group

### 6. Check Vercel Function Logs

1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on latest deployment
3. Go to "Functions" tab
4. Look for errors like:
   - `ECONNREFUSED` → Backend not accessible
   - `ETIMEDOUT` → Security group blocking
   - `500` → Backend error (check backend logs)

### 7. Temporary CORS Fix (Already Applied)

I've updated the backend CORS to be more permissive in production temporarily. This will help debug. Once working, you can tighten it.

## Quick Checklist

- [ ] EC2 Security Group allows inbound TCP on ports 3009 and 3008 from 0.0.0.0/0
- [ ] EC2 instance firewall (ufw/iptables) allows ports 3009 and 3008
- [ ] Backend service is running (check with `ps aux | grep admin-service`)
- [ ] Backend service is bound to `0.0.0.0`, not `localhost`
- [ ] Can curl the backend from your local machine
- [ ] Backend logs show incoming requests (check with `pm2 logs` or `docker logs`)

## After Fixing

1. Test from local machine: `curl http://51.20.160.210:3009/api/auth/login`
2. If that works, Vercel proxy should work too
3. Check Vercel deployment logs to confirm
4. Try logging in from the admin panel
