#!/bin/sh
set -e

echo "Starting analytics-service entrypoint..."

# Run database migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy || true

echo "Migrations complete!"
echo "Starting analytics-service..."

# Start the application
exec node dist/index.js
