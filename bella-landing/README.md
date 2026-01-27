# Bella Landing Page

A modern landing page and billing management frontend built with React, TypeScript, and Material-UI.

## Features

- **Landing Page**: Beautiful landing page with call-to-action
- **Subscription Management**: View and manage your current subscription (at `/billing`)
- **Plan Selection**: Browse and compare available subscription plans
- **Invoice History**: View and download past invoices
- **Payment Methods**: Manage payment methods and billing details
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Tech Stack

- **React 19** - UI library
- **TypeScript** - Type safety
- **Material-UI (MUI) v7** - Component library
- **Vite** - Build tool and dev server
- **React Router** - Routing
- **Day.js** - Date formatting
- **Iconify** - Icon library

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm

### Installation

1. Install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

2. Start the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

The app will be available at `http://localhost:5006` (or the port specified in your environment).

### Building for Production

```bash
npm run build
# or
yarn build
# or
pnpm build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
# or
yarn preview
# or
pnpm preview
```

## Project Structure

```
bella-landing/
├── src/
│   ├── components/       # Reusable components
│   ├── lib/             # Utility functions
│   ├── pages/           # Page components
│   │   ├── Landing.tsx  # Landing page
│   │   └── Billing.tsx  # Billing page
│   ├── routes/          # Routing configuration
│   ├── theme/           # Theme configuration
│   │   ├── palette/     # Color palette
│   │   ├── theme.ts     # Main theme
│   │   └── typography.ts
│   └── types/           # TypeScript type definitions
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Subscription Service URL
# For local development: http://localhost:3006
# For production: http://51.20.160.210:3010 (or your EC2 IP/domain)
VITE_SUBSCRIPTION_SERVICE_URL=http://51.20.160.210:3010

# App Configuration
VITE_APP_PORT=5006
VITE_BASENAME=/
```

**Note:** The subscription service runs on port `3006` locally but `3010` in production (Docker).

## Integration with Backend

The billing page is integrated with the subscription service backend. Key features:

### Authentication

- **Public Access**: Subscription plans can be viewed without authentication
- **Authenticated Access**: Subscriptions, invoices, and payment methods require authentication
- **Token Handling**: The page supports authentication tokens via:
  - URL parameters (`?token=...` or `?access_token=...`) - for redirects from the mobile app
  - localStorage/sessionStorage - for persistent sessions

### API Endpoints

The page connects to your subscription service at the URL specified in `VITE_SUBSCRIPTION_SERVICE_URL`:

- `GET /api/subscription-plans` - Get all plans (public)
- `GET /api/subscriptions/current` - Get current subscription (requires auth)
- `GET /api/billing/invoices` - Get invoices (requires auth)
- `GET /api/billing/payment-methods` - Get payment methods (requires auth)

### Redirecting from Mobile App

When redirecting users from your mobile app, you can pass the auth token in the URL:

```
https://your-landing-page.com/billing?token=USER_AUTH_TOKEN
```

The billing page will automatically extract and store the token.

## Customization

### Theme

The theme can be customized in `src/theme/`:

- `palette/colors.ts` - Color definitions
- `palette/index.ts` - Palette configuration
- `theme.ts` - Main theme object
- `typography.ts` - Typography settings

### Routes

- `/` - Landing page
- `/billing` - Billing and subscription management page

### Adding New Pages

1. Create a new component in `src/pages/`
2. Add a route in `src/routes/router.tsx`
3. Update navigation if needed

## License

This project is part of the Bella application suite.
