# Notification Service

Advanced push notification service for Real-time Connect supporting Firebase Cloud Messaging (FCM) and Apple Push Notification service (APNs) with intelligent delivery management.

## Features

### Core Functionality
- **Multi-Platform Support**: FCM for Android, APNs for iOS
- **Batch Processing**: Efficient bulk notification handling
- **Queue Management**: Bull-based queue system with retry logic
- **Delivery Tracking**: Real-time status monitoring and analytics
- **User Preferences**: Granular notification settings per user
- **Template System**: Reusable notification templates
- **Scheduled Notifications**: Time-based notification delivery

### Business Logic
- **Smart Filtering**: Respect user preferences and quiet hours
- **Platform Optimization**: Platform-specific message formatting
- **Retry Mechanisms**: Automatic retry for failed deliveries
- **Token Management**: Device token validation and cleanup
- **Rate Limiting**: Prevent notification spam
- **Analytics**: Comprehensive delivery metrics

## API Endpoints

### Public API
- `POST /api/notifications/send` - Send notification
- `POST /api/notifications/device-tokens` - Register device token
- `GET /api/notifications/:id/status` - Get notification status
- `GET /api/notifications/preferences/:userId` - Get user preferences
- `PUT /api/notifications/preferences/:userId` - Update preferences
- `GET /api/notifications/queue/stats` - Queue statistics

### Internal API
- `POST /internal/send-notification` - Inter-service communication
- `GET /health` - Health check

## Configuration

Set these environment variables:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/notification_db"

# Redis
REDIS_URL="redis://localhost:6379"

# Firebase
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_PRIVATE_KEY="your-private-key"
FIREBASE_CLIENT_EMAIL="your-client-email"

# Apple Push Notifications
APNS_KEY_ID="your-key-id"
APNS_TEAM_ID="your-team-id"
APNS_PRIVATE_KEY="your-private-key"
APNS_BUNDLE_ID="com.yourapp.realtime"

# Service
PORT=5005
NODE_ENV=development
JWT_SECRET="your-jwt-secret"
```

## Installation

```bash
# Install dependencies
npm install

# Setup database
npx prisma generate
npx prisma db push

# Start development server
npm run dev

# Build for production
npm run build
npm start
```

## Queue Processing

The service uses Bull queues for reliable notification processing:

- **High Priority**: Instant delivery for calls and messages
- **Normal Priority**: Standard notifications
- **Low Priority**: Marketing and promotional content
- **Retry Logic**: Exponential backoff for failed deliveries
- **Dead Letter Queue**: Manual review for persistent failures

## Usage Examples

### Send Notification
```typescript
POST /api/notifications/send
{
  "type": "NEW_MATCH",
  "userId": "user123",
  "payload": {
    "title": "New Match!",
    "body": "You have a new match waiting",
    "data": { "matchId": "match456" }
  },
  "priority": "HIGH"
}
```

### Register Device Token
```typescript
POST /api/notifications/device-tokens
{
  "userId": "user123",
  "token": "device-token-here",
  "platform": "iOS",
  "appVersion": "1.0.0",
  "deviceModel": "iPhone 12",
  "osVersion": "15.0"
}
```

### Update Preferences
```typescript
PUT /api/notifications/preferences/user123
{
  "newMatchEnabled": true,
  "newMessageEnabled": true,
  "callStartEnabled": true,
  "marketingEnabled": false,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "08:00"
}
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client Apps   │────│  Notification    │────│   FCM/APNs      │
│   iOS/Android   │    │    Service       │    │   Providers     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                       ┌──────────────────┐
                       │   Bull Queue     │
                       │  (Redis-backed)  │
                       └──────────────────┘
                              │
                       ┌──────────────────┐
                       │   PostgreSQL     │
                       │   Database       │
                       └──────────────────┘
```

## Monitoring

- Queue dashboard available at `/admin/queues`
- Delivery metrics in real-time
- Failed notification alerts
- Device token health monitoring

## Security

- JWT authentication for API access
- Rate limiting on endpoints
- Input validation and sanitization
- Secure credential storage
- Token encryption in database