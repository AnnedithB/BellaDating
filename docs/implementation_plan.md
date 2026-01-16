# Connect Frontend to Reworked Backend

The Frontend (`Belle-transfer-master-fe`) is currently configured with ports that do not match the new Backend (`Bella-new-start`) microservices architecture. Additionally, the user wants to connect to an EC2 instance.

## User Review Required

> [!IMPORTANT]
> **EC2 URL Needed**: I need the public IP address or domain name of your EC2 instance where the backend is running. Please provide this so I can update the configuration.

> [!WARNING]
> **Port Mismatches**: I identified several mismatches between the Frontend config and the Backend `docker-compose.yml`. I will update the Frontend to match the Backend.
> - **Subscription Service**: Frontend (3006) -> Backend (3010) (3006 is now Notification Service)
> - **Interaction Service**: Frontend (3457) -> Backend (3003)

## Proposed Changes

### Configuration Updates

#### [MODIFY] [config.js](file:///Users/zintaen/Downloads/Bella/Belle-transfer-master-fe/src/services/config.js)
- Update default ports to match `Bella-new-start`.
- Ensure all service URLs use the `API_URL` (EC2 Host) as the base, rather than hardcoded localhost, when not in dev mode.

#### [MODIFY] [app.config.js](file:///Users/zintaen/Downloads/Bella/Belle-transfer-master-fe/app.config.js)
-   Add helper functions to get URLs for `communication`, `interaction`, `subscription` services from env vars.
-   Include these URLs in the `extra` object so `config.js` can consume them.
-   Ensure `extra` field correctly passes environment variables for all services.

#### [NEW] [.env](file:///Users/zintaen/Downloads/Bella/Belle-transfer-master-fe/.env)
-   Create a `.env` file to store the EC2 connection details.


## Verification Plan

### Manual Verification
1.  **Configuration Check**: Verify `src/services/config.js` reflects the new ports.
2.  **Connection Test**:
    -   Update `.env` with EC2 IP (provided by user).
    -   Run `npx expo start`.
    -   Check if the app can connect to the backend (e.g., login or fetch data). (Note: I may not be able to fully verify this without the actual EC2 instance running and accessible to me, but I can verify the config is correct).
