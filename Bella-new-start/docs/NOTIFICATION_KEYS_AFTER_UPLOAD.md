# Notification Keys Setup - After Code Upload

After running the code upload commands from `EC2_REUPLOAD_COMMANDS.md`, follow these steps to set up notification keys.

## Step 1: Get the Key Files to EC2

You need to get two files to EC2:
- **APNs Key**: `AuthKey_7B778FV6L3.p8` (or your APNs key file)
- **Firebase JSON**: `kindred-36c7d-firebase-adminsdk-fbsvc-d9286fdc38.json` (or your Firebase service account JSON)

### Option A: Upload to S3 from EC2 (if files are already on EC2)

```bash
# If you have the files somewhere on EC2, upload to S3
AWS_PROFILE=saoud aws s3 cp /path/to/AuthKey_7B778FV6L3.p8 s3://bellefiletransfer/notification-keys/apns_key.p8
AWS_PROFILE=saoud aws s3 cp /path/to/kindred-36c7d-firebase-adminsdk-fbsvc-d9286fdc38.json s3://bellefiletransfer/notification-keys/firebase-service-account.json
```

### Option B: Download from S3 (if files were uploaded from another machine)

```bash
cd /tmp
AWS_PROFILE=saoud aws s3 cp s3://bellefiletransfer/notification-keys/apns_key.p8 ./apns_key.p8
AWS_PROFILE=saoud aws s3 cp s3://bellefiletransfer/notification-keys/firebase-service-account.json ./firebase-service-account.json
```

### Option C: Place files directly in /tmp

If you have the files via SCP or any other method, place them at:
- `/tmp/apns_key.p8`
- `/tmp/firebase-service-account.json`

## Step 2: Run the Setup Script

The setup script should now be in your project directory after the code upload:

```bash
# Navigate to project directory
cd /home/kindred/projects/master-be

# Make script executable
chmod +x setup-notification-keys-ec2.sh

# Run the setup script
./setup-notification-keys-ec2.sh
```

The script will:
- ✅ Download files from S3 if not in /tmp (or use existing files)
- ✅ Create `/opt/keys` directory
- ✅ Move and secure files with proper permissions
- ✅ Update `.env` file with Firebase values
- ✅ Update APNs configuration

## Step 3: Set Manual Values

After the script runs, you need to manually set these values:

```bash
# Edit the .env file
sudo nano /home/kindred/projects/master-be/services/notification-service/.env
```

Add or update these lines:
```
APNS_TEAM_ID=YOUR_APPLE_TEAM_ID        # Get from Apple Developer account
APNS_BUNDLE_ID=com.kindred.belle       # Your app's bundle ID
APNS_PRODUCTION=false                  # false for sandbox, true for production
```

## Step 4: Restart Notification Service

```bash
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml restart notification-service
```

## Step 5: Verify Setup

Check the logs to confirm everything is working:

```bash
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml logs notification-service | grep -i "firebase\|apns"
```

Look for:
- ✅ `Firebase Cloud Messaging initialized successfully`
- ✅ `Apple Push Notification service initialized successfully`

If you see warnings about missing configuration, check:
1. Files exist at `/opt/keys/apns_key.p8` and `/opt/keys/firebase-service-account.json`
2. File permissions are correct: `sudo ls -la /opt/keys/`
3. Environment variables are set in `.env` file

## Quick Reference - Complete Flow

```bash
# 1. After code upload (from EC2_REUPLOAD_COMMANDS.md), get key files to /tmp
cd /tmp
AWS_PROFILE=saoud aws s3 cp s3://bellefiletransfer/notification-keys/apns_key.p8 ./apns_key.p8
AWS_PROFILE=saoud aws s3 cp s3://bellefiletransfer/notification-keys/firebase-service-account.json ./firebase-service-account.json

# 2. Run setup script
cd /home/kindred/projects/master-be
chmod +x setup-notification-keys-ec2.sh
./setup-notification-keys-ec2.sh

# 3. Set manual values
sudo nano /home/kindred/projects/master-be/services/notification-service/.env
# Add: APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_PRODUCTION

# 4. Restart service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml restart notification-service

# 5. Verify
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml logs notification-service | grep -i "firebase\|apns"
```
