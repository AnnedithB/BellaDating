Here’s exactly where to get each file and concise commands to copy them to EC2, secure them, update the service .env, and restart the notification-service. Pick the manual-edit or automated steps you prefer.
1) Get the files
APNs (.p8): Apple Developer → Certificates, Identifiers & Profiles → Keys → Create Key (enable APNs) → download AuthKey_XXXXXX.p8. Note the Key ID and your Apple Team ID (from your account).
Firebase JSON: Firebase Console → Project Settings → Service accounts → Generate private key → download firebase-service-account.json.
2) Copy files to EC2 (example uses SSH user ec2-user and your EC2_IP)
Replace paths with your local download paths.
Manual copy (from your dev machine):
create remote dir and set your user owner (first-run):
scp ~/Downloads/AuthKey_ABC123.p8 ec2-user@EC2_IP:/tmp/
scp ~/Downloads/firebase-service-account.json ec2-user@EC2_IP:/tmp/
ssh into EC2 and move & secure:
ssh ec2-user@EC2_IP
sudo mkdir -p /opt/keys
sudo mv /tmp/AuthKey_ABC123.p8 /opt/keys/apns_key.p8
sudo mv /tmp/firebase-service-account.json /opt/keys/firebase-service-account.json
sudo chown root:root /opt/keys/apns_key.p8 /opt/keys/firebase-service-account.json
sudo chmod 600 /opt/keys/apns_key.p8 /opt/keys/firebase-service-account.json
3) Edit the notification-service .env on EC2
Path in repo: Bella-new-start/services/notification-service/.env (we created a template there).
Manual edit (easy and safe):
ssh ec2-user@EC2_IP
sudo nano ~/Bella-new-start/services/notification-service/.env
Ensure these lines are set (replace placeholders):
APNS_PRIVATE_KEY_PATH=/opt/keys/apns_key.p8
APNS_KEY_ID=YOUR_APNS_KEY_ID
APNS_TEAM_ID=YOUR_APPLE_TEAM_ID
APNS_BUNDLE_ID=com.yourcompany.yourapp
APNS_PRODUCTION=true|false
For Firebase, simplest approach: copy the JSON’s private_key string into the .env as a single-line escaped value:
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIC...==\n-----END PRIVATE KEY-----"
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
(Important: preserve the \n characters — paste newlines replaced by \n so the env value is a single quoted string.)
4) Automated extraction (if you have jq & python3 on EC2)
If you prefer commands to pull values direct from the JSON and update .env automatically:
ssh ec2-user@EC2_IP
install helpers if needed
sudo apt-get update && sudo apt-get install -y jq python3
ENVFILE=~/Bella-new-start/services/notification-service/.env
JSON=/opt/keys/firebase-service-account.json
PROJECT_ID=$(jq -r '.project_id' $JSON)
CLIENT_EMAIL=$(jq -r '.client_email' $JSON)
PRIVATE_KEY_ESCAPED=$(jq -r '.private_key' $JSON | sed ':a;N;$!ba;s/\n/\\n/g')
set or replace ENV entries
grep -q '^FIREBASE_PROJECT_ID=' $ENVFILE && sed -i "s|^FIREBASE_PROJECT_ID=.|FIREBASE_PROJECT_ID=${PROJECT_ID}|" $ENVFILE || echo "FIREBASE_PROJECT_ID=${PROJECT_ID}" >> $ENVFILE
grep -q '^FIREBASE_CLIENT_EMAIL=' $ENVFILE && sed -i "s|^FIREBASE_CLIENT_EMAIL=.|FIREBASE_CLIENT_EMAIL=${CLIENT_EMAIL}|" $ENVFILE || echo "FIREBASE_CLIENT_EMAIL=${CLIENT_EMAIL}" >> $ENVFILE
write private key (safe single-line escaped)
python3 - <<PY
import os
env='${ENVFILE}'
key='FIREBASE_PRIVATE_KEY="'"${PRIVATE_KEY_ESCAPED}"'"'
lines=[]
if os.path.exists(env):
with open(env) as f: lines=f.read().splitlines()
found=False
for i,l in enumerate(lines):
if l.startswith('FIREBASE_PRIVATE_KEY='):
lines[i]=key; found=True; break
if not found: lines.append(key)
with open(env,'w') as f: f.write('\n'.join(lines))
PY
5) Restart the notification-service
(Depending on your deployment; common options below)
If using docker-compose in repo root:
cd ~/Bella-new-start
docker-compose up -d notification-service
docker-compose logs -f notification-service
If using systemd (example service name):
sudo systemctl restart notification-service
sudo journalctl -u notification-service -f --since "1 minute ago"
Check logs for:
"Firebase Cloud Messaging initialized successfully"
"Apple Push Notification service initialized successfully"
Any send errors for tokens
6) Verify device registration & test send
After installing a native build and allowing notifications, the app should POST to:
POST https://<notification-host>:3006/device-tokens
Test send (cURL from your machine or EC2):
curl -X POST "https://<notification-host>:3006/send" -H "Content-Type: application/json" -d '{
"type":"NEW_MESSAGE",
"userId":"USER_ID",
"payload": {
"title":"New message",
"body":"(will be sanitized)",
"data":{"senderName":"Alice","type":"NEW_MESSAGE"}
}
}'
7) Security reminders
Do NOT commit /opt/keys files or .env with secrets to git.
Prefer using AWS Secrets Manager / SSM Parameter Store or EAS secrets for deployments.
If you want, I can now:
generate the exact scp + ssh command lines tailored to your EC2 username/IP and paths, or
produce a single shell script you can run on your machine to copy both files and configure the server (you’ll paste in your EC2 IP, user, and local file paths). Which do you want?
