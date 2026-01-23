# GraphQL Gateway - Complete Guide

## Overview

The GraphQL Gateway is the **unified API entry point** for the entire Kindred platform. It acts as an API Gateway that federates all microservices into a single GraphQL endpoint, providing a consistent and efficient way for clients (web, mobile) to interact with the backend.

## Why GraphQL Gateway?

### Problems It Solves

**1. Multiple REST Endpoints**
- Without Gateway: Clients need to know 8+ different service URLs
- With Gateway: Single endpoint at `http://localhost:4000/graphql`

**2. Over-fetching & Under-fetching**
- REST: Get entire user object even if you only need username
- GraphQL: Request exactly what you need

**3. Multiple Network Requests**
- REST: Need user + profile + subscription? 3 separate requests
- GraphQL: Single query gets all related data

**4. API Versioning Complexity**
- REST: `/api/v1/users`, `/api/v2/users` - version hell
- GraphQL: Schema evolution without breaking changes

**5. Mobile Data Efficiency**
- REST: Large payloads waste mobile data
- GraphQL: Minimal data transfer, only requested fields

### Benefits for Kindred Platform

1. **Unified API Surface**: One endpoint for all operations
2. **Efficient Data Loading**: Reduce network requests by 70%+
3. **Type Safety**: Strong typing across frontend and backend
4. **Real-time Subscriptions**: WebSocket support for live updates
5. **Developer Experience**: Self-documenting API with GraphQL Playground
6. **Mobile Optimization**: Reduce data usage significantly
7. **Flexible Queries**: Clients control data shape and depth

---

## Architecture

### Service Federation

```
┌─────────────────────────────────────────────────┐
│           GraphQL Gateway (Port 4000)           │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │     GraphQL Schema (Federated)           │  │
│  │  - User Types                            │  │
│  │  - Match Types                           │  │
│  │  - Message Types                         │  │
│  │  - Subscription Types                    │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ User Service │ │   Queuing    │ │ Interaction  │
│   (3001)     │ │   Service    │ │   Service    │
│              │ │   (3002)     │ │   (3003)     │
└──────────────┘ └──────────────┘ └──────────────┘
        │             │             │
        ▼             ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   History    │ │Communication │ │ Notification │
│   Service    │ │   Service    │ │   Service    │
│   (3004)     │ │   (3005)     │ │   (3006)     │
└──────────────┘ └──────────────┘ └──────────────┘
        │             │             │
        ▼             ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Moderation  │ │ Subscription │ │   Analytics  │
│   Service    │ │   Service    │ │   Service    │
│   (3007)     │ │   (3010)     │ │   (3008)     │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Request Flow

1. **Client** sends GraphQL query to gateway
2. **Gateway** parses and validates query
3. **Gateway** determines which services are needed
4. **Gateway** makes parallel requests to services
5. **Services** return data
6. **Gateway** combines and shapes response
7. **Client** receives exactly requested data

---

## Getting Started

### Access the Gateway

**GraphQL Endpoint:**
```
http://localhost:4000/graphql
```

**Health Check:**
```
http://localhost:4000/health
```

**Apollo Health Check:**
```
http://localhost:4000/.well-known/apollo/server-health
```

### GraphQL Playground

Open your browser and navigate to:
```
http://localhost:4000/graphql
```

You'll see an interactive GraphQL IDE where you can:
- Explore the schema
- Write and test queries
- View documentation
- See query history

---

## GraphQL Basics

### Query Structure

```graphql
query {
  fieldName {
    subField1
    subField2
  }
}
```

### Mutations (Write Operations)

```graphql
mutation {
  createUser(input: { email: "test@example.com" }) {
    id
    email
  }
}
```

### Subscriptions (Real-time)

```graphql
subscription {
  messageReceived {
    id
    content
    sender {
      username
    }
  }
}
```

---

## Example Queries

### 1. Get Current User Profile

```graphql
query GetMyProfile {
  me {
    id
    email
    username
    profile {
      bio
      age
      interests
      profilePicture
    }
    subscription {
      tier
      features
      expiresAt
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "me": {
      "id": "clx123abc",
      "email": "user@example.com",
      "username": "john_doe",
      "profile": {
        "bio": "Love hiking and music",
        "age": 28,
        "interests": ["hiking", "music", "travel"],
        "profilePicture": "https://..."
      },
      "subscription": {
        "tier": "premium",
        "features": ["unlimited_swipes", "video_calls"],
        "expiresAt": "2026-01-15T00:00:00Z"
      }
    }
  }
}
```

### 2. Find Matches with Filters

```graphql
query FindMatches {
  findMatches(
    filters: {
      ageRange: { min: 25, max: 35 }
      interests: ["music", "travel"]
      distance: 50
    }
    limit: 10
  ) {
    id
    username
    profile {
      age
      bio
      profilePicture
      interests
    }
    compatibility {
      score
      commonInterests
    }
  }
}
```

### 3. Get Conversation History

```graphql
query GetConversation($roomId: ID!) {
  conversation(roomId: $roomId) {
    id
    participants {
      id
      username
      profilePicture
      isOnline
    }
    messages(limit: 50) {
      id
      content
      messageType
      sender {
        id
        username
      }
      timestamp
      isRead
    }
    analytics {
      totalMessages
      avgResponseTime
    }
  }
}
```

**Variables:**
```json
{
  "roomId": "room123abc"
}
```

### 4. Complex Nested Query

```graphql
query Dashboard {
  me {
    id
    username
    stats {
      totalMatches
      activeConversations
      profileViews
    }
    recentMatches(limit: 5) {
      id
      username
      matchedAt
      profile {
        profilePicture
        age
      }
    }
    activeConversations {
      id
      lastMessage {
        content
        timestamp
      }
      unreadCount
      participant {
        username
        isOnline
      }
    }
    notifications(unreadOnly: true) {
      id
      type
      message
      createdAt
    }
  }
}
```

---

## Example Mutations

### 1. Update User Profile

```graphql
mutation UpdateProfile($input: UpdateProfileInput!) {
  updateProfile(input: $input) {
    id
    profile {
      bio
      interests
      profilePicture
    }
  }
}
```

**Variables:**
```json
{
  "input": {
    "bio": "Updated bio text",
    "interests": ["music", "sports", "travel"],
    "profilePicture": "https://new-image-url.com/pic.jpg"
  }
}
```

### 2. Send Message

```graphql
mutation SendMessage($input: SendMessageInput!) {
  sendMessage(input: $input) {
    id
    content
    timestamp
    deliveryStatus
  }
}
```

**Variables:**
```json
{
  "input": {
    "roomId": "room123",
    "content": "Hello! How are you?",
    "messageType": "TEXT"
  }
}
```

### 3. Create Match Action

```graphql
mutation SwipeUser($input: SwipeInput!) {
  swipe(input: $input) {
    action
    isMatch
    match {
      id
      matchedUser {
        username
        profilePicture
      }
      matchedAt
    }
  }
}
```

**Variables:**
```json
{
  "input": {
    "targetUserId": "user456",
    "action": "LIKE"
  }
}
```

---

## Real-time Subscriptions

### 1. Subscribe to New Messages

```graphql
subscription OnNewMessage($roomId: ID!) {
  messageReceived(roomId: $roomId) {
    id
    content
    messageType
    sender {
      id
      username
      profilePicture
    }
    timestamp
  }
}
```

### 2. Subscribe to Match Notifications

```graphql
subscription OnNewMatch {
  matchCreated {
    id
    matchedUser {
      id
      username
      profilePicture
    }
    matchedAt
    message
  }
}
```

### 3. Subscribe to User Online Status

```graphql
subscription OnUserStatusChange($userId: ID!) {
  userStatusChanged(userId: $userId) {
    userId
    isOnline
    lastSeen
  }
}
```

---

## Authentication

### Using JWT Token

All authenticated requests require a JWT token in the Authorization header:

```http
POST /graphql
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "query": "query { me { id username } }"
}
```

### In GraphQL Playground

Add to HTTP Headers section:
```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
}
```

### Getting a Token

First, login via REST endpoint:
```http
POST http://localhost:3001/api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

Response includes token:
```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
}
```

---

## Advanced Features

### 1. Field Aliases

Request same field multiple times with different arguments:

```graphql
query {
  recentMatches: matches(limit: 5, sortBy: RECENT) {
    id
    username
  }
  topMatches: matches(limit: 5, sortBy: COMPATIBILITY) {
    id
    username
  }
}
```

### 2. Fragments (Reusable Fields)

```graphql
fragment UserBasicInfo on User {
  id
  username
  profilePicture
  isOnline
}

query {
  me {
    ...UserBasicInfo
    email
  }
  matches {
    ...UserBasicInfo
    compatibility {
      score
    }
  }
}
```

### 3. Inline Fragments (Type Conditions)

```graphql
query {
  notifications {
    id
    type
    ... on MatchNotification {
      matchedUser {
        username
      }
    }
    ... on MessageNotification {
      message {
        content
      }
    }
  }
}
```

### 4. Directives

**@include** - Conditionally include field:
```graphql
query GetUser($withProfile: Boolean!) {
  me {
    id
    username
    profile @include(if: $withProfile) {
      bio
      interests
    }
  }
}
```

**@skip** - Conditionally skip field:
```graphql
query GetUser($skipEmail: Boolean!) {
  me {
    id
    username
    email @skip(if: $skipEmail)
  }
}
```

---

## Performance Optimization

### 1. DataLoader (Batching)

Gateway uses DataLoader to batch requests:

**Without DataLoader:**
```
Get user 1 -> DB query
Get user 2 -> DB query
Get user 3 -> DB query
Total: 3 queries
```

**With DataLoader:**
```
Get users [1, 2, 3] -> Single batched DB query
Total: 1 query
```

### 2. Query Complexity Limits

Gateway enforces query complexity to prevent abuse:

```graphql
# This query is too complex (depth > 5)
query TooDeep {
  me {
    matches {
      conversations {
        messages {
          sender {
            matches {  # Too deep!
              ...
            }
          }
        }
      }
    }
  }
}
```

### 3. Pagination

Use cursor-based pagination for large datasets:

```graphql
query GetMessages($after: String, $limit: Int) {
  messages(after: $after, limit: $limit) {
    edges {
      node {
        id
        content
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

---

## Error Handling

### GraphQL Error Format

```json
{
  "errors": [
    {
      "message": "User not found",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["user"],
      "extensions": {
        "code": "NOT_FOUND",
        "userId": "invalid123"
      }
    }
  ],
  "data": null
}
```

### Common Error Codes

- `UNAUTHENTICATED` - No valid token provided
- `FORBIDDEN` - User doesn't have permission
- `NOT_FOUND` - Resource doesn't exist
- `BAD_USER_INPUT` - Invalid input data
- `INTERNAL_SERVER_ERROR` - Server error

### Partial Errors

GraphQL can return partial data with errors:

```json
{
  "data": {
    "me": {
      "id": "user123",
      "username": "john_doe",
      "subscription": null
    }
  },
  "errors": [
    {
      "message": "Subscription service unavailable",
      "path": ["me", "subscription"]
    }
  ]
}
```

---

## Client Integration

### JavaScript/TypeScript (Apollo Client)

```typescript
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

const client = new ApolloClient({
  uri: 'http://localhost:4000/graphql',
  cache: new InMemoryCache(),
  headers: {
    authorization: `Bearer ${token}`
  }
});

// Query
const { data } = await client.query({
  query: gql`
    query GetProfile {
      me {
        id
        username
        profile {
          bio
        }
      }
    }
  `
});

// Mutation
const { data } = await client.mutate({
  mutation: gql`
    mutation UpdateBio($bio: String!) {
      updateProfile(input: { bio: $bio }) {
        id
        profile {
          bio
        }
      }
    }
  `,
  variables: { bio: "New bio" }
});

// Subscription
client.subscribe({
  query: gql`
    subscription OnMessage {
      messageReceived {
        id
        content
      }
    }
  `
}).subscribe({
  next: ({ data }) => console.log('New message:', data),
  error: (err) => console.error('Error:', err)
});
```

### React Hooks

```typescript
import { useQuery, useMutation, useSubscription } from '@apollo/client';

function ProfileComponent() {
  // Query
  const { data, loading, error } = useQuery(GET_PROFILE);
  
  // Mutation
  const [updateProfile] = useMutation(UPDATE_PROFILE);
  
  // Subscription
  useSubscription(ON_NEW_MESSAGE, {
    onData: ({ data }) => {
      console.log('New message:', data);
    }
  });
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return <div>{data.me.username}</div>;
}
```

### Mobile (React Native)

```typescript
import { ApolloClient, InMemoryCache } from '@apollo/client';
import { WebSocketLink } from '@apollo/client/link/ws';

const wsLink = new WebSocketLink({
  uri: 'ws://localhost:4000/graphql',
  options: {
    reconnect: true,
    connectionParams: {
      authorization: `Bearer ${token}`
    }
  }
});

const client = new ApolloClient({
  link: wsLink,
  cache: new InMemoryCache()
});
```

---

## Testing

### Using cURL

```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "query { me { id username } }"
  }'
```

### Using Postman

1. Create new POST request to `http://localhost:4000/graphql`
2. Set Headers:
   - `Content-Type: application/json`
   - `Authorization: Bearer YOUR_TOKEN`
3. Body (raw JSON):
```json
{
  "query": "query { me { id username } }",
  "variables": {}
}
```

---

## Best Practices

### 1. Request Only What You Need

❌ **Bad:**
```graphql
query {
  users {
    id
    email
    username
    profile {
      bio
      age
      interests
      location
      # ... 20 more fields
    }
  }
}
```

✅ **Good:**
```graphql
query {
  users {
    id
    username
    profile {
      profilePicture
    }
  }
}
```

### 2. Use Fragments for Reusability

✅ **Good:**
```graphql
fragment UserCard on User {
  id
  username
  profilePicture
  isOnline
}

query {
  matches { ...UserCard }
  recentViews { ...UserCard }
}
```

### 3. Name Your Queries

❌ **Bad:**
```graphql
query {
  me { id }
}
```

✅ **Good:**
```graphql
query GetCurrentUser {
  me { id }
}
```

### 4. Use Variables for Dynamic Values

❌ **Bad:**
```graphql
query {
  user(id: "user123") { username }
}
```

✅ **Good:**
```graphql
query GetUser($userId: ID!) {
  user(id: $userId) { username }
}
```

### 5. Handle Loading and Error States

```typescript
const { data, loading, error } = useQuery(GET_PROFILE);

if (loading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;
if (!data) return <EmptyState />;

return <Profile data={data.me} />;
```

---

## Monitoring & Debugging

### Enable Debug Mode

Set environment variable:
```bash
DEBUG=graphql:*
```

### Query Logging

Gateway logs all queries in development:
```
[GraphQL] Query: GetProfile
[GraphQL] Variables: { userId: "123" }
[GraphQL] Duration: 45ms
[GraphQL] Services Called: user-service, subscription-service
```

### Performance Tracing

Add `X-Apollo-Tracing` header to get performance metrics:

```http
POST /graphql
X-Apollo-Tracing: 1
```

Response includes tracing data:
```json
{
  "data": { ... },
  "extensions": {
    "tracing": {
      "version": 1,
      "startTime": "2025-12-13T20:00:00.000Z",
      "endTime": "2025-12-13T20:00:00.045Z",
      "duration": 45000000,
      "execution": {
        "resolvers": [
          {
            "path": ["me"],
            "parentType": "Query",
            "fieldName": "me",
            "returnType": "User",
            "startOffset": 1000000,
            "duration": 15000000
          }
        ]
      }
    }
  }
}
```

---

## Troubleshooting

### Issue: "Unauthorized" Error

**Solution:** Ensure JWT token is valid and included in headers:
```json
{
  "Authorization": "Bearer YOUR_VALID_TOKEN"
}
```

### Issue: Query Timeout

**Solution:** Reduce query complexity or add pagination:
```graphql
query {
  messages(limit: 20) {  # Add limit
    id
    content
  }
}
```

### Issue: "Field not found" Error

**Solution:** Check schema documentation in GraphQL Playground. Field might be named differently or require different parent type.

### Issue: Subscription Not Working

**Solution:** Ensure WebSocket connection is established:
```typescript
const wsLink = new WebSocketLink({
  uri: 'ws://localhost:4000/graphql',  // Use ws:// not http://
  options: { reconnect: true }
});
```

---

## Future Enhancements

### Planned Features

1. **Schema Stitching** - Combine multiple GraphQL schemas
2. **Persisted Queries** - Reduce bandwidth with query IDs
3. **Automatic Persisted Queries (APQ)** - Client-side query caching
4. **Federation v2** - Advanced schema composition
5. **Rate Limiting** - Per-user query limits
6. **Cost Analysis** - Query cost calculation
7. **Caching Layer** - Redis-based response caching
8. **GraphQL Subscriptions over SSE** - Alternative to WebSockets

---

## Resources

### Documentation
- GraphQL Official: https://graphql.org/
- Apollo Server: https://www.apollographql.com/docs/apollo-server/
- Apollo Client: https://www.apollographql.com/docs/react/

### Tools
- GraphQL Playground: Interactive IDE
- GraphiQL: Alternative IDE
- Apollo Studio: Production monitoring
- GraphQL Code Generator: Generate TypeScript types

### Learning
- How to GraphQL: https://www.howtographql.com/
- GraphQL Best Practices: https://graphql.org/learn/best-practices/
- Apollo Blog: https://www.apollographql.com/blog/

---

## Summary

The GraphQL Gateway is the **heart of the Kindred API architecture**. It provides:

✅ **Single endpoint** for all client requests  
✅ **Efficient data fetching** with no over/under-fetching  
✅ **Type-safe** API with strong schema  
✅ **Real-time** capabilities via subscriptions  
✅ **Mobile-optimized** with minimal data transfer  
✅ **Developer-friendly** with self-documentation  
✅ **Scalable** architecture for future growth  

Start exploring at: **http://localhost:4000/graphql**
