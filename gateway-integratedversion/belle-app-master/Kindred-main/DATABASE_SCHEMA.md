# Database Schema Design

## Overview

The Real-time Connect application uses PostgreSQL as the primary database with a single database containing multiple schemas for logical separation while maintaining data consistency through foreign key relationships.

## Database: `realtime_connect`

### Schema Organization
- `user_schema` - User authentication and profiles
- `interaction_schema` - Matching, calls, and connections
- `communication_schema` - Post-match messaging
- `analytics_schema` - Logging and analytics (future)

---

## User Schema (`user_schema`)

### Table: `users`
Primary authentication and account management table.

```sql
CREATE TABLE user_schema.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('male', 'female', 'admin')),
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Indexes for users table
CREATE INDEX idx_users_email ON user_schema.users(email);
CREATE INDEX idx_users_username ON user_schema.users(username);
CREATE INDEX idx_users_role ON user_schema.users(role);
CREATE INDEX idx_users_active ON user_schema.users(is_active);
CREATE INDEX idx_users_created_at ON user_schema.users(created_at);
```

### Table: `profiles`
User profile information with one-to-one relationship to users.

```sql
CREATE TABLE user_schema.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES user_schema.users(id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    short_bio TEXT,
    photos JSONB DEFAULT '[]', -- Array of photo URLs
    videos JSONB DEFAULT '[]', -- Array of video URLs  
    intent VARCHAR(50) NOT NULL DEFAULT 'casual' CHECK (intent IN ('casual', 'friends', 'serious', 'networking')),
    age INTEGER CHECK (age >= 18 AND age <= 100),
    location_city VARCHAR(100),
    location_country VARCHAR(100),
    preferences JSONB DEFAULT '{}', -- User preferences for matching
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for profiles table
CREATE INDEX idx_profiles_user_id ON user_schema.profiles(user_id);
CREATE INDEX idx_profiles_intent ON user_schema.profiles(intent);
CREATE INDEX idx_profiles_age ON user_schema.profiles(age);
CREATE INDEX idx_profiles_location ON user_schema.profiles(location_city, location_country);
CREATE INDEX idx_profiles_updated_at ON user_schema.profiles(updated_at);
```

### Table: `user_sessions`
Track active user sessions and presence.

```sql
CREATE TABLE user_schema.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_schema.users(id) ON DELETE CASCADE,
    socket_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'in-call', 'queuing')),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for user_sessions table
CREATE INDEX idx_sessions_user_id ON user_schema.user_sessions(user_id);
CREATE INDEX idx_sessions_socket_id ON user_schema.user_sessions(socket_id);
CREATE INDEX idx_sessions_status ON user_schema.user_sessions(status);
CREATE INDEX idx_sessions_expires_at ON user_schema.user_sessions(expires_at);
```

---

## Interaction Schema (`interaction_schema`)

### Table: `interaction_logs`
Log all interactions between users including calls and their outcomes.

```sql
CREATE TABLE interaction_schema.interaction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES user_schema.users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES user_schema.users(id) ON DELETE CASCADE,
    room_id VARCHAR(255) NOT NULL,
    interaction_type VARCHAR(20) DEFAULT 'voice_call' CHECK (interaction_type IN ('voice_call', 'video_call')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    outcome VARCHAR(20) DEFAULT 'no_action' CHECK (outcome IN ('no_action', 'female_connected', 'both_left', 'timeout')),
    female_user_id UUID REFERENCES user_schema.users(id), -- Track which user is female for business logic
    metadata JSONB DEFAULT '{}' -- Additional interaction data
);

-- Indexes for interaction_logs table
CREATE INDEX idx_interaction_logs_user1_id ON interaction_schema.interaction_logs(user1_id);
CREATE INDEX idx_interaction_logs_user2_id ON interaction_schema.interaction_logs(user2_id);
CREATE INDEX idx_interaction_logs_female_user_id ON interaction_schema.interaction_logs(female_user_id);
CREATE INDEX idx_interaction_logs_room_id ON interaction_schema.interaction_logs(room_id);
CREATE INDEX idx_interaction_logs_started_at ON interaction_schema.interaction_logs(started_at);
CREATE INDEX idx_interaction_logs_outcome ON interaction_schema.interaction_logs(outcome);
CREATE INDEX idx_interaction_logs_users_composite ON interaction_schema.interaction_logs(user1_id, user2_id);
```

### Table: `connections`
Permanent connections established when female user chooses to connect post-call.

```sql
CREATE TABLE interaction_schema.connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES user_schema.users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES user_schema.users(id) ON DELETE CASCADE,
    interaction_log_id UUID NOT NULL REFERENCES interaction_schema.interaction_logs(id) ON DELETE CASCADE,
    female_user_id UUID NOT NULL REFERENCES user_schema.users(id), -- User who initiated the connection
    connection_type VARCHAR(20) DEFAULT 'chat_only' CHECK (connection_type IN ('chat_only', 'video_enabled')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure no duplicate connections between same users
    CONSTRAINT unique_user_connection UNIQUE(user1_id, user2_id)
);

-- Indexes for connections table
CREATE INDEX idx_connections_user1_id ON interaction_schema.connections(user1_id);
CREATE INDEX idx_connections_user2_id ON interaction_schema.connections(user2_id);
CREATE INDEX idx_connections_female_user_id ON interaction_schema.connections(female_user_id);
CREATE INDEX idx_connections_interaction_log_id ON interaction_schema.connections(interaction_log_id);
CREATE INDEX idx_connections_active ON interaction_schema.connections(is_active);
CREATE INDEX idx_connections_created_at ON interaction_schema.connections(created_at);
```

### Table: `video_requests`
Track video call requests in established connections.

```sql
CREATE TABLE interaction_schema.video_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES interaction_schema.connections(id) ON DELETE CASCADE,
    requester_user_id UUID NOT NULL REFERENCES user_schema.users(id) ON DELETE CASCADE,
    approver_user_id UUID NOT NULL REFERENCES user_schema.users(id) ON DELETE CASCADE, -- Must be female
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    metadata JSONB DEFAULT '{}'
);

-- Indexes for video_requests table
CREATE INDEX idx_video_requests_connection_id ON interaction_schema.video_requests(connection_id);
CREATE INDEX idx_video_requests_requester ON interaction_schema.video_requests(requester_user_id);
CREATE INDEX idx_video_requests_approver ON interaction_schema.video_requests(approver_user_id);
CREATE INDEX idx_video_requests_status ON interaction_schema.video_requests(status);
CREATE INDEX idx_video_requests_expires_at ON interaction_schema.video_requests(expires_at);
```

---

## Communication Schema (`communication_schema`)

### Table: `chat_rooms`
Chat rooms for established connections.

```sql
CREATE TABLE communication_schema.chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL UNIQUE REFERENCES interaction_schema.connections(id) ON DELETE CASCADE,
    room_name VARCHAR(255) NOT NULL, -- Generated room identifier
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for chat_rooms table
CREATE INDEX idx_chat_rooms_connection_id ON communication_schema.chat_rooms(connection_id);
CREATE INDEX idx_chat_rooms_room_name ON communication_schema.chat_rooms(room_name);
CREATE INDEX idx_chat_rooms_active ON communication_schema.chat_rooms(is_active);
```

### Table: `messages`
Messages exchanged in chat rooms.

```sql
CREATE TABLE communication_schema.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_room_id UUID NOT NULL REFERENCES communication_schema.chat_rooms(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES user_schema.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'voice', 'system')),
    metadata JSONB DEFAULT '{}', -- File URLs, timestamps, etc.
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for messages table
CREATE INDEX idx_messages_chat_room_id ON communication_schema.messages(chat_room_id);
CREATE INDEX idx_messages_sender_user_id ON communication_schema.messages(sender_user_id);
CREATE INDEX idx_messages_created_at ON communication_schema.messages(created_at);
CREATE INDEX idx_messages_type ON communication_schema.messages(message_type);
CREATE INDEX idx_messages_deleted ON communication_schema.messages(is_deleted);
-- Composite index for chat room message history with pagination
CREATE INDEX idx_messages_room_created_desc ON communication_schema.messages(chat_room_id, created_at DESC);
```

### Table: `message_read_status`
Track message read status for each user in chat rooms.

```sql
CREATE TABLE communication_schema.message_read_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES communication_schema.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_schema.users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one read status per user per message
    CONSTRAINT unique_user_message_read UNIQUE(message_id, user_id)
);

-- Indexes for message_read_status table
CREATE INDEX idx_message_read_status_message_id ON communication_schema.message_read_status(message_id);
CREATE INDEX idx_message_read_status_user_id ON communication_schema.message_read_status(user_id);
CREATE INDEX idx_message_read_status_read_at ON communication_schema.message_read_status(read_at);
```

---

## Database Functions and Triggers

### Auto-update timestamps

```sql
-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for timestamp updates
CREATE TRIGGER update_users_timestamp 
    BEFORE UPDATE ON user_schema.users 
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_profiles_timestamp 
    BEFORE UPDATE ON user_schema.profiles 
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_sessions_timestamp 
    BEFORE UPDATE ON user_schema.user_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_connections_timestamp 
    BEFORE UPDATE ON interaction_schema.connections 
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_chat_rooms_timestamp 
    BEFORE UPDATE ON communication_schema.chat_rooms 
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_messages_timestamp 
    BEFORE UPDATE ON communication_schema.messages 
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
```

### Business Logic Functions

```sql
-- Function to get user's connection partner
CREATE OR REPLACE FUNCTION get_connection_partner(input_user_id UUID, input_connection_id UUID)
RETURNS UUID AS $$
DECLARE
    partner_id UUID;
BEGIN
    SELECT 
        CASE 
            WHEN user1_id = input_user_id THEN user2_id
            WHEN user2_id = input_user_id THEN user1_id
            ELSE NULL
        END INTO partner_id
    FROM interaction_schema.connections 
    WHERE id = input_connection_id 
    AND (user1_id = input_user_id OR user2_id = input_user_id)
    AND is_active = TRUE;
    
    RETURN partner_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user is female (for business logic)
CREATE OR REPLACE FUNCTION is_female_user(input_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR(20);
BEGIN
    SELECT role INTO user_role 
    FROM user_schema.users 
    WHERE id = input_user_id;
    
    RETURN user_role = 'female';
END;
$$ LANGUAGE plpgsql;
```

---

## Data Retention and Privacy

### Automatic Cleanup Policies

```sql
-- Clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM user_schema.user_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Clean up old interaction logs (configurable retention period)
CREATE OR REPLACE FUNCTION cleanup_old_interactions(retention_days INTEGER DEFAULT 365)
RETURNS void AS $$
BEGIN
    DELETE FROM interaction_schema.interaction_logs 
    WHERE started_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * retention_days
    AND outcome IN ('no_action', 'both_left', 'timeout');
END;
$$ LANGUAGE plpgsql;
```

---

## Performance Considerations

### Partitioning Strategy (Future Enhancement)
```sql
-- Partition interaction_logs by month for better performance
-- This would be implemented when the table grows large

-- Example for future implementation:
-- CREATE TABLE interaction_logs_y2024m01 PARTITION OF interaction_schema.interaction_logs
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Query Optimization
- **Composite indexes** on frequently queried column combinations
- **Partial indexes** on filtered queries (e.g., only active connections)
- **JSONB GIN indexes** for metadata search capabilities
- **Connection pooling** at application level

This schema design ensures:
- **Data integrity** through foreign key constraints
- **Query performance** through strategic indexing
- **Scalability** through partitioning capabilities
- **Privacy compliance** through retention policies
- **Business logic enforcement** through database functions