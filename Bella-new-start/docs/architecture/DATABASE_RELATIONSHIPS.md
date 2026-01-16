# Database Relationships & Data Management in Kindred

This document explains how data is organized, related, and synchronized across microservices in the Kindred application.

---

## Overview

Kindred uses a **microservices architecture** where each service has its **own dedicated database**. This means:

- ❌ **No direct database joins** between services
- ✅ **Each service owns its data domain**
- ✅ **Services communicate via APIs** (REST/GraphQL)
- ✅ **Data is denormalized** where needed for performance

---

## Database Structure

### Service-to-Database Mapping

```
┌─────────────────────────┬──────────────────────┬─────────────────┐
│ Service                 │ Database             │ Port            │
├─────────────────────────┼──────────────────────┼─────────────────┤
│ User Service            │ user_db              │ 3001            │
│ Queuing Service         │ queuing_db           │ 3002            │
│ Interaction Service     │ interaction_db       │ 3003            │
│ History Service         │ history_db           │ 3004            │
│ Communication Service   │ communication_db     │ 3005            │
│ Notification Service    │ notification_db      │ 3006            │
│ Moderation Service      │ moderation_db        │ 3007            │
│ Analytics Service       │ analytics_db         │ 3008            │
│ Admin Service           │ admin_db             │ 3009            │
│ Subscription Service    │ subscription_db      │ 3010            │
└─────────────────────────┴──────────────────────┴─────────────────┘
```

**All databases run on the same PostgreSQL instance** (`kindred-postgres:5432`) but are **logically separated**.

---

## How Data Relationships Work

### 1. **User-Centric Design**

The **User Service** is the source of truth for user data. Other services store only the **userId** (foreign key reference).

**Example: Communication Service**

```prisma
// communication_db schema
model Conversation {
  id            String   @id @default(cuid())
  participant1Id String  // References user_db.User.id
  participant2Id String  // References user_db.User.id
  createdAt     DateTime @default(now())
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  senderId       String   // References user_db.User.id
  content        String
  createdAt      DateTime @default(now())
}
```

**Key Points:**
- ❌ No foreign key constraints across databases
- ✅ Stores only `userId` as a string reference
- ✅ User details fetched via User Service API when needed

---

### 2. **Data Denormalization for Performance**

Some services cache frequently accessed user data to avoid repeated API calls.

**Example: Queuing Service**

```prisma
// queuing_db schema
model QueueEntry {
  id        String   @id @default(cuid())
  userId    String   // Reference to user
  
  // Denormalized user data (cached)
  age       Int
  gender    Gender
  latitude  Float
  longitude Float
  interests String[]
  languages String[]
  
  createdAt DateTime @default(now())
}
```

**Why denormalize?**
- ⚡ **Performance:** Matching algorithm needs user data immediately
- 🔄 **Eventual consistency:** User updates propagate via events
- 📊 **Read-heavy operations:** Matching runs every 5 seconds

---

### 3. **Cross-Service Data Fetching**

When a service needs data from another service, it makes an **API call**.

**Example: Getting User Profile in Chat**

```typescript
// Communication Service needs user details
async function getConversationWithUserDetails(conversationId: string) {
  // 1. Get conversation from communication_db
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId }
  });
  
  // 2. Fetch user details from User Service API
  const user1 = await fetch(`http://user-service:3001/api/users/${conversation.participant1Id}`);
  const user2 = await fetch(`http://user-service:3001/api/users/${conversation.participant2Id}`);
  
  // 3. Combine data
  return {
    ...conversation,
    participant1: user1.data,
    participant2: user2.data
  };
}
```

**GraphQL Gateway** handles this orchestration automatically:

```graphql
type Conversation {
  id: ID!
  participant1: User!  # Fetched from User Service
  participant2: User!  # Fetched from User Service
  messages: [Message!]! # From Communication Service
}
```

---

## Avoiding Duplicate Data

### Strategy 1: **Single Source of Truth**

Each data entity has **one authoritative service**:

```
User Data          → User Service (user_db)
Conversations      → Communication Service (communication_db)
Matches            → Queuing Service (queuing_db)
Notifications      → Notification Service (notification_db)
Subscriptions      → Subscription Service (subscription_db)
```

### Strategy 2: **Reference by ID Only**

Services store only the **ID reference**, not the full object:

```prisma
// ✅ CORRECT: Store only userId
model Notification {
  id     String @id
  userId String  // Just the reference
  title  String
  body   String
}

// ❌ WRONG: Don't duplicate user data
model Notification {
  id       String @id
  userId   String
  userName String  // Duplicate!
  userEmail String // Duplicate!
  title    String
  body     String
}
```

### Strategy 3: **Selective Denormalization**

Only cache data that:
- Changes rarely (age, gender)
- Is needed for performance-critical operations (matching algorithm)
- Can tolerate eventual consistency

---

## Handling Data Changes

### Scenario: User Updates Their Profile

**Problem:** User changes their age from 28 to 29. How do other services know?

### Solution 1: **Event-Driven Updates (Recommended)**

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│ User Service │         │   RabbitMQ   │         │   Queuing    │
│              │         │   (Events)   │         │   Service    │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │ 1. User updates age    │                        │
       │────────────────────────>                        │
       │                        │                        │
       │ 2. Publish event       │                        │
       │────────────────────────>                        │
       │   "user.profile.updated"                        │
       │                        │                        │
       │                        │ 3. Consume event       │
       │                        │───────────────────────>│
       │                        │                        │
       │                        │ 4. Update cached data  │
       │                        │<───────────────────────│
```

**Implementation:**

```typescript
// User Service - Publish event
await rabbitmq.publish('user.profile.updated', {
  userId: 'user123',
  changes: {
    age: 29,
    updatedAt: new Date()
  }
});

// Queuing Service - Subscribe to event
rabbitmq.subscribe('user.profile.updated', async (event) => {
  await prisma.queueEntry.updateMany({
    where: { userId: event.userId },
    data: { age: event.changes.age }
  });
});
```

### Solution 2: **API Polling (Current Implementation)**

Some services fetch fresh data on-demand:

```typescript
// Before processing, get latest user data
const user = await userService.getUser(userId);

// Use fresh data
await processWithLatestData(user);
```

### Solution 3: **Cache Invalidation**

Redis cache is invalidated when data changes:

```typescript
// User Service - Invalidate cache on update
await redis.del(`user:${userId}`);

// Other services - Check cache first
let user = await redis.get(`user:${userId}`);
if (!user) {
  user = await userService.getUser(userId);
  await redis.set(`user:${userId}`, user, 'EX', 300); // 5 min TTL
}
```

---

## Data Consistency & Concurrency

### 1. **Eventual Consistency Model**

Kindred uses **eventual consistency** between services:

```
User updates profile → Event published → Services update (within seconds)
```

**Trade-offs:**
- ✅ **High availability:** Services don't block waiting for updates
- ✅ **Better performance:** No distributed transactions
- ⚠️ **Temporary inconsistency:** Data may be stale for a few seconds

**Example:**
```
Time 0s:  User changes age to 29 in User Service
Time 1s:  Queuing Service still has age 28 (stale)
Time 2s:  Event processed, Queuing Service updates to 29
Time 3s+: All services consistent
```

### 2. **Handling Race Conditions**

**Problem:** Two services try to update the same user simultaneously.

**Solution: Optimistic Locking**

```prisma
model User {
  id        String   @id
  email     String
  version   Int      @default(0)  // Version number
  updatedAt DateTime @updatedAt
}
```

```typescript
// Update with version check
const user = await prisma.user.findUnique({ where: { id } });

const updated = await prisma.user.update({
  where: { 
    id: id,
    version: user.version  // Only update if version matches
  },
  data: {
    email: newEmail,
    version: user.version + 1  // Increment version
  }
});

if (!updated) {
  throw new Error('Concurrent modification detected');
}
```

### 3. **Idempotency**

All API operations are **idempotent** - calling them multiple times has the same effect:

```typescript
// Idempotent: Using upsert instead of create
await prisma.deviceToken.upsert({
  where: { token: deviceToken },
  update: { lastUsedAt: new Date() },
  create: { 
    userId,
    token: deviceToken,
    platform: 'ANDROID'
  }
});
```

### 4. **Transaction Boundaries**

Transactions are **limited to a single database**:

```typescript
// ✅ CORRECT: Transaction within one service
await prisma.$transaction([
  prisma.conversation.create({ data: conversationData }),
  prisma.message.create({ data: messageData })
]);

// ❌ WRONG: Can't have transaction across services
// This is not possible in microservices
await prisma.$transaction([
  userService.updateUser(),      // Different DB
  chatService.createConversation() // Different DB
]);
```

**Alternative: Saga Pattern**

For multi-service operations, use compensating transactions:

```typescript
async function createMatchAndNotify(user1Id, user2Id) {
  let matchId;
  
  try {
    // Step 1: Create match
    matchId = await matchingService.createMatch(user1Id, user2Id);
    
    // Step 2: Send notifications
    await notificationService.sendMatchNotification(user1Id, user2Id);
    
  } catch (error) {
    // Compensate: Rollback match creation
    if (matchId) {
      await matchingService.deleteMatch(matchId);
    }
    throw error;
  }
}
```

---

## Real-World Examples

### Example 1: Creating a Match

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Queuing    │    │     User     │    │ Notification │    │ Communication│
│   Service    │    │   Service    │    │   Service    │    │   Service    │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │                   │
       │ 1. Find match     │                   │                   │
       │ (uses cached data)│                   │                   │
       │                   │                   │                   │
       │ 2. Get fresh user │                   │                   │
       │   profiles        │                   │                   │
       │──────────────────>│                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │ 3. Create match   │                   │                   │
       │   in queuing_db   │                   │                   │
       │                   │                   │                   │
       │ 4. Send notification                  │                   │
       │──────────────────────────────────────>│                   │
       │                                       │                   │
       │ 5. Create conversation                │                   │
       │───────────────────────────────────────────────────────────>│
       │                                       │                   │
```

**Data Flow:**
1. Queuing Service uses cached user data for matching algorithm
2. Fetches fresh user profiles from User Service for verification
3. Creates match record in `queuing_db`
4. Calls Notification Service to notify users
5. Calls Communication Service to create conversation

**Data Stored:**
- `queuing_db`: Match record with user IDs
- `notification_db`: Notification records with user IDs
- `communication_db`: Conversation with participant IDs

### Example 2: Sending a Message

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Communication│    │ Notification │    │     User     │
│   Service    │    │   Service    │    │   Service    │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       │ 1. Create message │                   │
       │   in communication_db                 │
       │                   │                   │
       │ 2. Notify recipient                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ 3. Get user device│
       │                   │   tokens          │
       │                   │──────────────────>│
       │                   │<──────────────────│
       │                   │                   │
       │                   │ 4. Send push      │
       │                   │   notification    │
       │                   │                   │
```

**Data Stored:**
- `communication_db`: Message with senderId and conversationId
- `notification_db`: Notification record with userId
- No user data duplicated - fetched on-demand

---

## Best Practices

### ✅ DO:

1. **Store only IDs** as references to other services
2. **Use events** for data synchronization (RabbitMQ)
3. **Cache strategically** with TTL (Redis)
4. **Fetch fresh data** for critical operations
5. **Design for eventual consistency**
6. **Make operations idempotent**
7. **Use optimistic locking** for concurrent updates

### ❌ DON'T:

1. **Don't duplicate full objects** across services
2. **Don't use foreign key constraints** across databases
3. **Don't expect immediate consistency** across services
4. **Don't use distributed transactions** (2PC)
5. **Don't cache data that changes frequently**
6. **Don't assume data is always fresh**

---

## Monitoring & Debugging

### Checking Data Consistency

```sql
-- Check if user exists in all services
-- user_db
SELECT id, email FROM "User" WHERE id = 'user123';

-- queuing_db
SELECT userId, age, gender FROM "QueueEntry" WHERE userId = 'user123';

-- communication_db
SELECT id, participant1Id, participant2Id FROM "Conversation" 
WHERE participant1Id = 'user123' OR participant2Id = 'user123';

-- notification_db
SELECT userId, type, title FROM "Notification" WHERE userId = 'user123';
```

### Event Monitoring

```bash
# Check RabbitMQ queues
docker exec kindred-rabbitmq rabbitmqctl list_queues

# View event logs
docker logs kindred-user-service | grep "event.published"
docker logs kindred-queuing-service | grep "event.consumed"
```

### Cache Monitoring

```bash
# Check Redis cache
docker exec kindred-redis redis-cli KEYS "user:*"
docker exec kindred-redis redis-cli GET "user:user123"
docker exec kindred-redis redis-cli TTL "user:user123"
```

---

## Summary

**How Kindred Manages Data Across Services:**

1. **Separation:** Each service has its own database
2. **References:** Services store only user IDs, not full user objects
3. **Denormalization:** Performance-critical data is cached with eventual consistency
4. **Events:** RabbitMQ propagates changes between services
5. **API Calls:** Services fetch fresh data when needed via REST/GraphQL
6. **Caching:** Redis reduces API calls with TTL-based invalidation
7. **Consistency:** Eventual consistency model with optimistic locking
8. **Idempotency:** All operations can be safely retried

**Trade-offs:**
- ✅ **Scalability:** Services can scale independently
- ✅ **Resilience:** One service failure doesn't crash others
- ✅ **Flexibility:** Each service can use optimal data model
- ⚠️ **Complexity:** More moving parts to manage
- ⚠️ **Consistency:** Data may be temporarily stale

This architecture is **standard for microservices** and provides the best balance of performance, scalability, and maintainability for a real-time dating/social application like Kindred.
