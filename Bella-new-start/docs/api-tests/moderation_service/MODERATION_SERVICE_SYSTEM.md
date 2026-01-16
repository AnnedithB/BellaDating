# Moderation Service - Complete System Documentation

## Overview
The Moderation Service is a **content safety and community management system** that handles user reports, automated content moderation, appeals, and safety analytics. It includes AI-powered content analysis using Google Perspective API and automated trust scoring.

**Service Port**: 3007  
**Database**: `admin` (shared with admin-service)  
**Status**: Placeholder implementation - routes exist but business logic needs full implementation

---

## Architecture

### Database Schema (11+ Tables)

#### Core Moderation Tables
1. **ModerationRecord** - Main content moderation records
   - Tracks all moderated content (messages, profiles, photos)
   - Fields: id, contentId, contentType, status, moderatorId, reason, aiScore, timestamps

2. **UserReport** - User-submitted reports
   - User reports about inappropriate content/behavior
   - Fields: id, reporterId, reportedUserId, contentId, contentType, reason, description, status, timestamps

3. **ModerationViolation** - Violation tracking
   - Records of policy violations
   - Fields: id, userId, violationType, severity, description, actionTaken, timestamps

4. **Appeal** - User appeals for moderation decisions
   - Users can appeal moderation actions
   - Fields: id, userId, moderationRecordId, reason, evidence, status, reviewedBy, timestamps

#### Safety & Trust Tables
5. **UserSafetyProfile** - User safety metrics
   - Trust scores, violation history, risk levels
   - Fields: id, userId, trustScore, violationCount, riskLevel, lastReviewedAt

6. **ModerationRule** - Configurable moderation rules
   - Dynamic rule engine for content policies
   - Fields: id, name, description, ruleType, severity, isActive, config

7. **ModerationAlert** - System alerts
   - High-priority alerts for suspicious patterns
   - Fields: id, type, severity, message, metadata, acknowledged, timestamps

#### Analytics Tables
8. **ModerationStatistics** - Daily aggregated stats
   - Daily rollup of moderation metrics
   - Fields: id, date, totalReports, resolvedReports, averageResolutionTime, topReasons

9. **ModeratorActivity** - Moderator performance tracking
   - Track moderator actions and performance
   - Fields: id, moderatorId, date, actionsCount, averageResponseTime, accuracyRate

10. **ContentSafetyScore** - AI safety scores
    - Perspective API scores for content
    - Fields: id, contentId, contentType, toxicityScore, threatScore, insultScore, timestamps

11. **TrustScoreHistory** - Historical trust scores
    - Track changes in user trust scores over time
    - Fields: id, userId, score, reason, changedBy, timestamp

---

## API Endpoints

### 1. Moderation Routes (`/api/moderation`)

#### POST `/api/moderation/reports`
**Purpose**: Submit a user report  
**Auth**: Required (user token)  
**Body**:
```json
{
  "contentId": "msg_123",
  "contentType": "MESSAGE",
  "reason": "HARASSMENT",
  "description": "User sent threatening messages"
}
```
**Response**:
```json
{
  "id": "report_123",
  "contentId": "msg_123",
  "contentType": "MESSAGE",
  "reason": "HARASSMENT",
  "description": "User sent threatening messages",
  "reporterId": "user_456",
  "status": "PENDING",
  "createdAt": "2025-12-17T10:00:00Z"
}
```

#### GET `/api/moderation/queue`
**Purpose**: Get moderation queue (for moderators)  
**Auth**: Required (moderator token)  
**Query Params**:
- `status` (optional): PENDING, RESOLVED, REJECTED
- `contentType` (optional): MESSAGE, PROFILE, PHOTO
- `page` (default: 1)
- `limit` (default: 20)

**Response**:
```json
{
  "reports": [
    {
      "id": "report_123",
      "contentId": "msg_123",
      "contentType": "MESSAGE",
      "reason": "HARASSMENT",
      "status": "PENDING",
      "createdAt": "2025-12-17T10:00:00Z"
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

#### PUT `/api/moderation/moderate/:reportId`
**Purpose**: Take moderation action on a report  
**Auth**: Required (moderator token)  
**Body**:
```json
{
  "action": "REJECT",
  "reason": "Violates community guidelines - harassment"
}
```
**Response**:
```json
{
  "id": "report_123",
  "status": "REJECTED",
  "moderatedAt": "2025-12-17T10:30:00Z",
  "moderatedBy": "moderator_789",
  "reason": "Violates community guidelines - harassment"
}
```

### 2. Admin Routes (`/api/admin`)

#### GET `/api/admin/stats`
**Purpose**: Get moderation statistics  
**Auth**: Required (admin token)  
**Query Params**:
- `timeframe` (optional): day, week, month, year (default: week)

**Response**:
```json
{
  "totalReports": 156,
  "resolvedReports": 142,
  "pendingReports": 14,
  "averageResolutionTime": 3.5
}
```

#### GET `/api/admin/moderators`
**Purpose**: Get list of moderators  
**Auth**: Required (admin token)  
**Response**:
```json
[
  {
    "id": "user1",
    "email": "moderator1@example.com",
    "createdAt": "2025-01-01T00:00:00Z"
  }
]
```

### 3. Appeals Routes (`/api/appeals`)

#### POST `/api/appeals`
**Purpose**: Submit an appeal for a moderation decision  
**Auth**: Required (user token)  
**Body**:
```json
{
  "reportId": "report_123",
  "reason": "This was a misunderstanding",
  "evidence": "Screenshots showing context"
}
```
**Response**:
```json
{
  "id": "appeal_456",
  "reportId": "report_123",
  "reason": "This was a misunderstanding",
  "evidence": "Screenshots showing context",
  "userId": "user_789",
  "status": "PENDING",
  "createdAt": "2025-12-17T11:00:00Z"
}
```

#### GET `/api/appeals/user/:userId`
**Purpose**: Get user's appeal history  
**Auth**: Required (user token)  
**Response**:
```json
[
  {
    "id": "appeal_456",
    "reportId": "report_123",
    "status": "PENDING",
    "createdAt": "2025-12-17T11:00:00Z"
  }
]
```

### 4. Statistics Routes (`/api/statistics`)

#### GET `/api/statistics`
**Purpose**: Get detailed moderation statistics  
**Auth**: Required (admin token)  
**Query Params**:
- `timeframe` (optional): day, week, month, year (default: week)

**Response**:
```json
{
  "totalReports": 156,
  "resolvedReports": 142,
  "pendingReports": 14,
  "averageResolutionTime": 3.5,
  "topReasons": [
    { "reason": "HARASSMENT", "count": 45 },
    { "reason": "SPAM", "count": 32 }
  ],
  "moderatorActivity": [
    { "moderatorId": "mod_1", "actionsCount": 67 }
  ]
}
```

---

## Automated Jobs (Cron)

### 1. Daily Statistics Aggregation
**Schedule**: Every day at 1:00 AM  
**Function**: `statisticsService.aggregateDailyStats()`  
**Purpose**: 
- Aggregate previous day's moderation metrics
- Calculate resolution times, moderator performance
- Store in ModerationStatistics table
- Generate daily reports for admin dashboard

### 2. Weekly Cleanup
**Schedule**: Every Sunday at 2:00 AM  
**Function**: `statisticsService.cleanupOldRecords()`  
**Purpose**:
- Archive old resolved reports (>90 days)
- Clean up temporary data
- Optimize database performance
- Maintain data retention policies

### 3. Hourly Trust Score Updates
**Schedule**: Every hour  
**Function**: `moderationService.updateUserTrustScores()`  
**Purpose**:
- Recalculate user trust scores based on recent activity
- Update UserSafetyProfile records
- Identify high-risk users
- Trigger alerts for suspicious patterns

---

## AI-Powered Moderation

### Google Perspective API Integration
The service uses Google's Perspective API for automated content analysis:

**Analyzed Attributes**:
- **TOXICITY**: Overall toxicity score (0-1)
- **SEVERE_TOXICITY**: Severe toxic content
- **IDENTITY_ATTACK**: Attacks on identity/demographics
- **INSULT**: Insulting language
- **PROFANITY**: Profane language
- **THREAT**: Threatening language
- **SEXUALLY_EXPLICIT**: Sexual content
- **FLIRTATION**: Flirtatious content

**Workflow**:
1. User submits content (message, profile, photo caption)
2. Content sent to Perspective API for analysis
3. AI scores stored in ContentSafetyScore table
4. If score exceeds threshold, auto-flag for review
5. Moderator reviews flagged content
6. Action taken: APPROVE, REJECT, or ESCALATE

**Thresholds** (configurable in ModerationRule):
- Low Risk: 0.0 - 0.3 (auto-approve)
- Medium Risk: 0.3 - 0.7 (flag for review)
- High Risk: 0.7 - 1.0 (auto-reject + alert)

---

## Trust Score System

### How Trust Scores Work
Each user has a trust score (0-100) that affects their experience:

**Score Ranges**:
- 90-100: Excellent standing (full features)
- 70-89: Good standing (normal features)
- 50-69: Moderate risk (limited features)
- 30-49: High risk (restricted features)
- 0-29: Very high risk (suspended/banned)

**Factors Affecting Trust Score**:
- Number of violations (-5 to -20 per violation)
- Severity of violations (minor vs severe)
- Successful appeals (+5 per successful appeal)
- Time since last violation (+1 per week clean)
- Reports filed by user (+2 per valid report)
- Reports filed against user (-3 per valid report)

**Actions Based on Trust Score**:
- < 50: Cannot send messages to new matches
- < 30: Cannot upload new photos
- < 20: Account suspended pending review
- < 10: Permanent ban

---

## Testing Without Dummy Data

### Step-by-Step Testing Guide

#### Prerequisites
1. Ensure moderation-service is running: `docker ps | findstr moderation`
2. Have user authentication tokens ready
3. Have moderator/admin tokens ready

#### Test Flow 1: User Reports Content

**Step 1: User submits a report**
```powershell
$userToken = "user_jwt_token_here"
$headers = @{
    "Authorization" = "Bearer $userToken"
    "Content-Type" = "application/json"
}
$body = @{
    contentId = "msg_12345"
    contentType = "MESSAGE"
    reason = "HARASSMENT"
    description = "User sent threatening messages repeatedly"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3007/api/moderation/reports" -Method POST -Headers $headers -Body $body
```

**Expected Result**: Report created in UserReport table with status PENDING

**Step 2: Check moderation queue**
```powershell
$modToken = "moderator_jwt_token_here"
$headers = @{
    "Authorization" = "Bearer $modToken"
}

Invoke-RestMethod -Uri "http://localhost:3007/api/moderation/queue?status=PENDING&page=1&limit=20" -Headers $headers
```

**Expected Result**: See the report in the queue

**Step 3: Moderator takes action**
```powershell
$reportId = "report_id_from_step2"
$body = @{
    action = "REJECT"
    reason = "Confirmed violation of harassment policy"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3007/api/moderation/moderate/$reportId" -Method PUT -Headers $headers -Body $body
```

**Expected Result**: 
- Report status changed to REJECTED
- ModerationRecord created
- User trust score decreased
- ModerationViolation record created

#### Test Flow 2: User Appeals Decision

**Step 1: User submits appeal**
```powershell
$userToken = "user_jwt_token_here"
$headers = @{
    "Authorization" = "Bearer $userToken"
    "Content-Type" = "application/json"
}
$body = @{
    reportId = "report_123"
    reason = "This was taken out of context"
    evidence = "Full conversation screenshots"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3007/api/appeals" -Method POST -Headers $headers -Body $body
```

**Expected Result**: Appeal created in Appeal table with status PENDING

**Step 2: Check user's appeals**
```powershell
$userId = "user_id_here"
Invoke-RestMethod -Uri "http://localhost:3007/api/appeals/user/$userId" -Headers $headers
```

**Expected Result**: See all appeals for that user

#### Test Flow 3: Admin Views Statistics

**Step 1: Get weekly stats**
```powershell
$adminToken = "admin_jwt_token_here"
$headers = @{
    "Authorization" = "Bearer $adminToken"
}

Invoke-RestMethod -Uri "http://localhost:3007/api/admin/stats?timeframe=week" -Headers $headers
```

**Expected Result**: Aggregated statistics from ModerationStatistics table

**Step 2: Get detailed statistics**
```powershell
Invoke-RestMethod -Uri "http://localhost:3007/api/statistics?timeframe=month" -Headers $headers
```

**Expected Result**: Detailed breakdown with top reasons and moderator activity

#### Test Flow 4: Automated Jobs

**Trigger Trust Score Update (Manual)**
```powershell
# This normally runs hourly via cron
# To test manually, you would need to call the internal function
# Or wait for the hourly cron job to run
```

**Check Trust Score Changes**
```sql
-- Connect to database
docker exec -it kindred-postgres psql -U postgres -d admin

-- View trust score history
SELECT * FROM "TrustScoreHistory" ORDER BY timestamp DESC LIMIT 10;

-- View user safety profiles
SELECT * FROM "UserSafetyProfile" ORDER BY "lastReviewedAt" DESC;
```

---

## Data Flow Diagram

```
User Action → Report Submission
    ↓
UserReport Table (status: PENDING)
    ↓
AI Analysis (Perspective API)
    ↓
ContentSafetyScore Table
    ↓
Moderation Queue
    ↓
Moderator Review
    ↓
ModerationRecord Table
    ↓
Trust Score Update
    ↓
UserSafetyProfile Table
    ↓
(If violation) → ModerationViolation Table
    ↓
(If user appeals) → Appeal Table
    ↓
Daily Aggregation (Cron)
    ↓
ModerationStatistics Table
    ↓
Admin Dashboard
```

---

## Current Implementation Status

### ✅ Implemented
- Database schema (11+ tables)
- API route structure
- Cron job scheduling
- Service class interfaces
- Authentication middleware

### ⚠️ Placeholder (Needs Implementation)
- **ModerationService**: All methods return placeholder data
- **AlertService**: Pattern detection logic not implemented
- **StatisticsService**: Aggregation logic not implemented
- **Perspective API**: Integration not connected
- **Trust Score Calculation**: Algorithm not implemented
- **Database Queries**: All Prisma queries need to be written

### 🔧 To Implement
1. Connect Perspective API with real API key
2. Implement Prisma queries in all service methods
3. Build trust score calculation algorithm
4. Implement pattern detection for alerts
5. Build statistics aggregation logic
6. Add real-time notification system
7. Implement appeal review workflow
8. Add moderator assignment logic
9. Build content filtering rules engine
10. Add audit logging for all moderation actions

---

## Environment Variables Required

```env
# Google Perspective API
PERSPECTIVE_API_KEY=your_api_key_here

# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/admin

# Service Config
PORT=3007
NODE_ENV=production

# Thresholds
TOXICITY_THRESHOLD=0.7
AUTO_REJECT_THRESHOLD=0.85
TRUST_SCORE_VIOLATION_PENALTY=10
```

---

## Integration with Other Services

### User Service (Port 3001)
- Fetch user profiles for reports
- Update user status (suspend/ban)
- Sync trust scores

### Communications Service (Port 3002)
- Moderate messages in real-time
- Delete violating messages
- Block users from messaging

### Admin Service (Port 3009)
- Share admin database
- Provide moderation data for admin dashboard
- Sync moderator permissions

### Analytics Service (Port 3008)
- Send moderation events for analytics
- Track safety metrics
- Generate safety reports

---

## Next Steps for Full Implementation

1. **Phase 1: Core Moderation**
   - Implement Prisma queries in ModerationService
   - Connect Perspective API
   - Build basic trust score system

2. **Phase 2: Automation**
   - Implement cron job logic
   - Build statistics aggregation
   - Add alert system

3. **Phase 3: Advanced Features**
   - Pattern detection
   - Appeal workflow
   - Moderator assignment
   - Rule engine

4. **Phase 4: Testing & Optimization**
   - Load testing
   - Performance optimization
   - Security audit
   - Documentation updates

---

## Summary

The Moderation Service is a **comprehensive content safety platform** with:
- ✅ Complete database schema (11+ tables)
- ✅ Full API endpoint structure (4 route groups)
- ✅ Automated cron jobs (3 scheduled tasks)
- ✅ AI integration architecture (Perspective API)
- ⚠️ Placeholder business logic (needs implementation)

**Current State**: Routes and structure are ready, but all service methods need real implementation with Prisma queries and business logic.

**To Test**: Use the API endpoints above to create reports, moderate content, and view statistics. The data will flow through the system once the Prisma queries are implemented in the service classes.
