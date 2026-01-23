# Dating Enhancement API Documentation

## Overview
This document describes the enhanced API endpoints for comprehensive dating profile management and sophisticated matching algorithms implemented in the Real-time Connect platform.

## New Features
- Deep dating profile attributes (gender, relationship intents, lifestyle preferences, etc.)
- Partner preference management with granular control
- Advanced compatibility scoring algorithm with multiple criteria
- Premium user features and prioritization
- Enhanced matching with dating-specific logic

---

## User Service Endpoints

### 1. Update Profile with Dating Fields
**Endpoint:** `PUT /api/profile`

**Description:** Update user profile including new dating-specific attributes

**Request Body:**
```json
{
  "displayName": "John Doe",
  "shortBio": "Adventure seeker and coffee enthusiast",
  "age": 28,
  "locationCity": "San Francisco",
  "locationCountry": "USA",
  
  // Dating-specific fields
  "gender": "MAN",
  "relationshipIntents": ["LONG_TERM", "MARRIAGE"],
  "familyPlans": "DOESNT_HAVE_KIDS_WANTS_KIDS",
  "religion": "AGNOSTIC",
  "educationLevel": "POSTGRADUATE",
  "politicalViews": "MODERATE",
  "exercise": "FREQUENTLY",
  "smoking": "NEVER",
  "drinking": "SOCIALLY"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "profile": {
      "id": "profile-uuid",
      "displayName": "John Doe",
      "shortBio": "Adventure seeker and coffee enthusiast",
      // ... all profile fields including new dating attributes
      "updatedAt": "2025-09-27T10:30:00Z"
    }
  }
}
```

### 2. Update Partner Preferences
**Endpoint:** `PUT /api/profile/preferences`

**Description:** Update partner preferences with dating-specific criteria

**Request Body:**
```json
{
  "preferredGenders": ["WOMAN"],
  "preferredRelationshipIntents": ["LONG_TERM", "MARRIAGE"],
  "preferredFamilyPlans": ["DOESNT_HAVE_KIDS_WANTS_KIDS", "NOT_SURE_YET"],
  "preferredReligions": ["AGNOSTIC", "SPIRITUAL", "CHRISTIAN"],
  "preferredEducationLevels": ["UNDERGRADUATE", "POSTGRADUATE"],
  "preferredPoliticalViews": ["MODERATE", "LIBERAL"],
  "preferredExerciseHabits": ["FREQUENTLY", "SOCIALLY"],
  "preferredSmokingHabits": ["NEVER", "RARELY"],
  "preferredDrinkingHabits": ["SOCIALLY", "RARELY"],
  "preferredMinAge": 25,
  "preferredMaxAge": 35
}
```

---

## Queuing Service Endpoints

### 3. Update Dating Preferences
**Endpoint:** `PUT /api/matching/dating-preferences/:userId`

**Description:** Update dating-specific matching preferences and weights

**Request Body:**
```json
{
  "preferredGenders": ["WOMAN"],
  "preferredRelationshipIntents": ["LONG_TERM"],
  "preferredMinAge": 25,
  "preferredMaxAge": 35,
  "isPremiumUser": true,
  "premiumExpiry": "2026-09-27T00:00:00Z",
  
  // Matching weights (should sum to ~1.0)
  "genderWeight": 0.25,
  "relationshipIntentWeight": 0.15,
  "lifestyleWeight": 0.10,
  "ageWeight": 0.15,
  "locationWeight": 0.20,
  "interestWeight": 0.10,
  "languageWeight": 0.05
}
```

### 4. Find Dating Matches
**Endpoint:** `POST /api/matching/find-dating-matches`

**Description:** Find compatible matches using enhanced dating algorithm

**Request Body:**
```json
{
  "userId": "user-uuid",
  "intent": "SERIOUS",
  "maxMatches": 10
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "matches": [
      {
        "userId": "match-user-uuid",
        "matchId": "match-attempt-uuid",
        "compatibility": {
          "totalScore": 87,
          "breakdown": {
            "ageCompatibility": 92,
            "locationCompatibility": 78,
            "interestCompatibility": 65,
            "genderCompatibility": 100,
            "relationshipIntentCompatibility": 95,
            "lifestyleCompatibility": 82,
            "premiumBonus": 15
          }
        }
      }
    ],
    "algorithm": "dating_v1",
    "timestamp": "2025-09-27T10:30:00Z"
  }
}
```

---

## Database Schema Updates

### Enhanced Profile Model (User Service)
```prisma
model Profile {
  // ... existing fields

  // Dating-specific user attributes
  gender                    Gender?
  relationshipIntents       RelationshipIntent[]
  familyPlans              FamilyPlans?
  religion                 Religion?
  educationLevel           EducationLevel?
  politicalViews           PoliticalView?
  exercise                 LifestyleHabit?
  smoking                  LifestyleHabit?
  drinking                 LifestyleHabit?

  // Partner preferences
  preferredGenders         Gender[]
  preferredRelationshipIntents RelationshipIntent[]
  preferredFamilyPlans     FamilyPlans[]
  // ... other preference fields

  isPremiumUser            Boolean @default(false)
}
```

### Enhanced Queue Entry Model (Queuing Service)
```prisma
model QueueEntry {
  // ... existing fields
  
  gender               DatingGender?
  relationshipIntents  Json @default("[]")
  familyPlans         String?
  religion            String?
  educationLevel      String?
  politicalViews      String?
  exercise            String?
  smoking             String?
  drinking            String?
  isPremiumUser       Boolean @default(false)
}
```

### Enhanced Match Attempt Model
```prisma
model MatchAttempt {
  // ... existing basic scores
  
  // Dating-specific compatibility scores
  genderCompatScore      Float
  relationshipIntentScore Float
  familyPlansScore       Float
  religionScore          Float
  educationScore         Float
  politicalScore         Float
  lifestyleScore         Float
  premiumBonus          Float
}
```

---

## Compatibility Scoring Algorithm

### Scoring Components

1. **Gender Compatibility (25% weight)**
   - Binary: 1.0 if mutual gender preference match, 0.0 otherwise
   - Critical for dating matches

2. **Relationship Intent Compatibility (15% weight)**
   - Overlapping relationship goals
   - Preference bonuses for specific intent matches

3. **Age Compatibility (15% weight)**
   - Within preferred age ranges
   - Bonus for closer age matches

4. **Location Compatibility (20% weight)**
   - Distance-based scoring within radius preferences
   - Haversine formula for accurate distance calculation

5. **Lifestyle Compatibility (10% weight)**
   - Exercise, smoking, drinking habits compatibility
   - Matrix-based scoring with preference bonuses

6. **Family Plans Compatibility (8% weight)**
   - Sophisticated compatibility matrix
   - Accounts for different life stages and goals

7. **Other Factors (7% combined)**
   - Religion (5%): Same religion bonus + preference matches
   - Education (3%): Level proximity + preference matches
   - Political Views (3%): Compatibility matrix + preferences
   - Ethnicity (2%): Preference-based bonuses only (no exclusion)

8. **Premium Bonus (up to 25%)**
   - Premium users get matching priority
   - Bonus for premium-to-premium matches

### Matching Logic

```typescript
// Core matching flow
1. Filter by gender compatibility (mandatory for dating)
2. Calculate all compatibility scores
3. Apply weighted scoring based on user preferences
4. Add premium bonuses
5. Sort by total score with premium prioritization
6. Return top matches above minimum threshold (40%)
```

---

## Premium Features

### Premium User Benefits
- **Higher match priority**: Premium users appear first in match results
- **Enhanced compatibility**: Premium-to-premium matching bonus
- **Extended preferences**: Access to all preference filters
- **Detailed compatibility breakdown**: Full scoring details
- **Match history**: Comprehensive matching analytics

### Premium Gating
- Basic users: Limited to essential matching criteria
- Premium users: Full access to lifestyle, political, religious, and educational preferences
- Premium users get 25% bonus in compatibility scoring

---

## Enum Values

### Gender
- `MAN`
- `WOMAN` 
- `NONBINARY`

### Relationship Intent
- `LONG_TERM`
- `CASUAL_DATES`
- `MARRIAGE`
- `INTIMACY`
- `INTIMACY_NO_COMMITMENT`
- `LIFE_PARTNER`
- `ETHICAL_NON_MONOGAMY`

### Family Plans
- `HAS_KIDS_WANTS_MORE`
- `HAS_KIDS_DOESNT_WANT_MORE`
- `DOESNT_HAVE_KIDS_WANTS_KIDS`
- `DOESNT_HAVE_KIDS_DOESNT_WANT_KIDS`
- `NOT_SURE_YET`

### Religion
- `AGNOSTIC`
- `ATHEIST`
- `BUDDHIST`
- `CATHOLIC`
- `CHRISTIAN`
- `HINDU`
- `JEWISH`
- `MUSLIM`
- `SPIRITUAL`
- `OTHER`

### Education Level
- `HIGH_SCHOOL`
- `IN_COLLEGE`
- `UNDERGRADUATE`
- `IN_GRAD_SCHOOL`
- `POSTGRADUATE`

### Political Views
- `LIBERAL`
- `MODERATE`
- `CONSERVATIVE`
- `APOLITICAL`
- `OTHER`

### Lifestyle Habits (Exercise, Smoking, Drinking)
- `FREQUENTLY`
- `SOCIALLY`
- `RARELY`
- `NEVER`

---

## Error Handling

### Common Error Responses
```json
{
  "status": "error",
  "message": "Invalid gender value",
  "code": "VALIDATION_ERROR"
}
```

### Validation Rules
- Age ranges: 18-100 years
- Preference arrays: Must contain valid enum values
- Matching weights: Should sum to approximately 1.0
- Premium expiry: Must be future date

---

## Performance Considerations

### Optimization Strategies
1. **Database Indexing**: 
   - Queue entries indexed by status, intent, gender, premium status
   - Match attempts indexed by score and timestamp

2. **Caching**: 
   - User preferences cached in Redis
   - Frequent match results cached for quick retrieval

3. **Algorithm Efficiency**:
   - Candidate pre-filtering before complex scoring
   - Parallel score calculations where possible
   - Early termination for incompatible matches

4. **Premium Prioritization**:
   - Premium users processed first in matching queue
   - Separate matching pools for premium vs. standard users

---

## Security & Privacy

### Data Protection
- All dating attributes are optional
- Preference-based filtering (no exclusion-based discrimination)
- Secure premium status verification
- Match history anonymization after 30 days

### Ethical Considerations
- Ethnicity scoring designed to boost preferences, not exclude
- No algorithmic bias against protected characteristics
- Transparent compatibility scoring
- User control over all preference settings