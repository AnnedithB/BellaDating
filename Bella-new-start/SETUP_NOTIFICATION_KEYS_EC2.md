# Setup Notification Keys on EC2 - Complete Guide

This guide shows you how to set up APNs and Firebase keys **entirely on EC2**, without needing to upload from your local machine.

## Option 1: If Files Are Already on EC2

If you've already placed the files on EC2 (via SCP, S3, or any other method):

```bash
# Make script executable
chmod +x setup-notification-keys-ec2.sh

# Run the setup script
./setup-notification-keys-ec2.sh
```

## Option 2: Upload Files to S3 from EC2

If you have the files on EC2 but want to use S3 as storage:

```bash
# Upload APNs key to S3
AWS_PROFILE=saoud aws s3 cp /path/to/AuthKey_7B778FV6L3.p8 s3://bellefiletransfer/notification-keys/apns_key.p8

# Upload Firebase JSON to S3
AWS_PROFILE=saoud aws s3 cp /path/to/kindred-36c7d-firebase-adminsdk-fbsvc-d9286fdc38.json s3://bellefiletransfer/notification-keys/firebase-service-account.json

# Then run setup script
chmod +x setup-notification-keys-ec2.sh
./setup-notification-keys-ec2.sh
```

## Option 3: Manual Setup (No Script)

If you prefer to do it manually:

```bash
# 1. Create keys directory
sudo mkdir -p /opt/keys

# 2. Copy your files to /tmp (if not already there)
# Place your APNs key at: /tmp/apns_key.p8
# Place your Firebase JSON at: /tmp/firebase-service-account.json

# 3. Move and secure files
sudo mv /tmp/apns_key.p8 /opt/keys/apns_key.p8
sudo mv /tmp/firebase-service-account.json /opt/keys/firebase-service-account.json
sudo chown root:root /opt/keys/apns_key.p8 /opt/keys/firebase-service-account.json
sudo chmod 600 /opt/keys/apns_key.p8 /opt/keys/firebase-service-account.json

# 4. Update .env file
ENVFILE="/home/kindred/projects/master-be/services/notification-service/.env"

# Extract Firebase values (if jq available)
if command -v jq &> /dev/null; then
    JSON="/opt/keys/firebase-service-account.json"
    PROJECT_ID=$(sudo jq -r '.project_id' $JSON)
    CLIENT_EMAIL=$(sudo jq -r '.client_email' $JSON)
    PRIVATE_KEY_ESCAPED=$(sudo jq -r '.private_key' $JSON | sed ':a;N;$!ba;s/\n/\\n/g')
    
    # Update Firebase env vars
    sudo sed -i "s|^FIREBASE_PROJECT_ID=.*|FIREBASE_PROJECT_ID=${PROJECT_ID}|" $ENVFILE
    sudo sed -i "s|^FIREBASE_CLIENT_EMAIL=.*|FIREBASE_CLIENT_EMAIL=${CLIENT_EMAIL}|" $ENVFILE
    sudo sed -i "s|^FIREBASE_PRIVATE_KEY=.*|FIREBASE_PRIVATE_KEY=\"${PRIVATE_KEY_ESCAPED}\"|" $ENVFILE
fi

# Update APNs values
sudo sed -i 's|^APNS_KEY_ID=.*|APNS_KEY_ID=7B778FV6L3|' $ENVFILE
sudo sed -i 's|^APNS_PRIVATE_KEY_PATH=.*|APNS_PRIVATE_KEY_PATH=/opt/keys/apns_key.p8|' $ENVFILE

# 5. Manually set these in .env (edit with nano/vim):
# APNS_TEAM_ID=YOUR_APPLE_TEAM_ID
# APNS_BUNDLE_ID=com.kindred.belle
# APNS_PRODUCTION=false

# 6. Restart notification service
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml restart notification-service
```

## Getting Files to EC2

If you need to get the files to EC2, here are options:

### Option A: Download from Apple/Firebase directly on EC2

**APNs Key:**
- Download from Apple Developer Portal
- Or if you have it elsewhere, use `wget` or `curl` to download to EC2

**Firebase JSON:**
- Download from Firebase Console
- Or regenerate: Firebase Console → Project Settings → Service Accounts → Generate New Private Key

### Option B: Use SCP (if you have SSH access from another machine)

```bash
# From a machine with SSH access
scp AuthKey_7B778FV6L3.p8 kindred@51.20.160.210:/tmp/
scp firebase-service-account.json kindred@51.20.160.210:/tmp/
```

### Option C: Upload to S3 from any machine, then download on EC2

```bash
# On EC2, download from S3
cd /tmp
AWS_PROFILE=saoud aws s3 cp s3://bellefiletransfer/notification-keys/apns_key.p8 ./apns_key.p8
AWS_PROFILE=saoud aws s3 cp s3://bellefiletransfer/notification-keys/firebase-service-account.json ./firebase-service-account.json
```

## Final Steps (After Files Are Set Up)

1. **Set APNS_TEAM_ID** (get from Apple Developer account):
   ```bash
   sudo nano /home/kindred/projects/master-be/services/notification-service/.env
   # Add: APNS_TEAM_ID=YOUR_TEAM_ID
   ```

2. **Set APNS_BUNDLE_ID**:
   ```bash
   # In the same .env file, add:
   APNS_BUNDLE_ID=com.kindred.belle
   ```

3. **Set APNS_PRODUCTION**:
   ```bash
   # false for sandbox, true for production
   APNS_PRODUCTION=false
   ```

4. **Restart notification service**:
   ```bash
   sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml restart notification-service
   ```

5. **Verify**:
   ```bash
   sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml logs notification-service | grep -i "firebase\|apns"
   ```

Look for:
- ✅ `Firebase Cloud Messaging initialized successfully`
- ✅ `Apple Push Notification service initialized successfully`
