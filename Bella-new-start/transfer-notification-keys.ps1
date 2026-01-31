# PowerShell script to transfer APNs and Firebase keys to EC2
# Usage: .\transfer-notification-keys.ps1

$ErrorActionPreference = "Stop"

# Configuration - UPDATE THESE VALUES
$EC2_USER = "kindred"
$EC2_IP = "51.20.160.210"  # Update with your EC2 IP
$EC2_PROJECT_DIR = "/home/kindred/projects/master-be"

# SSH Key Configuration - If you have an SSH key, specify the path here
# Leave empty to use default SSH key location (~/.ssh/id_rsa or ~/.ssh/id_ed25519)
# Or specify full path like: $SSH_KEY_PATH = "C:\Users\YourName\.ssh\your-key.pem"
$SSH_KEY_PATH = ""

# Alternative: Use S3 for file transfer (if SSH is not configured)
# Set to $true to upload files to S3 instead of using SCP
$USE_S3_TRANSFER = $false
$S3_BUCKET = "bellefiletransfer"  # Your S3 bucket name

# File paths - Update these to point to where your files are located
# If files are in the notification-service directory, use:
# $LOCAL_P8_FILE = "services\notification-service\AuthKey_7B778FV6L3.p8"
# $LOCAL_JSON_FILE = "services\notification-service\kindred-36c7d-firebase-adminsdk-fbsvc-d9286fdc38.json"
# Or use absolute paths like:
# $LOCAL_P8_FILE = "D:\Downloads\AuthKey_7B778FV6L3.p8"
# $LOCAL_JSON_FILE = "D:\Downloads\kindred-36c7d-firebase-adminsdk-fbsvc-d9286fdc38.json"

# Try default location first, then prompt if not found
$LOCAL_P8_FILE = "services\notification-service\AuthKey_7B778FV6L3.p8"
$LOCAL_JSON_FILE = "services\notification-service\kindred-36c7d-firebase-adminsdk-fbsvc-d9286fdc38.json"

# If files don't exist in default location, prompt user
if (-not (Test-Path $LOCAL_P8_FILE)) {
    Write-Host "APNs key file not found at: $LOCAL_P8_FILE" -ForegroundColor Yellow
    $LOCAL_P8_FILE = Read-Host "Enter the full path to your APNs .p8 file (e.g., D:\Downloads\AuthKey_7B778FV6L3.p8)"
}

if (-not (Test-Path $LOCAL_JSON_FILE)) {
    Write-Host "Firebase JSON file not found at: $LOCAL_JSON_FILE" -ForegroundColor Yellow
    $LOCAL_JSON_FILE = Read-Host "Enter the full path to your Firebase JSON file (e.g., D:\Downloads\kindred-36c7d-firebase-adminsdk-fbsvc-d9286fdc38.json)"
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Transferring Notification Keys to EC2" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if files exist
if (-not (Test-Path $LOCAL_P8_FILE)) {
    Write-Host "Error: APNs key file not found: $LOCAL_P8_FILE" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $LOCAL_JSON_FILE)) {
    Write-Host "Error: Firebase JSON file not found: $LOCAL_JSON_FILE" -ForegroundColor Red
    exit 1
}

# Build SSH command with key if specified
$SSH_ARGS = @()
$SCP_ARGS = @()
if ($SSH_KEY_PATH -and (Test-Path $SSH_KEY_PATH)) {
    $SSH_ARGS = @("-i", $SSH_KEY_PATH)
    $SCP_ARGS = @("-i", $SSH_KEY_PATH)
    Write-Host "Using SSH key: $SSH_KEY_PATH" -ForegroundColor Green
} else {
    Write-Host "Using default SSH key (or password authentication)" -ForegroundColor Yellow
    Write-Host "If you get 'Permission denied', you may need to:" -ForegroundColor Yellow
    Write-Host "  1. Set up SSH key authentication, OR" -ForegroundColor Yellow
    Write-Host "  2. Use the S3 transfer method: .\transfer-notification-keys-s3.ps1" -ForegroundColor Yellow
    Write-Host ""
}

# Test SSH connection first
Write-Host "Testing SSH connection..." -ForegroundColor Yellow
$testConnection = & ssh @SSH_ARGS "${EC2_USER}@${EC2_IP}" "echo 'Connection successful'" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "SSH connection failed!" -ForegroundColor Red
    Write-Host "Error: $testConnection" -ForegroundColor Red
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "1. Set up SSH key authentication:" -ForegroundColor White
    Write-Host "   - Generate key: ssh-keygen -t ed25519" -ForegroundColor Gray
    Write-Host "   - Copy to EC2: ssh-copy-id ${EC2_USER}@${EC2_IP}" -ForegroundColor Gray
    Write-Host "   - Or specify key path in script: `$SSH_KEY_PATH = 'C:\path\to\key.pem'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Use S3 transfer method instead:" -ForegroundColor White
    Write-Host "   - Set `$USE_S3_TRANSFER = `$true in the script" -ForegroundColor Gray
    Write-Host "   - Upload files to S3, then download on EC2" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "Step 1: Creating /opt/keys directory on EC2..." -ForegroundColor Yellow
& ssh @SSH_ARGS "${EC2_USER}@${EC2_IP}" "sudo mkdir -p /opt/keys && sudo chmod 755 /opt/keys"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create directory on EC2" -ForegroundColor Red
    exit 1
}

Write-Host "Step 2: Copying APNs key file..." -ForegroundColor Yellow
& scp @SCP_ARGS $LOCAL_P8_FILE "${EC2_USER}@${EC2_IP}:/tmp/apns_key.p8"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to copy APNs key file" -ForegroundColor Red
    exit 1
}
& ssh @SSH_ARGS "${EC2_USER}@${EC2_IP}" "sudo mv /tmp/apns_key.p8 /opt/keys/apns_key.p8 && sudo chown root:root /opt/keys/apns_key.p8 && sudo chmod 600 /opt/keys/apns_key.p8"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to move APNs key file" -ForegroundColor Red
    exit 1
}

Write-Host "Step 3: Copying Firebase JSON file..." -ForegroundColor Yellow
& scp @SCP_ARGS $LOCAL_JSON_FILE "${EC2_USER}@${EC2_IP}:/tmp/firebase-service-account.json"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to copy Firebase JSON file" -ForegroundColor Red
    exit 1
}
& ssh @SSH_ARGS "${EC2_USER}@${EC2_IP}" "sudo mv /tmp/firebase-service-account.json /opt/keys/firebase-service-account.json && sudo chown root:root /opt/keys/firebase-service-account.json && sudo chmod 600 /opt/keys/firebase-service-account.json"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to move Firebase JSON file" -ForegroundColor Red
    exit 1
}

Write-Host "Step 4: Updating notification-service .env on EC2..." -ForegroundColor Yellow
$envUpdateScript = @"
ENVFILE=`"${EC2_PROJECT_DIR}/services/notification-service/.env`"

# Extract Firebase values from JSON (if jq is available)
if command -v jq &> /dev/null; then
    JSON=`"/opt/keys/firebase-service-account.json`"
    PROJECT_ID=`$(sudo jq -r '.project_id' `$JSON)
    CLIENT_EMAIL=`$(sudo jq -r '.client_email' `$JSON)
    PRIVATE_KEY_ESCAPED=`$(sudo jq -r '.private_key' `$JSON | sed ':a;N;`$!ba;s/\n/\\n/g')
    
    # Update or add Firebase env vars
    if grep -q '^FIREBASE_PROJECT_ID=' `$ENVFILE; then
        sed -i `"s|^FIREBASE_PROJECT_ID=.*|FIREBASE_PROJECT_ID=`${PROJECT_ID}|`" `$ENVFILE
    else
        echo `"FIREBASE_PROJECT_ID=`${PROJECT_ID}`" >> `$ENVFILE
    fi
    
    if grep -q '^FIREBASE_CLIENT_EMAIL=' `$ENVFILE; then
        sed -i `"s|^FIREBASE_CLIENT_EMAIL=.*|FIREBASE_CLIENT_EMAIL=`${CLIENT_EMAIL}|`" `$ENVFILE
    else
        echo `"FIREBASE_CLIENT_EMAIL=`${CLIENT_EMAIL}`" >> `$ENVFILE
    fi
    
    if grep -q '^FIREBASE_PRIVATE_KEY=' `$ENVFILE; then
        sed -i `"s|^FIREBASE_PRIVATE_KEY=.*|FIREBASE_PRIVATE_KEY=\`"`${PRIVATE_KEY_ESCAPED}\`"|`" `$ENVFILE
    else
        echo `"FIREBASE_PRIVATE_KEY=\`"`${PRIVATE_KEY_ESCAPED}\`"`" >> `$ENVFILE
    fi
fi

# Update APNs values
if grep -q '^APNS_KEY_ID=' `$ENVFILE; then
    sed -i 's|^APNS_KEY_ID=.*|APNS_KEY_ID=7B778FV6L3|' `$ENVFILE
else
    echo `"APNS_KEY_ID=7B778FV6L3`" >> `$ENVFILE
fi

if grep -q '^APNS_PRIVATE_KEY_PATH=' `$ENVFILE; then
    sed -i 's|^APNS_PRIVATE_KEY_PATH=.*|APNS_PRIVATE_KEY_PATH=/opt/keys/apns_key.p8|' `$ENVFILE
else
    echo `"APNS_PRIVATE_KEY_PATH=/opt/keys/apns_key.p8`" >> `$ENVFILE
fi

echo `"Updated .env file. Please manually set APNS_TEAM_ID and APNS_BUNDLE_ID if not already set.`"
"@

& ssh @SSH_ARGS "${EC2_USER}@${EC2_IP}" $envUpdateScript
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Failed to update .env file automatically" -ForegroundColor Yellow
    Write-Host "You may need to update it manually on EC2" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Transfer Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. SSH to EC2 and manually set APNS_TEAM_ID in:" -ForegroundColor White
Write-Host "   ${EC2_PROJECT_DIR}/services/notification-service/.env" -ForegroundColor Gray
Write-Host "2. Set APNS_BUNDLE_ID (e.g., com.kindred.belle)" -ForegroundColor White
Write-Host "3. Set APNS_PRODUCTION=true for production, false for sandbox" -ForegroundColor White
Write-Host "4. Restart notification-service:" -ForegroundColor White
Write-Host "   sudo docker compose -f ${EC2_PROJECT_DIR}/docker-compose.yml restart notification-service" -ForegroundColor Gray
Write-Host ""
Write-Host "Files are now secure on EC2 at:" -ForegroundColor Cyan
Write-Host "  - /opt/keys/apns_key.p8" -ForegroundColor Gray
Write-Host "  - /opt/keys/firebase-service-account.json" -ForegroundColor Gray
Write-Host ""
