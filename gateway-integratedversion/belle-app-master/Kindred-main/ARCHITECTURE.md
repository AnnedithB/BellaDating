# Real-time Connect - Backend Architecture

## System Overview

Real-time Connect is a microservices-based application that combines the matching paradigm of Bumble with the real-time voice interaction model of Omegle, featuring female-centric safety controls.

## Technology Stack

### Core Technologies
- **Runtime**: Node.js 18+ with TypeScript
- **Database**: PostgreSQL 15+ (primary data store)
- **Cache/Queue**: Redis 7+ (user queuing, session management, caching)
- **Real-time**: Socket.IO (WebSocket communication with fallbacks)
- **Authentication**: JWT (JSON Web Tokens)
- **File Storage**: AWS S3 Compatible (profile images/videos)
- **Containerization**: Docker & Docker Compose

### Libraries & Frameworks
- **Web Framework**: Express.js with TypeScript
- **ORM**: Prisma (database management and migrations)
- **Validation**: Joi (request validation)
- **Logging**: Winston (structured logging)
- **Environment**: dotenv (configuration management)
- **Testing**: Jest (unit and integration tests)

## Architecture Pattern

The system follows a **microservices architecture** with event-driven communication between services. Each service is independently deployable and scalable.

### Service Communication Patterns

1. **Synchronous Communication**: REST APIs for direct service-to-service calls
2. **Asynchronous Communication**: Redis pub/sub for event broadcasting
3. **Real-time Communication**: WebSocket connections via Socket.IO
4. **Data Sharing**: Shared PostgreSQL database with service-specific schemas

## Core Services

### 1. User Service (`user-service`)
**Port**: 3001
**Responsibilities**:
- User registration and authentication
- Profile management (CRUD operations)
- JWT token generation and validation
- Password hashing and security
- File upload handling for profile assets

**Key Endpoints**:
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `PUT /profile`
- `POST /profile/upload`

### 2. Queuing Service (`queuing-service`)
**Port**: 3002
**Responsibilities**:
- User presence management (online/offline/in-call/queuing)
- Intent-based queue management using Redis
- WebSocket connection handling for user status
- Matchmaking coordination

**Key Features**:
- Redis lists for queue management by intent
- Socket.IO rooms for presence broadcasting
- Automatic queue cleanup on disconnect

### 3. Interaction Service (`interaction-service`)
**Port**: 3003
**Responsibilities**:
- Match orchestration between queued users
- WebRTC signaling relay (offer/answer/ICE candidates)
- Timed call management (3-minute default)
- Female-centric connection controls
- Video request workflow

**Key Endpoints**:
- `POST /api/interactions/connect` (female-only)
- `POST /api/interactions/request-video` (female approval required)
- WebSocket events: `found-match`, `call-ended`, `offer`, `answer`, `ice-candidate`

### 4. History Service (`history-service`)
**Port**: 3004
**Responsibilities**:
- Interaction logging and analytics
- Connection relationship management
- User history retrieval
- Privacy-compliant data retention

**Key Endpoints**:
- `GET /api/history/interactions`
- `GET /api/history/connections`
- `POST /api/history/log-interaction`

### 5. Communication Service (`communication-service`)
**Port**: 3005
**Responsibilities**:
- Post-match messaging between connected users
- Chat room management
- Message persistence and history
- Real-time message delivery

**Key Features**:
- Socket.IO namespace `/chat`
- Connection-based room access control
- Message history with pagination

## Database Design Philosophy

### Primary Database: PostgreSQL
- **Single database, multiple schemas** approach for data consistency
- **Service-specific schemas** for logical separation
- **Shared user identity** across all services
- **Foreign key constraints** for data integrity
- **Proper indexing** for performance optimization

### Caching Layer: Redis
- **User presence and status** (TTL-based)
- **Queue management** (Lists and Sets)
- **Session storage** (JWT blacklisting)
- **Real-time event pub/sub**

## Security Considerations

### Authentication & Authorization
- JWT-based stateless authentication
- Role-based access control (user roles: 'male', 'female', 'admin')
- Password hashing using bcrypt (12+ rounds)
- Rate limiting on authentication endpoints

### Data Protection
- Environment-based secret management
- SQL injection prevention via parameterized queries (Prisma)
- Input validation and sanitization
- CORS configuration for allowed origins

### Female-Centric Safety Features
- Connection approval restricted to female users
- Video request approval workflow
- Block/report functionality (future enhancement)
- Privacy-first interaction logging

## Scalability Considerations

### Horizontal Scaling
- **Stateless services** enable easy horizontal scaling
- **Redis clustering** for queue and cache distribution
- **Database read replicas** for read-heavy operations
- **Load balancer** (nginx/HAProxy) for traffic distribution

### Performance Optimization
- **Connection pooling** for database connections
- **Redis caching** for frequently accessed data
- **CDN integration** for static assets (profile images)
- **Database indexing** on foreign keys and lookup fields

### Monitoring & Observability
- **Structured logging** with correlation IDs
- **Health check endpoints** for each service
- **Metrics collection** (response times, queue lengths, active connections)
- **Error tracking** and alerting

## Development Workflow

### Local Development
```bash
# Start all services with Docker Compose
docker-compose up -d

# Individual service development
cd user-service
npm run dev
```

### Environment Management
- `.env.example` files for each service
- Environment-specific configuration
- Secret management via environment variables
- Docker Compose overrides for different environments

### Testing Strategy
- **Unit tests** for business logic
- **Integration tests** for API endpoints
- **E2E tests** for critical user flows
- **Load testing** for real-time features

## Deployment Architecture

### Container Strategy
- **Multi-stage Dockerfiles** for optimized production images
- **Alpine Linux base** images for minimal footprint
- **Non-root user** execution for security
- **Health checks** integrated in containers

### Production Considerations
- **Database migrations** handled via Prisma
- **Blue-green deployment** capability
- **Rolling updates** for zero-downtime deployments
- **Backup and disaster recovery** strategies

## Future Enhancements (Post-MVP)

### Technical Improvements
- **Microservices gateway** (API Gateway pattern)
- **Message queue** (RabbitMQ/Apache Kafka) for better event handling
- **Database sharding** for massive scale
- **WebRTC SFU** for group calls

### Feature Enhancements
- **AI-powered matching** algorithms
- **Advanced safety features** (AI moderation, sentiment analysis)
- **Analytics and insights** dashboard
- **Mobile push notifications**
- **Video call recording** (with consent)

## Getting Started

See individual service README files for detailed setup instructions:
- [User Service Setup](./user-service/README.md)
- [Queuing Service Setup](./queuing-service/README.md)
- [Interaction Service Setup](./interaction-service/README.md)
- [History Service Setup](./history-service/README.md)
- [Communication Service Setup](./communication-service/README.md)