#!/bin/bash
# Setup notification keys on EC2 - COMPLETE SETUP
# Run this script directly on EC2
# Usage: ./setup-notification-keys-ec2.sh

set -e

S3_BUCKET="bellefiletransfer"
EC2_PROJECT_DIR="/home/kindred/projects/master-be"

echo "=========================================="
echo "Setting up Notification Keys on EC2"
echo "=========================================="
echo ""

# Check for files in multiple locations
P8_FILE=""
JSON_FILE=""

# Priority 1: Check in project directory (from zip extraction)
PROJECT_P8="${EC2_PROJECT_DIR}/services/notification-service/AuthKey_7B778FV6L3.p8"
PROJECT_JSON="${EC2_PROJECT_DIR}/services/notification-service/kindred-36c7d-firebase-adminsdk-fbsvc-d9286fdc38.json"

# Priority 2: Check in /tmp
TMP_P8="/tmp/apns_key.p8"
TMP_JSON="/tmp/firebase-service-account.json"

# Priority 3: Check S3

# Step 1: Find or get the files
echo "Step 1: Locating key files..."

if [ -f "$PROJECT_P8" ]; then
    P8_FILE="$PROJECT_P8"
    echo "  ✓ Found APNs key in project directory"
elif [ -f "$TMP_P8" ]; then
    P8_FILE="$TMP_P8"
    echo "  ✓ Found APNs key in /tmp"
else
    echo "  ⚠ APNs key not found locally, trying S3..."
    cd /tmp
    AWS_PROFILE=saoud aws s3 cp s3://${S3_BUCKET}/notification-keys/apns_key.p8 ./apns_key.p8 2>/dev/null && P8_FILE="$TMP_P8" && echo "  ✓ Downloaded APNs key from S3" || echo "  ❌ APNs key not found in S3"
fi

if [ -f "$PROJECT_JSON" ]; then
    JSON_FILE="$PROJECT_JSON"
    echo "  ✓ Found Firebase JSON in project directory"
elif [ -f "$TMP_JSON" ]; then
    JSON_FILE="$TMP_JSON"
    echo "  ✓ Found Firebase JSON in /tmp"
else
    echo "  ⚠ Firebase JSON not found locally, trying S3..."
    cd /tmp
    AWS_PROFILE=saoud aws s3 cp s3://${S3_BUCKET}/notification-keys/firebase-service-account.json ./firebase-service-account.json 2>/dev/null && JSON_FILE="$TMP_JSON" && echo "  ✓ Downloaded Firebase JSON from S3" || echo "  ❌ Firebase JSON not found in S3"
fi

# Verify files exist
if [ -z "$P8_FILE" ] || [ ! -f "$P8_FILE" ]; then
    echo ""
    echo "❌ APNs key file not found!"
    echo "Please place the file at one of these locations:"
    echo "  - ${PROJECT_P8}"
    echo "  - ${TMP_P8}"
    echo "  - Or upload to S3: s3://${S3_BUCKET}/notification-keys/apns_key.p8"
    echo ""
    exit 1
fi

if [ -z "$JSON_FILE" ] || [ ! -f "$JSON_FILE" ]; then
    echo ""
    echo "❌ Firebase JSON file not found!"
    echo "Please place the file at one of these locations:"
    echo "  - ${PROJECT_JSON}"
    echo "  - ${TMP_JSON}"
    echo "  - Or upload to S3: s3://${S3_BUCKET}/notification-keys/firebase-service-account.json"
    echo ""
    exit 1
fi

# Copy files to /tmp if they're in project directory (for easier handling)
if [ "$P8_FILE" != "$TMP_P8" ]; then
    echo "  Copying APNs key to /tmp for processing..."
    cp "$P8_FILE" "$TMP_P8"
    P8_FILE="$TMP_P8"
fi

if [ "$JSON_FILE" != "$TMP_JSON" ]; then
    echo "  Copying Firebase JSON to /tmp for processing..."
    cp "$JSON_FILE" "$TMP_JSON"
    JSON_FILE="$TMP_JSON"
fi

# Step 2: Create keys directory and move files
echo "Step 2: Setting up keys directory..."
sudo mkdir -p /opt/keys
sudo mv /tmp/apns_key.p8 /opt/keys/apns_key.p8
sudo mv /tmp/firebase-service-account.json /opt/keys/firebase-service-account.json
sudo chown root:root /opt/keys/apns_key.p8 /opt/keys/firebase-service-account.json
sudo chmod 600 /opt/keys/apns_key.p8 /opt/keys/firebase-service-account.json

# Step 3: Update .env file with Firebase values
echo "Step 3: Updating .env file..."
ENVFILE="${EC2_PROJECT_DIR}/services/notification-service/.env"

# Extract Firebase values from JSON (if jq is available)
if command -v jq &> /dev/null; then
    JSON="/opt/keys/firebase-service-account.json"
    PROJECT_ID=$(sudo jq -r '.project_id' $JSON)
    CLIENT_EMAIL=$(sudo jq -r '.client_email' $JSON)
    PRIVATE_KEY_ESCAPED=$(sudo jq -r '.private_key' $JSON | sed ':a;N;$!ba;s/\n/\\n/g')
    
    # Update or add Firebase env vars
    if grep -q '^FIREBASE_PROJECT_ID=' $ENVFILE; then
        sudo sed -i "s|^FIREBASE_PROJECT_ID=.*|FIREBASE_PROJECT_ID=${PROJECT_ID}|" $ENVFILE
    else
        echo "FIREBASE_PROJECT_ID=${PROJECT_ID}" | sudo tee -a $ENVFILE > /dev/null
    fi
    
    if grep -q '^FIREBASE_CLIENT_EMAIL=' $ENVFILE; then
        sudo sed -i "s|^FIREBASE_CLIENT_EMAIL=.*|FIREBASE_CLIENT_EMAIL=${CLIENT_EMAIL}|" $ENVFILE
    else
        echo "FIREBASE_CLIENT_EMAIL=${CLIENT_EMAIL}" | sudo tee -a $ENVFILE > /dev/null
    fi
    
    if grep -q '^FIREBASE_PRIVATE_KEY=' $ENVFILE; then
        sudo sed -i "s|^FIREBASE_PRIVATE_KEY=.*|FIREBASE_PRIVATE_KEY=\"${PRIVATE_KEY_ESCAPED}\"|" $ENVFILE
    else
        echo "FIREBASE_PRIVATE_KEY=\"${PRIVATE_KEY_ESCAPED}\"" | sudo tee -a $ENVFILE > /dev/null
    fi
    
    echo "  ✓ Firebase values updated from JSON"
else
    echo "  ⚠ jq not found - please update Firebase values manually in .env"
fi

# Update APNs values
if grep -q '^APNS_KEY_ID=' $ENVFILE; then
    sudo sed -i 's|^APNS_KEY_ID=.*|APNS_KEY_ID=7B778FV6L3|' $ENVFILE
else
    echo "APNS_KEY_ID=7B778FV6L3" | sudo tee -a $ENVFILE > /dev/null
fi

if grep -q '^APNS_PRIVATE_KEY_PATH=' $ENVFILE; then
    sudo sed -i 's|^APNS_PRIVATE_KEY_PATH=.*|APNS_PRIVATE_KEY_PATH=/opt/keys/apns_key.p8|' $ENVFILE
else
    echo "APNS_PRIVATE_KEY_PATH=/opt/keys/apns_key.p8" | sudo tee -a $ENVFILE > /dev/null
fi

echo "  ✓ APNs values updated"
echo ""

echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Manually set APNS_TEAM_ID in:"
echo "   ${ENVFILE}"
echo "   (Get from Apple Developer account)"
echo ""
echo "2. Set APNS_BUNDLE_ID (e.g., com.kindred.belle)"
echo ""
echo "3. Set APNS_PRODUCTION=false (or true for production)"
echo ""
echo "4. Restart notification-service:"
echo "   sudo docker compose -f ${EC2_PROJECT_DIR}/docker-compose.yml restart notification-service"
echo ""
echo "Files are now at:"
echo "  - /opt/keys/apns_key.p8"
echo "  - /opt/keys/firebase-service-account.json"
echo ""
