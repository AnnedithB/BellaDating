# Mixpanel Tracking Plan - Real-time Connect Analytics

## Overview
This document defines all events and properties that should be tracked in Mixpanel for comprehensive product analytics of the Real-time Connect dating platform.

## Event Categories

### 1. Session Events

#### App Open
**Event Name:** `App Open`
**Trigger:** When user opens the application
**Properties:**
- `app_version` (string): Current app version
- `platform` (string): iOS/Android
- `device_model` (string): Device model
- `os_version` (string): Operating system version
- `session_id` (string): Unique session identifier
- `time_since_last_open` (number): Minutes since last app open
- `push_notification_clicked` (boolean): Whether opened via push notification

#### App Close
**Event Name:** `App Close`
**Trigger:** When user closes/backgrounds the application
**Properties:**
- `session_duration` (number): Total session time in seconds
- `screens_viewed` (number): Number of screens viewed in session
- `actions_taken` (number): Number of interactions in session
- `session_id` (string): Session identifier

#### Screen View
**Event Name:** `Screen View`
**Trigger:** When user navigates to any screen
**Properties:**
- `screen_name` (string): Name of the screen (Profile, Queue, Chat, Settings, etc.)
- `previous_screen` (string): Previous screen name
- `time_spent` (number): Time spent on previous screen in seconds
- `session_id` (string): Session identifier

### 2. User Action Events

#### Tap Button
**Event Name:** `Tap Button`
**Trigger:** When user taps any significant button
**Properties:**
- `button_name` (string): Name/identifier of the button
- `screen_name` (string): Screen where button was tapped
- `button_type` (string): Type of button (CTA, Navigation, Action, etc.)
- `button_position` (string): Position on screen (Header, Footer, Center, etc.)

#### Scroll Profile
**Event Name:** `Scroll Profile`
**Trigger:** When user scrolls through profile photos or details
**Properties:**
- `profile_id` (string): ID of the profile being viewed
- `photo_count` (number): Number of photos in profile
- `photos_viewed` (number): Number of photos user scrolled through
- `time_spent` (number): Time spent viewing profile in seconds
- `scroll_depth` (number): Percentage of profile content viewed

#### Swipe Action
**Event Name:** `Swipe Action`
**Trigger:** When user swipes on a profile (if applicable)
**Properties:**
- `action` (string): like, pass, super_like
- `profile_id` (string): ID of the profile swiped on
- `time_to_decision` (number): Time spent viewing before decision in seconds
- `compatibility_score` (number): Calculated compatibility score

### 3. Core Loop Events

#### Enter Queue
**Event Name:** `Enter Queue`
**Trigger:** When user enters the matching queue
**Properties:**
- `queue_type` (string): voice_only, video_enabled, text_chat
- `discovery_mode` (string): everyone, women_only, premium_only
- `preferences_set` (boolean): Whether user has set preferences
- `age_range_min` (number): Minimum age preference
- `age_range_max` (number): Maximum age preference
- `location_radius` (number): Location radius preference in km
- `interests_count` (number): Number of interests selected

#### Leave Queue
**Event Name:** `Leave Queue`
**Trigger:** When user manually leaves the queue
**Properties:**
- `time_in_queue` (number): Time spent in queue in seconds
- `reason` (string): manual_exit, app_backgrounded, error
- `queue_position` (number): Estimated position in queue when left

#### Receive Match
**Event Name:** `Receive Match`
**Trigger:** When user is matched with another user
**Properties:**
- `match_id` (string): Unique match identifier
- `compatibility_score` (number): Calculated compatibility score
- `wait_time` (number): Time spent in queue before match in seconds
- `partner_age` (number): Age of matched partner
- `partner_location_distance` (number): Distance to partner in km
- `mutual_interests_count` (number): Number of shared interests
- `session_type` (string): voice, video, chat

#### Start Voice Call
**Event Name:** `Start Voice Call`
**Trigger:** When voice call begins
**Properties:**
- `match_id` (string): Match identifier
- `session_id` (string): Session identifier
- `caller_initiated` (boolean): Whether current user initiated call
- `connection_quality` (string): excellent, good, fair, poor
- `device_audio_permissions` (boolean): Whether audio permissions granted

#### End Voice Call
**Event Name:** `End Voice Call`
**Trigger:** When voice call ends
**Properties:**
- `match_id` (string): Match identifier
- `session_id` (string): Session identifier
- `call_duration` (number): Call duration in seconds
- `end_reason` (string): mutual, user_ended, partner_ended, technical_issue, reported
- `call_quality_rating` (number): User's call quality rating (1-5)
- `connection_issues` (boolean): Whether there were connection problems

#### Request Video
**Event Name:** `Request Video`
**Trigger:** When user requests to enable video during call
**Properties:**
- `match_id` (string): Match identifier
- `session_id` (string): Session identifier
- `call_duration_before_request` (number): Time into call before video request
- `requester_gender` (string): Gender of user requesting video
- `camera_permissions` (boolean): Whether camera permissions granted

#### Accept Video
**Event Name:** `Accept Video`
**Trigger:** When user accepts video request
**Properties:**
- `match_id` (string): Match identifier
- `session_id` (string): Session identifier
- `time_to_decision` (number): Time taken to accept/decline in seconds
- `accepter_gender` (string): Gender of user accepting video
- `privacy_settings_enabled` (boolean): Whether privacy controls are active

#### Decline Video
**Event Name:** `Decline Video`
**Trigger:** When user declines video request
**Properties:**
- `match_id` (string): Match identifier
- `session_id` (string): Session identifier
- `time_to_decision` (number): Time taken to decline in seconds
- `decline_reason` (string): not_comfortable, technical_issues, privacy, other
- `privacy_reason` (string): makeup, lighting, comfort, other (if applicable)

#### Create Match
**Event Name:** `Create Match`
**Trigger:** When both users mutually decide to match after session
**Properties:**
- `match_id` (string): Match identifier
- `session_id` (string): Session identifier
- `session_duration` (number): Total session duration in seconds
- `session_type` (string): voice_only, video_enabled
- `mutual_rating` (number): Average of both users' ratings
- `compatibility_score` (number): Final compatibility score
- `conversation_started` (boolean): Whether conversation began immediately

#### Unmatch
**Event Name:** `Unmatch`
**Trigger:** When user unmatches with someone
**Properties:**
- `match_id` (string): Match identifier
- `match_duration` (number): Time since match creation in hours
- `messages_exchanged` (number): Number of messages exchanged
- `unmatch_reason` (string): not_interested, inappropriate_behavior, safety_concern, other
- `who_initiated` (string): current_user, partner

### 4. Communication Events

#### Send Message
**Event Name:** `Send Message`
**Trigger:** When user sends a message
**Properties:**
- `conversation_id` (string): Conversation identifier
- `match_id` (string): Match identifier
- `message_type` (string): text, image, voice_note, sticker
- `message_length` (number): Character count for text messages
- `voice_note_duration` (number): Duration in seconds for voice notes
- `is_first_message` (boolean): Whether this is the first message in conversation
- `response_time` (number): Time since last received message in minutes

#### Open Conversation
**Event Name:** `Open Conversation`
**Trigger:** When user opens a conversation
**Properties:**
- `conversation_id` (string): Conversation identifier
- `match_id` (string): Match identifier
- `unread_messages` (number): Number of unread messages
- `days_since_match` (number): Days since the match was created
- `last_message_age` (number): Hours since last message in conversation

#### Voice Note Played
**Event Name:** `Voice Note Played`
**Trigger:** When user plays a received voice note
**Properties:**
- `conversation_id` (string): Conversation identifier
- `voice_note_duration` (number): Duration of voice note in seconds
- `play_completion` (number): Percentage of voice note played (0-100)

### 5. Monetization Events

#### View Subscription Page
**Event Name:** `View Subscription Page`
**Trigger:** When user views subscription/premium page
**Properties:**
- `source` (string): organic, paywall, promotion, settings
- `trigger_action` (string): Action that triggered paywall (queue_limit, premium_feature, etc.)
- `plans_shown` (array): List of subscription plans displayed
- `discount_offered` (boolean): Whether discount was shown

#### Start Checkout
**Event Name:** `Start Checkout`
**Trigger:** When user begins subscription purchase flow
**Properties:**
- `plan_selected` (string): premium_monthly, premium_annual, vip_monthly, etc.
- `original_price` (number): Original plan price
- `discounted_price` (number): Final price after discounts
- `payment_method` (string): apple_pay, google_pay, credit_card
- `discount_type` (string): first_time_user, seasonal, loyalty, none

#### Purchase Completed
**Event Name:** `Purchase Completed`
**Trigger:** When subscription purchase is successful
**Properties:**
- `plan_purchased` (string): Plan identifier
- `amount_paid` (number): Amount charged
- `currency` (string): Currency code
- `payment_method` (string): Payment method used
- `trial_included` (boolean): Whether trial period included
- `is_upgrade` (boolean): Whether upgrading from existing plan

#### Purchase Failed
**Event Name:** `Purchase Failed`
**Trigger:** When subscription purchase fails
**Properties:**
- `plan_attempted` (string): Plan user tried to purchase
- `failure_reason` (string): payment_declined, technical_error, user_cancelled
- `error_code` (string): Specific error code from payment processor
- `retry_attempted` (boolean): Whether user attempted retry

### 6. Safety and Moderation Events

#### Report User
**Event Name:** `Report User`
**Trigger:** When user reports another user
**Properties:**
- `reported_user_id` (string): ID of reported user
- `report_reason` (string): harassment, inappropriate_behavior, fake_profile, spam, other
- `report_context` (string): during_call, in_chat, profile_view
- `session_id` (string): Session ID if reported during call
- `evidence_provided` (boolean): Whether user provided additional evidence

#### Block User
**Event Name:** `Block User`
**Trigger:** When user blocks another user
**Properties:**
- `blocked_user_id` (string): ID of blocked user
- `block_reason` (string): not_interested, inappropriate_behavior, safety_concern
- `interaction_history` (boolean): Whether users had previous interactions
- `messages_exchanged` (number): Number of messages exchanged before block

### 7. Profile and Preferences Events

#### Update Profile
**Event Name:** `Update Profile`
**Trigger:** When user modifies their profile
**Properties:**
- `fields_updated` (array): List of profile fields updated
- `photos_added` (number): Number of new photos added
- `photos_removed` (number): Number of photos removed
- `bio_length` (number): New bio character count
- `interests_count` (number): Total number of interests selected

#### Upload Photo
**Event Name:** `Upload Photo`
**Trigger:** When user uploads a new profile photo
**Properties:**
- `photo_position` (number): Position in photo array (1 = main photo)
- `upload_source` (string): camera, gallery, social_media
- `photo_size` (number): File size in bytes
- `is_verified_photo` (boolean): Whether photo went through verification

#### Update Preferences
**Event Name:** `Update Preferences`
**Trigger:** When user updates matching preferences
**Properties:**
- `age_range_changed` (boolean): Whether age range was modified
- `location_radius_changed` (boolean): Whether location radius was modified
- `interests_changed` (boolean): Whether interests were modified
- `discovery_mode_changed` (boolean): Whether discovery mode was changed
- `new_age_min` (number): New minimum age preference
- `new_age_max` (number): New maximum age preference
- `new_radius` (number): New location radius in km

### 8. Onboarding Events

#### Complete Registration
**Event Name:** `Complete Registration`
**Trigger:** When user completes account creation
**Properties:**
- `registration_method` (string): email, phone, apple, google, facebook
- `age` (number): User's age
- `gender` (string): User's gender
- `location_country` (string): User's country
- `photos_uploaded` (number): Number of photos uploaded during onboarding
- `bio_completed` (boolean): Whether user added bio
- `interests_selected` (number): Number of interests selected

#### Complete Profile Setup
**Event Name:** `Complete Profile Setup`
**Trigger:** When user finishes initial profile setup
**Properties:**
- `setup_duration` (number): Time taken to complete setup in minutes
- `photos_uploaded` (number): Total photos uploaded
- `verification_started` (boolean): Whether user started verification process
- `preferences_set` (boolean): Whether matching preferences were set

#### Skip Onboarding Step
**Event Name:** `Skip Onboarding Step`
**Trigger:** When user skips an optional onboarding step
**Properties:**
- `step_skipped` (string): Name of skipped step
- `step_number` (number): Position in onboarding flow
- `reason` (string): user_choice, technical_issue, timeout

## User Properties (Profile Information)
These properties should be set for each user and updated when they change:

### Demographics
- `age` (number): User's age
- `gender` (string): User's gender
- `location_country` (string): User's country
- `location_city` (string): User's city
- `signup_date` (datetime): When user registered
- `signup_method` (string): How user registered

### Subscription Status
- `subscription_status` (string): free, premium, vip
- `subscription_start_date` (datetime): When current subscription started
- `subscription_end_date` (datetime): When subscription expires
- `lifetime_value` (number): Total amount spent

### Platform Usage
- `total_sessions` (number): Total number of sessions
- `total_matches` (number): Total number of matches
- `total_messages_sent` (number): Total messages sent
- `last_active_date` (datetime): Last time user was active
- `app_version` (string): Current app version

### Verification Status
- `email_verified` (boolean): Email verification status
- `phone_verified` (boolean): Phone verification status
- `photo_verified` (boolean): Photo verification status
- `id_verified` (boolean): ID verification status

## Super Properties (Automatically Added to All Events)
These properties should be automatically added to every event:

- `distinct_id` (string): Unique user identifier
- `time` (datetime): Event timestamp
- `app_version` (string): Current app version
- `platform` (string): iOS/Android/Web
- `device_id` (string): Device identifier
- `session_id` (string): Current session ID
- `user_id` (string): User's account ID
- `subscription_tier` (string): Current subscription level
- `country` (string): User's country
- `city` (string): User's city
- `cohort_week` (string): Week of user registration (for cohort analysis)

## Implementation Notes

### Mobile App Integration
1. Initialize Mixpanel SDK with project token
2. Set user properties on login/registration
3. Track events at appropriate trigger points
4. Use batch uploading for better performance
5. Implement event validation to ensure data quality

### Server-Side Events
Critical business events should also be tracked server-side for accuracy:
- Purchase Completed/Failed
- Create Match
- Report User
- Account Suspension/Ban
- Subscription Changes

### Privacy Considerations
- Never track personally identifiable information (PII)
- Use hashed user IDs as distinct_id
- Respect user privacy settings and opt-outs
- Comply with GDPR and CCPA requirements
- Anonymize location data (city/country level only)

### Data Quality Guidelines
- Use consistent naming conventions (snake_case)
- Validate property types and ranges
- Set up automated data quality checks
- Monitor for missing or malformed events
- Regular review and cleanup of deprecated events

This tracking plan provides comprehensive coverage of user behavior and business metrics while maintaining user privacy and data quality standards.