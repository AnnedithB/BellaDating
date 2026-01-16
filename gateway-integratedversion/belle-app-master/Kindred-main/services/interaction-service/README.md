# Interaction Service

## Overview
The Interaction Service handles real-time WebRTC signaling for both voice and video calls, implementing a female-centric control system for video features.

## Features

### Core Functionality
- **WebRTC Signaling**: Complete offer/answer/ICE candidate flow
- **Voice Calls**: High-quality audio communication
- **Video Calls**: HD video streaming with user controls
- **Real-time Events**: Socket.IO based event system
- **Call Management**: Room creation, participant management, and call lifecycle

### Video Call Features (Phase 2)
- **Female-Centric Control**: Only female participants can accept/reject video requests
- **Video Request Flow**: Any user can request video, female user controls activation
- **Dynamic Video Toggle**: Enable video mid-call with proper permissions
- **Quality Monitoring**: Real-time connection and video quality tracking

## API Endpoints

### REST API
- `GET /health` - Service health check with room statistics
- `GET /api/ice-servers` - WebRTC ICE server configuration
- `GET /api/interactions/:id` - Get interaction details
- `GET /api/interactions/user/:userId` - Get user's interaction history
- `GET /api/interactions/stats/overview` - Get interaction statistics
- `PATCH /api/interactions/:id/rating` - Update interaction rating

### WebSocket Events

#### Authentication
- `authenticate` - Authenticate socket connection with JWT token
- `authenticated` - Confirmation of successful authentication

#### Room Management
- `join-room` - Join a call room
- `joined-room` - Confirmation of room join
- `call-started` - Notification when call begins with 2 participants

#### WebRTC Signaling
- `webrtc-signal` - Send/receive WebRTC signals (offer, answer, ice-candidate)
- `connection-established` - WebRTC connection confirmed
- `connection-lost` - Connection issues detected

#### Video Control (Female-Centric)
- `request-video` - Request to enable video (any user can send)
- `video-requested` - Notification to female user about video request
- `accept-video` - Accept video request (female users only)
- `reject-video` - Reject video request (female users only)
- `video-enabled` - Video successfully enabled for both participants
- `video-rejected` - Video request was rejected

#### Call Management
- `quality-report` - Send call quality metrics
- `end-call` - End the current call
- `call-ended` - Call termination notification

## Business Rules

### Video Call Control
1. **Any user** can emit a `request-video` event
2. **Only female users** can emit `accept-video` or `reject-video` events
3. Video is enabled for **both participants** when accepted
4. Video requests have a timeout (configurable)
5. Only one video request can be pending at a time per room

### Call Management
- Maximum 2 participants per room
- Automatic call cleanup on disconnect
- Quality reporting for analytics
- Call duration tracking
- Connection state monitoring

## Configuration

### Environment Variables
```bash
PORT=3457
DATABASE_URL="postgresql://username:password@localhost:5432/interaction_service_db"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-jwt-secret"
SOCKET_CORS_ORIGIN="http://localhost:3000"
MAX_CALL_DURATION=3600000
VIDEO_QUALITY_CHECK_INTERVAL=10000
STUN_SERVERS="stun:stun.l.google.com:19302"
```

## Database Schema

### Interactions Table
- Tracks all voice/video call sessions
- Records video request/acceptance flow
- Stores call duration and quality metrics
- Links to participants and call events

### Call Events Table
- Detailed log of all call-related events
- WebRTC signaling events
- Video control events
- Quality reports and connection issues

## Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Docker

```bash
# Build image
docker build -t interaction-service .

# Run container
docker run -p 3457:3457 interaction-service
```

## Socket.IO Client Example

```javascript
const socket = io('http://localhost:3457');

// Authenticate
socket.emit('authenticate', {
  token: 'your-jwt-token',
  userId: 'user123',
  gender: 'female'
});

// Join a room
socket.emit('join-room', 'room123');

// Request video (any user)
socket.emit('request-video', {
  type: 'request-video',
  roomId: 'room123',
  userId: 'user123'
});

// Accept video (female users only)
socket.emit('accept-video', {
  type: 'accept-video',
  roomId: 'room123',
  userId: 'user456'
});

// Listen for video events
socket.on('video-requested', (data) => {
  console.log('Video requested by:', data.requestedBy);
});

socket.on('video-enabled', (data) => {
  console.log('Video enabled in room:', data.roomId);
});
```

## Architecture

The service uses a multi-layered architecture:
- **Express.js** for REST API endpoints
- **Socket.IO** for real-time WebRTC signaling
- **Redis** for Socket.IO clustering and caching
- **PostgreSQL** for persistent data storage
- **Prisma** for type-safe database operations

## Security Features
- JWT token authentication for all socket connections
- Rate limiting on API endpoints
- CORS protection
- Helmet.js security headers
- Input validation with Joi