-- Seed Moderation Database with Realistic Data
-- Run with: Get-Content seed-moderation-db.sql | docker exec -i kindred-postgres psql -U postgres -d moderation

-- Clear existing data
DELETE FROM moderation_records;
DELETE FROM user_safety_profiles;
DELETE FROM user_violations;
DELETE FROM admin_alerts;

-- Seed Moderation Records (content that needs review)
INSERT INTO moderation_records (
    id, "contentId", "contentType", "userId", content, "toxicityScore", 
    status, action, "actionReason", confidence, "sourceService", 
    "createdAt", "updatedAt"
) VALUES 
    (
        'mod_001', 
        'msg_12345', 
        'TEXT_MESSAGE', 
        'cmj48wfp40000qo08l6rkkn0e',
        'You are such an idiot, I hate you!',
        0.85,
        'PENDING',
        'ALLOW',
        NULL,
        0.92,
        'communication-service',
        NOW() - INTERVAL '2 hours',
        NOW()
    ),
    (
        'mod_002',
        'profile_789',
        'PROFILE_CONTENT',
        'cmj5rr8hh0000ob071iayp5l8',
        'Hot single looking for sugar daddy. Contact me for money.',
        0.65,
        'PENDING',
        'ALLOW',
        NULL,
        0.78,
        'user-service',
        NOW() - INTERVAL '5 hours',
        NOW()
    ),
    (
        'mod_003',
        'msg_12346',
        'TEXT_MESSAGE',
        'cmj7nmz8x0001o807gs1js32a',
        'Click here to win $1000! Visit my website now!',
        0.72,
        'REVIEWED',
        'BLOCK',
        'Spam content detected',
        0.88,
        'communication-service',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '20 hours'
    ),
    (
        'mod_004',
        'msg_12347',
        'TEXT_MESSAGE',
        'cmj8zcl3y0000mr07ykrk4zwl',
        'I am actually 16 years old, please do not tell anyone.',
        0.45,
        'ESCALATED',
        'ESCALATE',
        'Potential underage user',
        0.95,
        'communication-service',
        NOW() - INTERVAL '30 minutes',
        NOW() - INTERVAL '15 minutes'
    ),
    (
        'mod_005',
        'msg_12348',
        'TEXT_MESSAGE',
        'cmj4biaju0002qo080yfieca6',
        'All [racial slur] should go back to their country!',
        0.95,
        'PENDING',
        'ALLOW',
        NULL,
        0.98,
        'communication-service',
        NOW() - INTERVAL '4 hours',
        NOW()
    ),
    (
        'mod_006',
        'image_456',
        'IMAGE',
        'cmj499c460001qo08mon3f4sw',
        NULL,
        0.88,
        'PENDING',
        'ALLOW',
        NULL,
        0.91,
        'user-service',
        NOW() - INTERVAL '1 hour',
        NOW()
    ),
    (
        'mod_007',
        'msg_12349',
        'TEXT_MESSAGE',
        'cmj7nm9rm0000o807ghqs78eh',
        'Hey beautiful, want to meet up tonight? I have money.',
        0.55,
        'REVIEWED',
        'WARN',
        'Inappropriate solicitation',
        0.73,
        'communication-service',
        NOW() - INTERVAL '6 hours',
        NOW() - INTERVAL '3 hours'
    ),
    (
        'mod_008',
        'voice_123',
        'VOICE_NOTE',
        'cmja5xul70000rs071y5d3fbf',
        NULL,
        0.78,
        'PENDING',
        'ALLOW',
        NULL,
        0.82,
        'communication-service',
        NOW() - INTERVAL '3 hours',
        NOW()
    )
ON CONFLICT (id) DO NOTHING;

-- Seed User Safety Profiles
INSERT INTO user_safety_profiles (
    id, "userId", "totalViolations", "severViolations", "recentViolations",
    "isBanned", "isMuted", "isRestricted", "trustScore", "lastTrustUpdate",
    "canSendMessages", "canSendVoiceNotes", "canSendImages", "canCreateRooms",
    "moderationLevel", "flagForReview", "createdAt", "updatedAt"
) VALUES 
    (
        'safety_001',
        'cmj48wfp40000qo08l6rkkn0e',
        1, 0, 1,
        false, false, false,
        75.0, NOW() - INTERVAL '2 hours',
        true, true, true, true,
        'ENHANCED', true,
        NOW() - INTERVAL '30 days', NOW()
    ),
    (
        'safety_002',
        'cmj5rr8hh0000ob071iayp5l8',
        3, 1, 2,
        false, true, true,
        45.0, NOW() - INTERVAL '1 hour',
        false, false, true, false,
        'STRICT', true,
        NOW() - INTERVAL '25 days', NOW()
    ),
    (
        'safety_003',
        'cmj7nmz8x0001o807gs1js32a',
        2, 1, 1,
        true, false, false,
        25.0, NOW() - INTERVAL '20 hours',
        false, false, false, false,
        'MANUAL', false,
        NOW() - INTERVAL '20 days', NOW()
    ),
    (
        'safety_004',
        'cmj8zcl3y0000mr07ykrk4zwl',
        0, 0, 0,
        false, false, false,
        90.0, NOW() - INTERVAL '1 day',
        true, true, true, true,
        'STANDARD', false,
        NOW() - INTERVAL '15 days', NOW()
    ),
    (
        'safety_005',
        'cmj4biaju0002qo080yfieca6',
        1, 1, 1,
        false, false, true,
        55.0, NOW() - INTERVAL '4 hours',
        true, true, false, true,
        'ENHANCED', true,
        NOW() - INTERVAL '12 days', NOW()
    )
ON CONFLICT (id) DO NOTHING;

-- Seed User Violations
INSERT INTO user_violations (
    id, "userId", "moderationRecordId", "violationType", severity,
    description, "actionTaken", "actionDuration", "actionExpiresAt",
    "isAppealed", "createdAt"
) VALUES 
    (
        'viol_001',
        'cmj48wfp40000qo08l6rkkn0e',
        'mod_001',
        'HARASSMENT',
        'MEDIUM',
        'Sent abusive message to another user',
        'Warning issued',
        NULL, NULL,
        false,
        NOW() - INTERVAL '2 hours'
    ),
    (
        'viol_002',
        'cmj5rr8hh0000ob071iayp5l8',
        'mod_002',
        'INAPPROPRIATE_CONTENT',
        'HIGH',
        'Profile contains solicitation content',
        'Account restricted',
        72, NOW() + INTERVAL '70 hours',
        false,
        NOW() - INTERVAL '5 hours'
    ),
    (
        'viol_003',
        'cmj7nmz8x0001o807gs1js32a',
        'mod_003',
        'SPAM',
        'HIGH',
        'Posted promotional spam content',
        'Account banned',
        168, NOW() + INTERVAL '164 hours',
        true,
        NOW() - INTERVAL '1 day'
    ),
    (
        'viol_004',
        'cmj4biaju0002qo080yfieca6',
        'mod_005',
        'HATE_SPEECH',
        'CRITICAL',
        'Posted racist hate speech',
        'Under review',
        NULL, NULL,
        false,
        NOW() - INTERVAL '4 hours'
    )
ON CONFLICT (id) DO NOTHING;

-- Seed Admin Alerts
INSERT INTO admin_alerts (
    id, type, severity, title, description,
    "userId", "contentId", "moderationRecordId",
    status, metadata, "createdAt", "updatedAt"
) VALUES 
    (
        'alert_001',
        'HIGH_TOXICITY',
        'HIGH',
        'High Toxicity Content Detected',
        'Message with toxicity score 0.95 requires immediate review',
        'cmj4biaju0002qo080yfieca6',
        'msg_12348',
        'mod_005',
        'PENDING',
        '{"toxicity_score": 0.95, "confidence": 0.98}',
        NOW() - INTERVAL '4 hours',
        NOW()
    ),
    (
        'alert_002',
        'REPEATED_VIOLATIONS',
        'CRITICAL',
        'User with Multiple Violations',
        'User has 3 violations in the last 24 hours',
        'cmj5rr8hh0000ob071iayp5l8',
        NULL,
        NULL,
        'PENDING',
        '{"violation_count": 3, "timeframe": "24h"}',
        NOW() - INTERVAL '1 hour',
        NOW()
    ),
    (
        'alert_003',
        'APPEAL_SUBMITTED',
        'MEDIUM',
        'User Appeal Submitted',
        'User has appealed their ban decision',
        'cmj7nmz8x0001o807gs1js32a',
        'msg_12346',
        'mod_003',
        'ASSIGNED',
        '{"appeal_reason": "Content was taken out of context"}',
        NOW() - INTERVAL '12 hours',
        NOW() - INTERVAL '6 hours'
    )
ON CONFLICT (id) DO NOTHING;

SELECT 'Moderation database seeded successfully!' as status,
       (SELECT COUNT(*) FROM moderation_records) as moderation_records,
       (SELECT COUNT(*) FROM user_safety_profiles) as safety_profiles,
       (SELECT COUNT(*) FROM user_violations) as violations,
       (SELECT COUNT(*) FROM admin_alerts) as alerts;