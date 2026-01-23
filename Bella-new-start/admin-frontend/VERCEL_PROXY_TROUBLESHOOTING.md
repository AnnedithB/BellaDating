# Vercel Proxy Troubleshooting Guide

## Issue: 500/404 Errors on API Requests

If you're getting 500 or 404 errors when the admin panel tries to connect to your EC2 backend, here are the steps to fix it:

### Problem
Vercel's servers are trying to proxy requests to your EC2 backend (`http://51.20.160.210:3009`), but they can't reach it because:

1. **EC2 Security Group** is blocking inbound traffic from Vercel's servers
2. **Firewall rules** on the EC2 instance are blocking the connection
3. **Backend service** is not running or not accessible

### Solution 1: Allow Vercel IP Ranges (Recommended)

1. **Get Vercel's IP Ranges**:
   - Vercel uses dynamic IPs, but you can find their ranges in their documentation
   - Or temporarily allow all IPs (0.0.0.0/0) for HTTP traffic on port 3009

2. **Update EC2 Security Group**:
   ```bash
   # Allow inbound HTTP traffic on port 3009 from anywhere (for Vercel proxy)
   # In AWS Console: EC2 > Security Groups > Your Security Group
   # Add rule: Type: Custom TCP, Port: 3009, Source: 0.0.0.0/0
   ```

3. **Also allow port 3008** for analytics service:
   ```bash
   # Add rule: Type: Custom TCP, Port: 3008, Source: 0.0.0.0/0
   ```

### Solution 2: Use Environment Variables in Vercel

If you can't modify security groups, you can set the backend URL directly:

1. **In Vercel Dashboard**:
   - Go to your project > Settings > Environment Variables
   - Add:
     - `VITE_ADMIN_SERVICE_URL` = `http://51.20.160.210:3009`
     - `VITE_ANALYTICS_SERVICE_URL` = `http://51.20.160.210:3008`

2. **Note**: This will still have mixed content issues unless you:
   - Set up HTTPS on your EC2 backend, OR
   - Use a reverse proxy (like Cloudflare) with HTTPS

### Solution 3: Set Up HTTPS on EC2 Backend (Best Long-term Solution)

1. **Install Nginx** on your EC2 instance
2. **Get SSL Certificate** (Let's Encrypt is free)
3. **Configure Nginx** as reverse proxy with HTTPS
4. **Update Vercel environment variables** to use `https://your-domain.com:3009`

### Verify Backend is Accessible

Test if your backend is reachable:

```bash
# From your local machine
curl http://51.20.160.210:3009/api/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"test","password":"test"}'

# Should return a response (even if it's an error, it means the server is reachable)
```

### Check Vercel Logs

1. Go to Vercel Dashboard > Your Project > Deployments > Latest Deployment
2. Click on "Functions" tab to see serverless function logs
3. Check for connection errors or timeout messages

### Current Configuration

- **Vercel Rewrite**: `/api/*` → `http://51.20.160.210:3009/api/*`
- **Frontend Code**: Uses relative URLs (`/api/auth/login`) in production
- **Backend CORS**: Should allow `https://bella-admin-panel.vercel.app`

### Next Steps

1. ✅ Check EC2 Security Group allows inbound traffic on ports 3009 and 3008
2. ✅ Verify backend services are running: `curl http://51.20.160.210:3009/health`
3. ✅ Check backend CORS configuration allows Vercel domain
4. ✅ Review Vercel deployment logs for specific error messages
