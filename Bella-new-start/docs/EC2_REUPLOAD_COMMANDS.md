# EC2 Reupload Commands

## On Your Local Machine (Windows)

```powershell
# Navigate to project root
cd D:\Bella

# Create zip file
Compress-Archive -Path Bella-new-start -DestinationPath belle-new-start.zip -Force

# Upload to S3
aws s3 cp belle-new-start.zip s3://bella-file-transfer/belle-new-start.zip
```

## On EC2 (Linux)

```bash
   sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml logs -f user-service
# Download from S3
cd /tmp
aws s3 cp s3://kindred-users/belle-new-start.zip ./belle-new-start.zip

# Remove old files (using sudo since ubuntu user doesn't have direct access)
sudo rm -rf /home/kindred/projects/master-be/*

# Unzip to /tmp
sudo unzip -o belle-new-start.zip -d /tmp

# Fix ownership
sudo chown -R kindred:kindred /tmp/Bella-new-start

# Copy to project directory
sudo cp -r /tmp/Bella-new-start/* /home/kindred/projects/master-be/

# Navigate and rebuild (use sudo with absolute paths)
cd /tmp
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml down
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d --build
```

## Alternative: Work from /tmp

If you prefer to work from /tmp without sudo:

```bash
# Download and unzip
cd /tmp
aws s3 cp s3://bella-file-transfer/belle-new-start.zip ./belle-new-start.zip
sudo unzip -o belle-new-start.zip -d /tmp
sudo chown -R kindred:kindred /tmp/Bella-new-start

# Copy to project directory
sudo cp -r /tmp/Bella-new-start/* /home/kindred/projects/master-be/

# Rebuild using absolute paths
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml down
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml up -d --build
```

## Set Environment Variables (Photo Verification)

Before rebuilding, set AWS Rekognition credentials:

```bash
# Export environment variables (for current session)
export AWS_ACCESS_KEY_ID=<YOUR_AWS_ACCESS_KEY_ID>
export AWS_SECRET_ACCESS_KEY=<YOUR_AWS_SECRET_ACCESS_KEY>
export AWS_REGION=us-east-2
export VERIFICATION_PROVIDER=aws
export AWS_REKOGNITION_MIN_SIMILARITY=80

# Or create/update .env file in project root
cd /home/kindred/projects/master-be
cat > .env << EOF
AWS_ACCESS_KEY_ID=<YOUR_AWS_ACCESS_KEY_ID>
AWS_SECRET_ACCESS_KEY=<YOUR_AWS_SECRET_ACCESS_KEY>
AWS_REGION=us-east-2
VERIFICATION_PROVIDER=aws
AWS_REKOGNITION_MIN_SIMILARITY=80
EOF
```

> **Note:** Docker Compose automatically reads `.env` file from the project root. The credentials are also configured in `docker-compose.yml` with defaults.

## Fix Volume Permissions (If Upload Fails)

If you get "File upload failed" errors, the volume permissions may be wrong:

```bash
# Stop the user-service container
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml stop user-service

# Fix permissions on the volume (nodejs user is uid 1001)
sudo chown -R 1001:1001 /var/lib/docker/volumes/master-be_user_service_uploads/_data
sudo chmod -R 755 /var/lib/docker/volumes/master-be_user_service_uploads/_data

# Restart the container
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml start user-service
```

Or fix permissions while container is running (if it has root access):

```bash
# Fix permissions from inside the container
sudo docker exec -u root kindred-user-service chown -R nodejs:nodejs /app/services/user-service/uploads
sudo docker exec -u root kindred-user-service chmod -R 755 /app/services/user-service/uploads
```

## Check Status

```bash
# Check running containers
sudo docker ps

# Check logs
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml logs --tail=50

# Verify photo verification is working
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml logs user-service | grep -i verification

# Check uploads directory permissions
sudo docker exec kindred-user-service ls -la /app/services/user-service/uploads
```

