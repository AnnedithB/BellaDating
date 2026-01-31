#!/bin/bash
# Transfer APNs and Firebase keys to EC2
# Usage: ./transfer-notification-keys.sh

set -e

# Configuration - UPDATE THESE VALUES
EC2_USER="kindred"
EC2_IP="51.20.160.210"  # Update with your EC2 IP
EC2_PROJECT_DIR="/home/kindred/projects/master-be"

# File paths - Update these to point to where your files are located
# If files are in the notification-service directory, use:
# LOCAL_P8_FILE="services/notification-service/AuthKey_7B778FV6L3.p8"
# LOCAL_JSON_FILE="services/notification-service/kindred-36c7d-firebase-adminsdk-fbsvc-d9286fdc38.json"
# Or use absolute paths like:
# LOCAL_P8_FILE="/home/user/Downloads/AuthKey_7B778FV6L3.p8"
# LOCAL_JSON_FILE="/home/user/Downloads/kindred-36c7d-firebase-adminsdk-fbsvc-d9286fdc38.json"

# Try default location first
LOCAL_P8_FILE="services/notification-service/AuthKey_7B778FV6L3.p8"
LOCAL_JSON_FILE="services/notification-service/kindred-36c7d-firebase-adminsdk-fbsvc-d9286fdc38.json"

# If files don't exist in default location, prompt user
if [ ! -f "$LOCAL_P8_FILE" ]; then
    echo "APNs key file not found at: $LOCAL_P8_FILE"
    read -p "Enter the full path to your APNs .p8 file: " LOCAL_P8_FILE
fi

if [ ! -f "$LOCAL_JSON_FILE" ]; then
    echo "Firebase JSON file not found at: $LOCAL_JSON_FILE"
    read -p "Enter the full path to your Firebase JSON file: " LOCAL_JSON_FILE
fi

echo "=========================================="
echo "Transferring Notification Keys to EC2"
echo "=========================================="

# Check if files exist
if [ ! -f "$LOCAL_P8_FILE" ]; then
    echo "Error: APNs key file not found: $LOCAL_P8_FILE"
    exit 1
fi

if [ ! -f "$LOCAL_JSON_FILE" ]; then
    echo "Error: Firebase JSON file not found: $LOCAL_JSON_FILE"
    exit 1
fi

echo "Step 1: Creating /opt/keys directory on EC2..."
ssh ${EC2_USER}@${EC2_IP} "sudo mkdir -p /opt/keys && sudo chmod 755 /opt/keys"

echo "Step 2: Copying APNs key file..."
scp "$LOCAL_P8_FILE" ${EC2_USER}@${EC2_IP}:/tmp/apns_key.p8
ssh ${EC2_USER}@${EC2_IP} "sudo mv /tmp/apns_key.p8 /opt/keys/apns_key.p8 && sudo chown root:root /opt/keys/apns_key.p8 && sudo chmod 600 /opt/keys/apns_key.p8"

echo "Step 3: Copying Firebase JSON file (for reference, values already in .env)..."
scp "$LOCAL_JSON_FILE" ${EC2_USER}@${EC2_IP}:/tmp/firebase-service-account.json
ssh ${EC2_USER}@${EC2_IP} "sudo mv /tmp/firebase-service-account.json /opt/keys/firebase-service-account.json && sudo chown root:root /opt/keys/firebase-service-account.json && sudo chmod 600 /opt/keys/firebase-service-account.json"

echo "Step 4: Updating notification-service .env on EC2..."
# Read the .env file and update it
ssh ${EC2_USER}@${EC2_IP} << 'ENDSSH'
ENVFILE="${EC2_PROJECT_DIR}/services/notification-service/.env"

# Extract Firebase values from JSON (if jq is available)
if command -v jq &> /dev/null; then
    JSON="/opt/keys/firebase-service-account.json"
    PROJECT_ID=$(sudo jq -r '.project_id' $JSON)
    CLIENT_EMAIL=$(sudo jq -r '.client_email' $JSON)
    PRIVATE_KEY_ESCAPED=$(sudo jq -r '.private_key' $JSON | sed ':a;N;$!ba;s/\n/\\n/g')
    
    # Update or add Firebase env vars
    if grep -q '^FIREBASE_PROJECT_ID=' $ENVFILE; then
        sed -i "s|^FIREBASE_PROJECT_ID=.*|FIREBASE_PROJECT_ID=${PROJECT_ID}|" $ENVFILE
    else
        echo "FIREBASE_PROJECT_ID=${PROJECT_ID}" >> $ENVFILE
    fi
    
    if grep -q '^FIREBASE_CLIENT_EMAIL=' $ENVFILE; then
        sed -i "s|^FIREBASE_CLIENT_EMAIL=.*|FIREBASE_CLIENT_EMAIL=${CLIENT_EMAIL}|" $ENVFILE
    else
        echo "FIREBASE_CLIENT_EMAIL=${CLIENT_EMAIL}" >> $ENVFILE
    fi
    
    if grep -q '^FIREBASE_PRIVATE_KEY=' $ENVFILE; then
        sed -i "s|^FIREBASE_PRIVATE_KEY=.*|FIREBASE_PRIVATE_KEY=\"${PRIVATE_KEY_ESCAPED}\"|" $ENVFILE
    else
        echo "FIREBASE_PRIVATE_KEY=\"${PRIVATE_KEY_ESCAPED}\"" >> $ENVFILE
    fi
fi

# Update APNs values (you'll need to set APNS_TEAM_ID manually)
if grep -q '^APNS_KEY_ID=' $ENVFILE; then
    sed -i 's|^APNS_KEY_ID=.*|APNS_KEY_ID=7B778FV6L3|' $ENVFILE
else
    echo "APNS_KEY_ID=7B778FV6L3" >> $ENVFILE
fi

if grep -q '^APNS_PRIVATE_KEY_PATH=' $ENVFILE; then
    sed -i 's|^APNS_PRIVATE_KEY_PATH=.*|APNS_PRIVATE_KEY_PATH=/opt/keys/apns_key.p8|' $ENVFILE
else
    echo "APNS_PRIVATE_KEY_PATH=/opt/keys/apns_key.p8" >> $ENVFILE
fi

echo "Updated .env file. Please manually set APNS_TEAM_ID and APNS_BUNDLE_ID if not already set."
ENDSSH

echo ""
echo "=========================================="
echo "Transfer Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. SSH to EC2 and manually set APNS_TEAM_ID in:"
echo "   ${EC2_PROJECT_DIR}/services/notification-service/.env"
echo "2. Set APNS_BUNDLE_ID (e.g., com.kindred.belle)"
echo "3. Set APNS_PRODUCTION=true for production, false for sandbox"
echo "4. Restart notification-service:"
echo "   sudo docker compose -f ${EC2_PROJECT_DIR}/docker-compose.yml restart notification-service"
echo ""
echo "Files are now secure on EC2 at:"
echo "  - /opt/keys/apns_key.p8"
echo "  - /opt/keys/firebase-service-account.json"
echo ""
