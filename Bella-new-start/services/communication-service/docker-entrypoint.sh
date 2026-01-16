#!/bin/sh
set -e

echo "Starting communication-service entrypoint..."

# Generate Prisma Client (in case it wasn't generated during build)
echo "Generating Prisma Client..."
npx prisma generate || true

# Run database migrations or push schema if no migrations exist
echo "Setting up database schema..."
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "Migrations found, running migrate deploy..."
npx prisma migrate deploy || true
else
  echo "No migrations found, pushing schema directly to database..."
  echo "Note: This is for initial setup. For production, create migrations first."
  npx prisma db push --accept-data-loss || true
fi

echo "Database setup complete!"
echo "Starting communication-service..."

# Start the application
exec node dist/index.js
