-- Seed User Reports for Moderation Queue
-- Using real user IDs from users database
INSERT INTO user_reports (id, "reporterUserId", "reportedUserId", "reportType", reason, description, status, priority, "createdAt", "updatedAt")
VALUES 
    ('report_001', 'cmj48wfp40000qo08l6rkkn0e', 'cmj499c460001qo08mon3f4sw', 'HARASSMENT', 'Inappropriate messages', 'User sent offensive messages during conversation.', 'PENDING', 'HIGH', NOW() - INTERVAL '2 hours', NOW()),
    ('report_002', 'cmj4biaju0002qo080yfieca6', 'cmj5rr8hh0000ob071iayp5l8', 'FAKE_PROFILE', 'Suspicious profile', 'Profile photos appear to be stolen from celebrity.', 'PENDING', 'MEDIUM', NOW() - INTERVAL '5 hours', NOW()),
    ('report_003', 'cmj7nm9rm0000o807ghqs78eh', 'cmj7nmz8x0001o807gs1js32a', 'SPAM', 'Promotional content', 'User promoting external websites and asking for money.', 'IN_REVIEW', 'HIGH', NOW() - INTERVAL '1 day', NOW()),
    ('report_004', 'cmj8xvqoi0000qn062ett2d9i', 'cmj8zcl3y0000mr07ykrk4zwl', 'INAPPROPRIATE_BEHAVIOR', 'Rude behavior', 'User was extremely rude and made inappropriate comments.', 'PENDING', 'MEDIUM', NOW() - INTERVAL '3 hours', NOW()),
    ('report_005', 'cmja5xul70000rs071y5d3fbf', 'cmj48wfp40000qo08l6rkkn0e', 'UNDERAGE', 'Possible minor', 'User claims to be 18 but appears much younger in video.', 'ESCALATED', 'URGENT', NOW() - INTERVAL '30 minutes', NOW()),
    ('report_006', 'cmj499c460001qo08mon3f4sw', 'cmj4biaju0002qo080yfieca6', 'HATE_SPEECH', 'Discriminatory language', 'User made racist comments during conversation.', 'PENDING', 'HIGH', NOW() - INTERVAL '4 hours', NOW()),
    ('report_007', 'cmj5rr8hh0000ob071iayp5l8', 'cmj7nm9rm0000o807ghqs78eh', 'SEXUAL_CONTENT', 'Explicit content', 'User sent unsolicited explicit images.', 'IN_REVIEW', 'URGENT', NOW() - INTERVAL '1 hour', NOW()),
    ('report_008', 'cmj7nmz8x0001o807gs1js32a', 'cmj8xvqoi0000qn062ett2d9i', 'OTHER', 'Suspicious activity', 'User asked for personal financial information.', 'PENDING', 'MEDIUM', NOW() - INTERVAL '6 hours', NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed Support Tickets
-- Using real user IDs from users database
INSERT INTO support_tickets (id, "ticketNumber", subject, description, category, priority, status, "customerId", "customerEmail", "customerName", "createdAt", "updatedAt")
VALUES 
    ('ticket_001', 'TKT-2025-001', 'Cannot send messages', 'I am unable to send messages to my matches. The send button does not respond.', 'TECHNICAL', 'HIGH', 'OPEN', 'cmj48wfp40000qo08l6rkkn0e', 'john.doe@email.com', 'John Doe', NOW() - INTERVAL '3 hours', NOW()),
    ('ticket_002', 'TKT-2025-002', 'Billing issue with subscription', 'I was charged twice for my premium subscription this month.', 'BILLING', 'URGENT', 'IN_PROGRESS', 'cmj499c460001qo08mon3f4sw', 'jane.smith@email.com', 'Jane Smith', NOW() - INTERVAL '1 day', NOW()),
    ('ticket_003', 'TKT-2025-003', 'Account recovery', 'I forgot my password and cannot access my account.', 'ACCOUNT', 'MEDIUM', 'WAITING_FOR_CUSTOMER', 'cmj4biaju0002qo080yfieca6', 'mike.wilson@email.com', 'Mike Wilson', NOW() - INTERVAL '2 days', NOW()),
    ('ticket_004', 'TKT-2025-004', 'Report a safety concern', 'I matched with someone who is asking for money.', 'SAFETY', 'HIGH', 'OPEN', 'cmj5rr8hh0000ob071iayp5l8', 'sarah.jones@email.com', 'Sarah Jones', NOW() - INTERVAL '5 hours', NOW()),
    ('ticket_005', 'TKT-2025-005', 'Feature request: Video filters', 'It would be great to have beauty filters during video calls.', 'FEATURE_REQUEST', 'LOW', 'OPEN', 'cmj7nm9rm0000o807ghqs78eh', 'alex.brown@email.com', 'Alex Brown', NOW() - INTERVAL '1 week', NOW()),
    ('ticket_006', 'TKT-2025-006', 'App crashes on startup', 'The app crashes immediately after opening on my iPhone 15.', 'BUG_REPORT', 'HIGH', 'IN_PROGRESS', 'cmj7nmz8x0001o807gs1js32a', 'emma.davis@email.com', 'Emma Davis', NOW() - INTERVAL '4 hours', NOW()),
    ('ticket_007', 'TKT-2025-007', 'How to delete my account?', 'I want to permanently delete my account and all my data.', 'ACCOUNT', 'MEDIUM', 'OPEN', 'cmj8xvqoi0000qn062ett2d9i', 'chris.miller@email.com', 'Chris Miller', NOW() - INTERVAL '6 hours', NOW()),
    ('ticket_008', 'TKT-2025-008', 'Subscription cancellation', 'I want to cancel my VIP subscription before the next billing cycle.', 'BILLING', 'MEDIUM', 'RESOLVED', 'cmj8zcl3y0000mr07ykrk4zwl', 'lisa.taylor@email.com', 'Lisa Taylor', NOW() - INTERVAL '3 days', NOW())
ON CONFLICT (id) DO NOTHING;
