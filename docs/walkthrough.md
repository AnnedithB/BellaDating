# Frontend-Backend Connection Walkthrough

I have successfully updated the Frontend configuration to align with the new Backend microservices architecture and prepared it for connection to your EC2 instance.

## Changes Made

### 1. Configuration Updates
-   **`app.config.js`**: Updated to read all service URLs from environment variables and expose them via `extra`.
-   **`src/services/config.js`**: Updated default ports to match the Backend `docker-compose.yml`.
    -   Notification Service: `3006`
    -   Interaction Service: `3003`
    -   Subscription Service: `3010`

### 2. Environment Setup
-   **`.env`**: Created/Updated this file in `Belle-transfer-master-fe/` with placeholders for your EC2 connection.

## Next Steps (Action Required)

> [!IMPORTANT]
> **Update .env**: You must open `Belle-transfer-master-fe/.env` and replace `YOUR_EC2_IP_OR_DOMAIN` with the actual Public IP or Domain of your EC2 instance.

```bash
# Example .env change
API_URL=http://54.123.45.67:4000
USER_SERVICE_URL=http://54.123.45.67:3001
...
```

Once you have updated the `.env` file, restart your Expo server:
```bash
npx expo start --clear
```
