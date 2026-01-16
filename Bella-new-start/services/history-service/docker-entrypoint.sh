#!/bin/sh
set -e

echo "Starting history-service entrypoint..."

# Run database migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy || true

echo "Migrations complete!"
echo "Starting history-service..."

# Start the application
exec node dist/index.js
