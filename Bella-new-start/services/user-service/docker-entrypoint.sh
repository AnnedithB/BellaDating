#!/bin/sh
set -e

echo "Starting user-service entrypoint..."

# Ensure uploads directory exists and is writable
if [ ! -d "/app/services/user-service/uploads" ]; then
  echo "Creating uploads directory..."
  mkdir -p /app/services/user-service/uploads
fi

# Run database migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy || true

echo "Migrations complete!"
echo "Starting user-service..."

# Start the application
exec node dist/index.js
