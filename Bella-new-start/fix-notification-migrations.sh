#!/bin/bash
# Fix notification service migrations on EC2
# 
# NOTE: The entrypoint has been updated to use 'prisma db push' as a fallback
# when migrations don't exist. This script is for creating proper migrations later.
#
# IMMEDIATE FIX: Just restart the notification-service container:
#   sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml restart notification-service
#
# The service will automatically create the tables using 'prisma db push'

echo "=========================================="
echo "Notification Service Migration Helper"
echo "=========================================="
echo ""
echo "The entrypoint has been updated to automatically create tables"
echo "using 'prisma db push' when migrations don't exist."
echo ""
echo "To fix immediately, just restart the service:"
echo "  sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml restart notification-service"
echo ""
echo "To create proper migrations (for version control):"
echo "  1. Run this command to create migration files inside the container:"
echo "     sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml exec notification-service \\"
echo "       sh -c 'cd /app/services/notification-service && npx prisma migrate dev --name init'"
echo ""
echo "  2. Copy migration files from container to host:"
echo "     sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml exec notification-service \\"
echo "       sh -c 'tar -czf - -C /app/services/notification-service prisma/migrations' | \\"
echo "       tar -xzf - -C /home/kindred/projects/master-be/services/notification-service/"
echo ""
echo "  3. Commit the migration files to git"
echo ""

