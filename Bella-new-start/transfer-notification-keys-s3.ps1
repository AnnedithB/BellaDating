# PowerShell script to transfer APNs and Firebase keys to EC2 via S3
# Follows the same pattern as EC2_REUPLOAD_COMMANDS.md
# Usage: .\transfer-notification-keys-s3.ps1

$ErrorActionPreference = "Stop"

# Configuration - matches EC2_REUPLOAD_COMMANDS.md pattern
$S3_BUCKET = "bellefiletransfer"  # Same bucket as used for code uploads
$EC2_PROJECT_DIR = "/home/kindred/projects/master-be"

# File paths
$LOCAL_P8_FILE = "services\notification-service\AuthKey_7B778FV6L3.p8"
$LOCAL_JSON_FILE = "services\notification-service\kindred-36c7d-firebase-adminsdk-fbsvc-d9286fdc38.json"

# Prompt for file paths if not found
if (-not (Test-Path $LOCAL_P8_FILE)) {
    Write-Host "APNs key file not found at: $LOCAL_P8_FILE" -ForegroundColor Yellow
    $LOCAL_P8_FILE = Read-Host "Enter the full path to your APNs .p8 file"
}

if (-not (Test-Path $LOCAL_JSON_FILE)) {
    Write-Host "Firebase JSON file not found at: $LOCAL_JSON_FILE" -ForegroundColor Yellow
    $LOCAL_JSON_FILE = Read-Host "Enter the full path to your Firebase JSON file"
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Uploading Notification Keys to S3" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NOTE: After uploading, run setup on EC2:" -ForegroundColor Yellow
Write-Host "  See SETUP_NOTIFICATION_KEYS_EC2.md for complete EC2 setup instructions" -ForegroundColor Yellow
Write-Host ""

# Check AWS CLI
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "Error: AWS CLI not found. Please install it first." -ForegroundColor Red
    Write-Host "Download from: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

# Upload files to S3 (same pattern as EC2_REUPLOAD_COMMANDS.md)
Write-Host "Step 1: Uploading files to S3..." -ForegroundColor Yellow
$p8S3Key = "notification-keys/apns_key.p8"
$jsonS3Key = "notification-keys/firebase-service-account.json"

Write-Host "  Uploading APNs key to s3://${S3_BUCKET}/${p8S3Key}..." -ForegroundColor Gray
aws s3 cp $LOCAL_P8_FILE "s3://${S3_BUCKET}/${p8S3Key}"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to upload APNs key to S3" -ForegroundColor Red
    exit 1
}

Write-Host "  Uploading Firebase JSON to s3://${S3_BUCKET}/${jsonS3Key}..." -ForegroundColor Gray
aws s3 cp $LOCAL_JSON_FILE "s3://${S3_BUCKET}/${jsonS3Key}"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to upload Firebase JSON to S3" -ForegroundColor Red
    exit 1
}

Write-Host "  Files uploaded successfully!" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Files are ready on S3!" -ForegroundColor Green
Write-Host ""

Write-Host "==========================================" -ForegroundColor Green
Write-Host "Upload Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps - Run these commands on EC2:" -ForegroundColor Yellow
Write-Host "(Following the same pattern as EC2_REUPLOAD_COMMANDS.md)" -ForegroundColor Gray
Write-Host ""
Write-Host "1. Download files from S3:" -ForegroundColor White
Write-Host "   cd /tmp" -ForegroundColor Gray
Write-Host "   AWS_PROFILE=saoud aws s3 cp s3://${S3_BUCKET}/${p8S3Key} ./apns_key.p8" -ForegroundColor Gray
Write-Host "   AWS_PROFILE=saoud aws s3 cp s3://${S3_BUCKET}/${jsonS3Key} ./firebase-service-account.json" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Create keys directory and move files:" -ForegroundColor White
Write-Host "   sudo mkdir -p /opt/keys" -ForegroundColor Gray
Write-Host "   sudo mv /tmp/apns_key.p8 /opt/keys/apns_key.p8" -ForegroundColor Gray
Write-Host "   sudo mv /tmp/firebase-service-account.json /opt/keys/firebase-service-account.json" -ForegroundColor Gray
Write-Host "   sudo chown root:root /opt/keys/apns_key.p8 /opt/keys/firebase-service-account.json" -ForegroundColor Gray
Write-Host "   sudo chmod 600 /opt/keys/apns_key.p8 /opt/keys/firebase-service-account.json" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Update .env file with Firebase values:" -ForegroundColor White
Write-Host "   ENVFILE=`"${EC2_PROJECT_DIR}/services/notification-service/.env`"" -ForegroundColor Gray
Write-Host "   # Extract values from JSON (if jq available):" -ForegroundColor Gray
Write-Host "   JSON=/opt/keys/firebase-service-account.json" -ForegroundColor Gray
Write-Host "   PROJECT_ID=`$(sudo jq -r '.project_id' `$JSON)" -ForegroundColor Gray
Write-Host "   CLIENT_EMAIL=`$(sudo jq -r '.client_email' `$JSON)" -ForegroundColor Gray
Write-Host "   PRIVATE_KEY_ESCAPED=`$(sudo jq -r '.private_key' `$JSON | sed ':a;N;`$!ba;s/\n/\\n/g')" -ForegroundColor Gray
Write-Host "   # Update .env file (or edit manually)" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Set APNS values in .env:" -ForegroundColor White
Write-Host "   APNS_KEY_ID=7B778FV6L3" -ForegroundColor Gray
Write-Host "   APNS_PRIVATE_KEY_PATH=/opt/keys/apns_key.p8" -ForegroundColor Gray
Write-Host "   APNS_TEAM_ID=YOUR_APPLE_TEAM_ID  # Set this manually" -ForegroundColor Gray
Write-Host "   APNS_BUNDLE_ID=com.kindred.belle  # Set this manually" -ForegroundColor Gray
Write-Host "   APNS_PRODUCTION=false  # or true for production" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Restart notification-service:" -ForegroundColor White
Write-Host "   sudo docker compose -f ${EC2_PROJECT_DIR}/docker-compose.yml restart notification-service" -ForegroundColor Gray
Write-Host ""
Write-Host "Files on S3:" -ForegroundColor Cyan
Write-Host "  - s3://${S3_BUCKET}/${p8S3Key}" -ForegroundColor Gray
Write-Host "  - s3://${S3_BUCKET}/${jsonS3Key}" -ForegroundColor Gray
Write-Host ""
