#!/bin/bash
# Simple notification test script

echo "=========================================="
echo "Notification Diagnostic Script"
echo "=========================================="
echo ""

# 1. Check notifications table structure
echo "1. Checking notifications table structure..."
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml exec postgres \
  psql -U postgres -d notifications \
  -c '\d notifications'

echo ""
echo "2. Checking notifications in database..."
# Use * to get all columns
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml exec postgres \
  psql -U postgres -d notifications \
  -c 'SELECT * FROM notifications ORDER BY "createdAt" DESC LIMIT 3;' 2>/dev/null || \
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml exec postgres \
  psql -U postgres -d notifications \
  -c 'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 3;'

echo ""
echo "3. Testing notification service API..."
USER_ID="cmjypymgc0001pd07u5qusba5"
echo "   Testing: GET /api/notifications/user/${USER_ID}"
echo ""

# Get the notification service container's IP or use localhost from inside
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml exec notification-service \
  node -e "
const http = require('http');
const userId = '${USER_ID}';
const url = \`http://localhost:3006/api/notifications/user/\${userId}?limit=10&offset=0\`;

http.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Response:');
      console.log(JSON.stringify(parsed, null, 2));
      if (parsed.data && parsed.data.notifications) {
        console.log(\`\nFound \${parsed.data.notifications.length} notifications\`);
      }
    } catch(e) {
      console.log('Raw response:', data);
      console.error('Parse error:', e.message);
    }
  });
}).on('error', (e) => {
  console.error('Request error:', e.message);
});
"

echo ""
echo "4. Check GraphQL gateway logs:"
echo "   sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml logs graphql-gateway | tail -50 | grep -i notification"
echo ""
echo "=========================================="

