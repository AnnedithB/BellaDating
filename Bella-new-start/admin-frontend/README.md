# Belle Admin Panel

Admin panel frontend for the Belle/Kindred platform.

## Features

- **Dashboard**: Analytics overview with KPIs from Analytics Service
- **User Management**: View and manage users, update status
- **Moderation**: Handle user reports and take moderation actions
- **Support Tickets**: Manage customer support tickets with SLA tracking
- **Knowledge Base**: Create and manage help articles
- **Settings**: System-wide configuration

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (copy from `.env.example`):
```env
VITE_ADMIN_SERVICE_URL=http://localhost:3009
VITE_ANALYTICS_SERVICE_URL=http://localhost:3008
VITE_APP_PORT=5005
```

3. Start development server:
```bash
npm run dev
```

## Default Admin Credentials

- Email: `ogollachucho@gmail.com`
- Password: `123456789`
- Role: `SUPER_ADMIN`

## Backend Services

- **Admin Service**: Port 3009 - User management, moderation, support tickets, knowledge base, settings
- **Analytics Service**: Port 3008 - Analytics KPIs, metrics, and insights

## API Integration

All API calls are handled through `src/services/api.ts` which connects to:
- Admin Service endpoints (authentication, users, moderation, tickets, knowledge base, settings)
- Analytics Service endpoints (KPIs, metrics, analytics)

## Build

```bash
npm run build
```

## Production

The built files will be in the `dist` directory. Serve them with any static file server.
