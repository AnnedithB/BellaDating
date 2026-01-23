#!/bin/sh
set -e

echo "Starting notification-service entrypoint..."

# Generate Prisma Client
echo "Generating Prisma Client..."
npx prisma generate

# Run database migrations or push schema if no migrations exist
echo "Setting up database schema..."
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "Migrations found, running migrate deploy..."
  npx prisma migrate deploy || true
else
  echo "No migrations found, pushing schema directly..."
  npx prisma db push --accept-data-loss || true
fi

echo "Database setup complete!"
echo "Starting notification-service..."

# Start the application
exec node dist/index.js
