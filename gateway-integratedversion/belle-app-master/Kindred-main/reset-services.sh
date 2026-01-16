#!/bin/bash

echo "🚀 Stopping all PM2 processes..."
pm2 kill
pm2 delete all

echo "💀 Killing stray Node / ts-node-dev / Nodemon processes..."
sudo pkill -f "node"
sudo pkill -f "ts-node-dev"
sudo pkill -f "nodemon"

echo "⏳ Waiting 2 seconds for ports to free..."
sleep 2

# If you have an ecosystem file:
if [ -f ecosystem.config.js ]; then
    echo "📂 Starting services from ecosystem.config.js..."
    pm2 start ecosystem.config.js
else
    echo "⚠️ ecosystem.config.js not found, starting manually..."
    # Example: edit these lines with your actual service paths and names
    pm2 start services/admin-service/src/index.ts --name admin-service
    pm2 start services/analytics-service/src/index.ts --name analytics-service
    pm2 start services/communication-service/src/index.ts --name communication-service
    pm2 start services/dev-proxy/src/index.ts --name dev-proxy
    pm2 start services/graphql-gateway/src/index.ts --name graphql-gateway
    pm2 start services/history-service/src/index.ts --name history-service
    pm2 start services/interaction-service/src/index.ts --name interaction-service
    pm2 start services/moderation-service/src/index.ts --name moderation-service
    pm2 start services/notification-service/src/index.ts --name notification-service
    pm2 start services/queuing-service/src/index.ts --name queuing-service
    pm2 start services/subscription-service/src/index.ts --name subscription-service
    pm2 start services/user-service/src/index.ts --name user-service
fi

echo "✅ All services started. Listing active ports..."
sudo lsof -iTCP -sTCP:LISTEN -P -n | grep node

echo "📋 PM2 service list:"
pm2 list

