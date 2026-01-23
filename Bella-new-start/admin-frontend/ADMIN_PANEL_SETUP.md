# Admin Panel Setup & Integration Guide

## Overview

The admin panel has been successfully integrated with your backend services:
- **Admin Service** (Port 3009): User management, moderation, support tickets, knowledge base, settings
- **Analytics Service** (Port 3008): Analytics KPIs and metrics

## What Was Done

### 1. ✅ Moved Admin Panel
- Copied `belle-admin-panel` to `Bella-new-start/admin-frontend`

### 2. ✅ Created API Service Layer
- Created `src/services/api.ts` with complete API integration for:
  - Authentication (JWT-based)
  - Users API
  - Moderation API
  - Support Tickets API
  - Knowledge Base API
  - Settings API
  - Analytics API (both Admin Service and Analytics Service)

### 3. ✅ Updated Authentication
- Modified `LoginForm.tsx` to use real API authentication
- Removed social auth (not needed)
- Added error handling and loading states
- Default credentials: `ogollachucho@gmail.com` / `123456789`

### 4. ✅ Created New Pages

#### Moderation/Reports (`/moderation/reports`)
- View all user reports
- Assign reports to admins
- Take moderation actions (BAN, SUSPEND, WARN, DELETE, APPROVE, REJECT)
- Filter by status and priority

#### Support Tickets (`/support/tickets`)
- View all support tickets
- Filter by status (Open, In Progress, Resolved)
- View ticket details and comments
- Add comments (internal/external)
- Assign tickets to self
- Resolve tickets
- View metrics (open tickets, avg response time, avg resolution time)

#### Knowledge Base (`/knowledge-base`)
- List all articles
- Create new articles
- Edit existing articles
- Publish/unpublish articles
- Delete articles
- View article stats (views, votes)

#### Settings (`/settings`)
- View all system settings
- Edit setting values (JSON format)
- Save individual settings

### 5. ✅ Updated Existing Pages

#### Dashboard/Analytics
- Now fetches real data from Analytics Service
- Displays KPIs: DAU, new registrations, matches, messages
- Shows revenue metrics (30-day total, ARPU)
- Shows user retention (Day 7, Day 30)
- Shows moderation and support stats

#### User List
- Now fetches real users from Admin Service
- Search functionality
- Filter by status (ACTIVE, INACTIVE, SUSPENDED, BANNED)
- Update user status (Activate/Suspend)
- Server-side pagination

### 6. ✅ Updated Navigation
- Updated `sitemap.ts` with new menu items
- Removed unnecessary items (Starter, Multi-level menus)
- Added: Dashboard, Users, Moderation, Support Tickets, Knowledge Base, Settings, Account

### 7. ✅ Updated Routes
- Added routes for all new pages
- Removed unused routes (Starter)

## Setup Instructions

### 1. Install Dependencies
```bash
cd Bella-new-start/admin-frontend
npm install
```

### 2. Configure Environment
Create `.env` file:
```env
VITE_ADMIN_SERVICE_URL=http://localhost:3009
VITE_ANALYTICS_SERVICE_URL=http://localhost:3008
VITE_APP_PORT=5005
```

### 3. Start Development Server
```bash
npm run dev
```

The admin panel will be available at `http://localhost:5005`

### 4. Login
Use the default admin credentials:
- Email: `ogollachucho@gmail.com`
- Password: `123456789`

## Backend Requirements

Make sure these services are running:
1. **Admin Service** on port 3009
2. **Analytics Service** on port 3008
3. **PostgreSQL** databases (admin_db, analytics_db, users_db)
4. **Redis** (if used for caching)

## Features by Page

### Dashboard
- Real-time analytics from Analytics Service
- KPI cards with metrics
- Revenue and retention data
- Moderation and support overview

### Users
- List all users with pagination
- Search by email
- Filter by status
- Update user status (Activate/Suspend)

### Moderation/Reports
- View all user reports
- Assign reports to admins
- Take actions: BAN, SUSPEND, WARN, DELETE, APPROVE, REJECT
- Set severity levels

### Support Tickets
- View all tickets with filters
- View ticket details and conversation
- Add comments (internal/external)
- Assign tickets
- Resolve tickets
- View performance metrics

### Knowledge Base
- Create/edit articles
- Publish/unpublish
- View article statistics
- Manage categories and tags

### Settings
- View all system settings
- Edit setting values (JSON format)
- Save changes

## API Endpoints Used

### Admin Service (Port 3009)
- `POST /api/auth/login` - Admin login
- `GET /api/users` - List users
- `PATCH /api/users/:id/status` - Update user status
- `GET /api/moderation/reports` - Get reports
- `PATCH /api/moderation/reports/:id/assign` - Assign report
- `PUT /api/moderation/reports/:id/action` - Take action
- `GET /api/support-tickets` - Get tickets
- `GET /api/support-tickets/:id` - Get ticket details
- `POST /api/support-tickets/:id/comments` - Add comment
- `PUT /api/support-tickets/:id/resolve` - Resolve ticket
- `GET /api/support-tickets/metrics/dashboard` - Get ticket metrics
- `GET /api/knowledge-base/articles` - Get articles
- `POST /api/knowledge-base/articles` - Create article
- `PUT /api/knowledge-base/articles/:id` - Update article
- `DELETE /api/knowledge-base/articles/:id` - Delete article
- `PATCH /api/knowledge-base/articles/:id/publish` - Publish/unpublish
- `GET /api/settings` - Get settings
- `PUT /api/settings/:key` - Update setting
- `GET /api/analytics/dashboard` - Get admin dashboard analytics

### Analytics Service (Port 3008)
- `GET /kpis/overview` - Get overview metrics
- `GET /kpis/active-users` - Get active user metrics
- `GET /kpis/retention` - Get retention data
- `GET /kpis/revenue` - Get revenue metrics
- `GET /kpis/user-behavior` - Get user behavior
- `GET /kpis/funnel` - Get conversion funnel

## Next Steps

1. **Test the integration**: Start both backend services and the admin panel
2. **Customize styling**: Adjust colors, fonts, and layout as needed
3. **Add more features**: 
   - Export functionality for reports/tickets
   - Real-time updates (WebSockets)
   - Advanced filtering
   - Charts and graphs for analytics
4. **Production deployment**: Build and deploy the admin panel

## Troubleshooting

### CORS Issues
If you see CORS errors, make sure the backend services have the frontend URL in their CORS configuration:
- Admin Service: `CORS_ORIGIN=http://localhost:5005`
- Analytics Service: `FRONTEND_URL=http://localhost:5005`

### Authentication Issues
- Check that the Admin Service is running on port 3009
- Verify the default admin account exists in the database
- Check browser console for API errors

### Data Not Loading
- Verify backend services are running
- Check network tab in browser DevTools
- Verify API URLs in `.env` file
- Check backend service logs

## File Structure

```
admin-frontend/
├── src/
│   ├── services/
│   │   └── api.ts              # API service layer
│   ├── pages/
│   │   ├── dashboard/
│   │   │   └── Analytics.tsx   # Dashboard with real analytics
│   │   ├── users/
│   │   │   └── UserList.tsx    # User management
│   │   ├── moderation/
│   │   │   └── Reports.tsx     # Moderation reports
│   │   ├── support/
│   │   │   └── Tickets.tsx    # Support tickets
│   │   ├── knowledge-base/
│   │   │   └── Articles.tsx   # Knowledge base
│   │   └── settings/
│   │       └── Settings.tsx   # System settings
│   └── routes/
│       ├── paths.ts           # Route paths
│       ├── router.tsx         # Route configuration
│       └── sitemap.ts         # Navigation menu
└── .env.example               # Environment variables template
```
