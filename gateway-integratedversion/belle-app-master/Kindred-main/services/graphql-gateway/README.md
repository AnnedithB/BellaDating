# GraphQL Gateway

The GraphQL Gateway provides a unified API endpoint for the Real-time Connect application, consolidating all microservices into a single GraphQL interface optimized for mobile applications.

## Features

- **Unified API**: Single endpoint for all microservice functionality
- **Authentication**: JWT-based authentication with context passing
- **Data Loaders**: Efficient batching and caching to prevent N+1 queries
- **Type Safety**: Full TypeScript support with generated types
- **Real-time Support**: GraphQL subscriptions for real-time features
- **Mobile Optimized**: Designed for efficient mobile data usage

## Architecture

The gateway acts as a facade over the following microservices:
- User Service (port 3001)
- Queuing Service (port 3002)
- Interaction Service (port 3003)
- Notification Service (port 3004)
- Analytics Service (port 3005)
- Admin Service (port 3006)
- History Service (port 3007)
- Communication Service (port 3008)
- Moderation Service (port 3009)

## API Features

### Core Queries
- `me` - Get current user information
- `users` - Search and list users
- `sessions` - Interaction session management
- `messages` - Chat message history
- `notifications` - User notifications
- `analytics` - Usage analytics (admin only)

### Real-time Features
- Message delivery subscriptions
- Queue status updates
- Match notifications
- Connection request alerts

### Security
- JWT authentication
- Rate limiting
- Content moderation integration
- User safety features

## Development

### Prerequisites
- Node.js 18+
- TypeScript
- Access to all microservices

### Installation
```bash
npm install
```

### Configuration
Create `.env` file:
```env
PORT=4000
NODE_ENV=development
JWT_SECRET=your-jwt-secret
REDIS_HOST=localhost
REDIS_PORT=6379

# Microservice URLs
USER_SERVICE_URL=http://localhost:3001
QUEUING_SERVICE_URL=http://localhost:3002
INTERACTION_SERVICE_URL=http://localhost:3003
NOTIFICATION_SERVICE_URL=http://localhost:3004
ANALYTICS_SERVICE_URL=http://localhost:3005
ADMIN_SERVICE_URL=http://localhost:3006
HISTORY_SERVICE_URL=http://localhost:3007
COMMUNICATION_SERVICE_URL=http://localhost:3008
MODERATION_SERVICE_URL=http://localhost:3009

# CORS
CORS_ORIGIN=http://localhost:3000
```

### Running
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### Testing
Access GraphQL Playground at: http://localhost:4000/

Example query:
```graphql
query GetMe {
  me {
    id
    username
    email
    isOnline
    createdAt
  }
}
```

## Data Flow

1. **Authentication**: JWT tokens extracted from requests
2. **Context Creation**: User context and data loaders initialized
3. **Service Communication**: REST API calls to microservices
4. **Data Loading**: Efficient batching via DataLoader
5. **Response**: Unified GraphQL response

## Performance Optimizations

- **DataLoader**: Batches and caches database queries
- **Connection Pooling**: Efficient HTTP connections to services
- **Schema Stitching**: Combines schemas from multiple services
- **Query Complexity**: Limits to prevent expensive operations
- **Rate Limiting**: Protects against abuse

## Monitoring

- Health check endpoint: `/health`
- Request logging with operation names
- Error tracking and reporting
- Performance metrics collection

## Deployment

### Docker
```bash
docker build -t graphql-gateway .
docker run -p 4000:4000 graphql-gateway
```

### Environment Variables
All microservice URLs must be configured for production deployment.

## Schema

The gateway provides a comprehensive GraphQL schema including:

- **User Management**: Profiles, preferences, safety settings
- **Matching System**: Queue management, preferences, algorithms
- **Communication**: Real-time messaging, voice notes, media
- **Safety**: Reporting, blocking, moderation integration
- **Analytics**: Usage tracking, engagement metrics
- **Administration**: User management, content moderation

## Error Handling

- Authentication errors return `UNAUTHENTICATED`
- Authorization errors return `FORBIDDEN`
- Service unavailable returns `SERVICE_UNAVAILABLE`
- Invalid input returns `BAD_USER_INPUT`

## Security Considerations

- All mutations require authentication
- User data is scoped to authenticated user
- Admin operations require elevated permissions
- Content goes through moderation pipeline
- Rate limiting prevents abuse

## Future Enhancements

- Federation with Apollo Gateway
- Real-time subscriptions via WebSocket
- Advanced caching strategies
- Query complexity analysis
- Schema versioning support