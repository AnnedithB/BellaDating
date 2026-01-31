# Quick Setup After Code Upload

After extracting the zip file, run these commands:

## Step 1: Run the Setup Script

The key files are already in your project directory from the zip extraction. Just run:

```bash
cd /home/kindred/projects/master-be
chmod +x setup-notification-keys-ec2.sh
./setup-notification-keys-ec2.sh
```

The script will:
- ✅ Find the key files in the project directory
- ✅ Move them to `/opt/keys` with proper permissions
- ✅ Update the `.env` file with Firebase values
- ✅ Update APNs configuration

## Step 2: Set Manual Values

Edit the `.env` file to add your Apple Team ID:

```bash
sudo nano /home/kindred/projects/master-be/services/notification-service/.env
```

Add or update these lines:
```
APNS_TEAM_ID=YOUR_APPLE_TEAM_ID        # Get from Apple Developer account
APNS_BUNDLE_ID=com.kindred.belle       # Your app's bundle ID
APNS_PRODUCTION=false                  # false for sandbox, true for production
```

## Step 3: Restart Notification Service

```bash
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml restart notification-service
```

## Step 4: Verify

```bash
sudo docker compose -f /home/kindred/projects/master-be/docker-compose.yml logs notification-service | grep -i "firebase\|apns"
```

Look for:
- ✅ `Firebase Cloud Messaging initialized successfully`
- ✅ `Apple Push Notification service initialized successfully`

## That's It!

The files are already in your project from the zip, so the setup script will find them automatically.
