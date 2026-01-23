# Subscription Service

A comprehensive subscription management microservice built with Node.js, TypeScript, and Stripe integration.

## Features

### Core Subscription Management
- **Subscription Plans**: Create, update, delete subscription plans with flexible pricing
- **User Subscriptions**: Handle subscription lifecycle (create, upgrade, downgrade, cancel, reactivate)
- **Trial Periods**: Support for free trials with automatic conversion
- **Billing Cycles**: Monthly, yearly, and custom billing periods
- **Promo Codes**: Discount codes with percentage or fixed amount discounts

### Payment Processing
- **Stripe Integration**: Complete payment processing with webhooks
- **Payment Methods**: Secure storage and management of customer payment methods
- **Invoicing**: Automated invoice generation and management
- **Refunds**: Admin-controlled refund processing
- **Failed Payment Handling**: Retry logic and dunning management

### Analytics & Reporting
- **Revenue Analytics**: MRR, ARR, revenue trends, and forecasting
- **Subscription Metrics**: Churn rate, conversion rate, trial analytics
- **Customer Analytics**: CLV, customer segmentation, cohort analysis
- **Plan Performance**: Track which plans are most popular and profitable

### Admin Features
- **User Management**: View and manage all user subscriptions
- **Payment Monitoring**: Track payments, failures, and refunds
- **Promo Code Management**: Create and manage discount codes
- **Analytics Dashboard**: Comprehensive business metrics

## API Endpoints

### Subscription Plans
- `GET /api/subscription-plans` - List all available plans
- `POST /api/subscription-plans` - Create new plan (admin only)
- `PUT /api/subscription-plans/:id` - Update plan (admin only)
- `DELETE /api/subscription-plans/:id` - Delete plan (admin only)

### User Subscriptions
- `POST /api/subscriptions/create` - Create new subscription
- `GET /api/subscriptions/current` - Get user's current subscription
- `POST /api/subscriptions/change-plan` - Upgrade/downgrade plan
- `POST /api/subscriptions/cancel` - Cancel subscription
- `POST /api/subscriptions/reactivate` - Reactivate canceled subscription
- `GET /api/subscriptions/history` - Get subscription history

### Billing & Payments
- `GET /api/billing/invoices` - Get user's invoices
- `GET /api/billing/invoices/:id` - Get specific invoice
- `GET /api/billing/invoices/:id/pdf` - Download invoice PDF
- `GET /api/billing/payments` - Get payment history
- `GET /api/billing/payment-methods` - Get saved payment methods
- `POST /api/billing/payment-methods/setup-intent` - Create setup intent for new payment method
- `POST /api/billing/payment-methods/confirm` - Confirm payment method setup
- `POST /api/billing/promo-codes/apply` - Apply promo code

### Analytics (Admin Only)
- `GET /api/analytics/dashboard` - Overview metrics
- `GET /api/analytics/revenue` - Revenue analytics
- `GET /api/analytics/subscriptions` - Subscription analytics
- `GET /api/analytics/customers` - Customer analytics

### Admin Management
- `GET /api/admin/users` - List all users with subscriptions
- `GET /api/admin/users/:userId/subscription` - Get user subscription details
- `PUT /api/admin/users/:userId/subscription` - Update user subscription
- `POST /api/admin/users/:userId/subscription/cancel` - Cancel user subscription
- `POST /api/admin/users/:userId/subscription/reactivate` - Reactivate subscription
- `POST /api/admin/payments/:paymentId/refund` - Refund payment
- `GET /api/admin/promo-codes` - List promo codes
- `POST /api/admin/promo-codes` - Create promo code

### Webhooks
- `POST /webhooks/stripe` - Stripe webhook handler

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/subscription_db"

# Stripe
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# JWT
JWT_SECRET="your-jwt-secret"

# Server
PORT=3006
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"

# Logging
LOG_LEVEL=info
```

## Database Schema

The service uses PostgreSQL with Prisma ORM. Key models include:

- **SubscriptionPlan**: Plan definitions with pricing and features
- **UserSubscription**: User's active subscriptions
- **Invoice**: Billing invoices with line items
- **Payment**: Payment records with status tracking
- **PaymentMethodInfo**: Stored payment method details
- **PromoCode**: Discount codes and usage tracking
- **SubscriptionAnalytics**: Aggregated metrics

## Installation & Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **Configure Environment**
   - Copy `.env.example` to `.env`
   - Fill in your Stripe keys and database URL

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## Stripe Integration

### Webhook Setup
1. Configure webhook endpoint in Stripe Dashboard: `https://yourdomain.com/webhooks/stripe`
2. Select events:
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated` 
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

### Product & Price Setup
The service automatically creates Stripe products and prices when you create subscription plans through the API.

## Architecture

### Microservice Design
- **Standalone Service**: Runs independently on port 3006
- **Database Isolation**: Dedicated PostgreSQL database
- **API Communication**: RESTful JSON APIs
- **Event Driven**: Stripe webhooks for real-time updates

### Security Features
- **JWT Authentication**: Secure API access
- **Rate Limiting**: Prevent API abuse
- **Input Validation**: Comprehensive request validation
- **Helmet Security**: HTTP security headers
- **CORS Protection**: Configurable cross-origin access

### Monitoring & Logging
- **Winston Logging**: Structured logging with levels
- **Error Tracking**: Comprehensive error handling
- **Performance Metrics**: Built-in analytics
- **Health Checks**: Service health monitoring

## Development

### Scripts
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run test` - Run test suite
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data

### Testing
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test subscription.test.ts
```

## Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3006
CMD ["npm", "start"]
```

### Environment Setup
- Production database with connection pooling
- Redis for session management (if needed)
- Load balancer for multiple instances
- SSL certificates for HTTPS

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/subscription-feature`)
3. Commit changes (`git commit -am 'Add subscription feature'`)
4. Push to branch (`git push origin feature/subscription-feature`)
5. Create Pull Request

## License

MIT License - see LICENSE file for details.