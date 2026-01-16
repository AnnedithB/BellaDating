# Customer Support & Ticketing System API Documentation

## Overview
The customer support system provides a complete ticketing infrastructure for handling customer inquiries, managing knowledge base articles, and providing self-service support options.

## Base URLs
- **Admin Service**: `http://localhost:3007/api`
- **Customer Support**: `http://localhost:3007/api/customer-support`

## Authentication
- **Admin Endpoints**: Require JWT token in Authorization header: `Bearer <token>`
- **Customer Endpoints**: Public access or email verification for ticket updates

---

## Support Tickets Management (Admin)

### GET /api/support-tickets
Get all support tickets with filtering and pagination.

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Query Parameters:**
- `status` (optional): Filter by status (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
- `priority` (optional): Filter by priority (LOW, MEDIUM, HIGH, URGENT)
- `category` (optional): Filter by category (GENERAL, TECHNICAL, BILLING, ACCOUNT, CONTENT, SAFETY)
- `assignedTo` (optional): Filter by assigned admin ID
- `search` (optional): Search in title, description, or ticket number
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "ticketNumber": "TIK-1234567890-ABC12",
      "title": "Login Issues",
      "description": "Cannot log into my account",
      "category": "ACCOUNT",
      "priority": "HIGH",
      "status": "OPEN",
      "userEmail": "user@example.com",
      "userName": "John Doe",
      "assignedToId": "admin-uuid",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      "lastActivityAt": "2024-01-01T00:00:00Z",
      "assignedTo": {
        "id": "admin-uuid",
        "firstName": "Admin",
        "lastName": "User",
        "email": "admin@company.com"
      },
      "comments": [
        {
          "id": "comment-uuid",
          "content": "Thank you for contacting us...",
          "isFromCustomer": false,
          "isInternal": false,
          "createdAt": "2024-01-01T00:00:00Z"
        }
      ],
      "attachments": [
        {
          "id": "attachment-uuid",
          "fileName": "screenshot.png",
          "fileSize": 1024000,
          "mimeType": "image/png",
          "createdAt": "2024-01-01T00:00:00Z"
        }
      ],
      "_count": {
        "comments": 3,
        "attachments": 1
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

### GET /api/support-tickets/:id
Get a specific ticket by ID.

**Response:** Single ticket object with full details.

### POST /api/support-tickets
Create a new support ticket (admin-created).

**Request Body:**
```json
{
  "title": "Customer Issue Title",
  "description": "Detailed description of the issue",
  "category": "TECHNICAL",
  "priority": "HIGH",
  "userEmail": "customer@example.com",
  "userName": "Customer Name",
  "assignedToId": "admin-uuid" // optional
}
```

### PUT /api/support-tickets/:id
Update ticket details.

**Request Body:**
```json
{
  "title": "Updated Title",
  "priority": "URGENT",
  "category": "BILLING",
  "assignedToId": "new-admin-uuid"
}
```

### PATCH /api/support-tickets/:id/status
Update ticket status.

**Request Body:**
```json
{
  "status": "RESOLVED",
  "resolutionNote": "Issue resolved by clearing cache"
}
```

### POST /api/support-tickets/:id/assign
Assign ticket to admin.

**Request Body:**
```json
{
  "assignedToId": "admin-uuid"
}
```

### POST /api/support-tickets/:id/escalate
Escalate ticket priority.

**Request Body:**
```json
{
  "priority": "URGENT",
  "escalationReason": "Customer is premium user"
}
```

### POST /api/support-tickets/:id/comments
Add comment to ticket.

**Request Body (with file upload):**
```json
{
  "content": "Response to customer inquiry",
  "isInternal": false
}
```

**File Upload:** Use `attachments` field (max 5 files, 10MB each)

### DELETE /api/support-tickets/:id
Delete a ticket (admin only).

### GET /api/support-tickets/analytics/dashboard
Get support ticket analytics dashboard.

**Response:**
```json
{
  "status": "success",
  "data": {
    "overview": {
      "totalTickets": 1250,
      "openTickets": 45,
      "resolvedToday": 23,
      "avgResponseTime": 2.5,
      "avgResolutionTime": 24.3
    },
    "statusDistribution": [
      { "status": "OPEN", "count": 45 },
      { "status": "IN_PROGRESS", "count": 32 }
    ],
    "priorityDistribution": [
      { "priority": "HIGH", "count": 15 },
      { "priority": "MEDIUM", "count": 62 }
    ],
    "categoryStats": [
      { "category": "TECHNICAL", "count": 89, "avgResolutionHours": 18.5 }
    ],
    "agentWorkload": [
      {
        "adminId": "uuid",
        "firstName": "John",
        "lastName": "Doe",
        "openTickets": 8,
        "avgResponseTime": 1.5
      }
    ],
    "recentActivity": [
      {
        "id": "uuid",
        "ticketNumber": "TIK-123",
        "title": "Login Issue",
        "action": "Status changed to Resolved",
        "timestamp": "2024-01-01T12:00:00Z"
      }
    ]
  }
}
```

---

## Knowledge Base Management (Admin)

### GET /api/knowledge-base
Get all knowledge base articles.

**Query Parameters:**
- `category` (optional): Filter by category
- `published` (optional): Filter by publication status
- `search` (optional): Search in title, content, summary
- `page` (optional): Page number
- `limit` (optional): Items per page

### GET /api/knowledge-base/:id
Get specific article by ID.

### POST /api/knowledge-base
Create new knowledge base article.

**Request Body:**
```json
{
  "title": "How to Reset Your Password",
  "content": "Step-by-step guide content in markdown...",
  "summary": "Quick guide to reset your account password",
  "category": "Account",
  "tags": ["password", "reset", "account"],
  "searchKeywords": ["password", "forgot", "reset", "login"],
  "isPublished": true
}
```

### PUT /api/knowledge-base/:id
Update existing article.

### PATCH /api/knowledge-base/:id/publish
Publish or unpublish article.

**Request Body:**
```json
{
  "isPublished": true
}
```

### DELETE /api/knowledge-base/:id
Delete article.

### POST /api/knowledge-base/:id/vote
Vote on article helpfulness (public endpoint).

**Request Body:**
```json
{
  "helpful": true
}
```

### GET /api/knowledge-base/analytics/overview
Get knowledge base analytics.

---

## Customer Support (Public API)

### POST /api/customer-support/submit
Submit a new support ticket.

**Request Body (multipart/form-data):**
```json
{
  "title": "Cannot access my account",
  "description": "I've been trying to log in but getting error messages",
  "category": "ACCOUNT",
  "priority": "MEDIUM",
  "userEmail": "customer@example.com",
  "userName": "John Customer"
}
```

**File Upload:** Use `attachments` field (max 5 files, 10MB each)

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "ticket-uuid",
    "ticketNumber": "CUS-1234567890-ABC12",
    "title": "Cannot access my account",
    "status": "OPEN",
    "createdAt": "2024-01-01T00:00:00Z",
    "attachments": [
      {
        "id": "attachment-uuid",
        "fileName": "error_screenshot.png",
        "fileSize": 524288,
        "mimeType": "image/png"
      }
    ]
  },
  "message": "Ticket submitted successfully. You will receive an email confirmation shortly."
}
```

### GET /api/customer-support/status/:ticketNumber
Get ticket status by ticket number.

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "ticket-uuid",
    "ticketNumber": "CUS-1234567890-ABC12",
    "title": "Cannot access my account",
    "description": "I've been trying to log in...",
    "category": "ACCOUNT",
    "priority": "MEDIUM",
    "status": "IN_PROGRESS",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T06:00:00Z",
    "comments": [
      {
        "id": "comment-uuid",
        "content": "Thank you for contacting us. We're looking into your issue.",
        "createdAt": "2024-01-01T02:00:00Z",
        "isFromCustomer": false
      },
      {
        "id": "comment-uuid-2",
        "content": "I tried the suggested steps but still having issues.",
        "createdAt": "2024-01-01T04:00:00Z",
        "isFromCustomer": true
      }
    ],
    "attachments": [
      {
        "id": "attachment-uuid",
        "fileName": "error_screenshot.png",
        "fileSize": 524288,
        "mimeType": "image/png",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

### POST /api/customer-support/:ticketNumber/respond
Add customer response to ticket.

**Request Body (multipart/form-data):**
```json
{
  "content": "I tried your suggestions but still having the same issue.",
  "customerEmail": "customer@example.com"
}
```

**File Upload:** Use `attachments` field (max 3 files, 10MB each)

### GET /api/customer-support/help/articles
Get published knowledge base articles (public).

**Query Parameters:**
- `category` (optional): Filter by category
- `search` (optional): Search articles
- `page` (optional): Page number
- `limit` (optional): Items per page (max 20)

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "article-uuid",
      "title": "How to Reset Your Password",
      "summary": "Step-by-step guide to reset your password",
      "category": "Account",
      "tags": ["password", "reset"],
      "slug": "how-to-reset-your-password",
      "helpfulVotes": 45,
      "notHelpfulVotes": 3,
      "viewCount": 1250,
      "publishedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3,
    "categories": [
      { "category": "Account", "count": 8 },
      { "category": "Technical", "count": 12 }
    ]
  }
}
```

### GET /api/customer-support/help/articles/:slug
Get specific knowledge base article by slug.

### POST /api/customer-support/help/articles/:id/vote
Vote on article helpfulness.

### GET /api/customer-support/categories
Get available ticket categories.

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "value": "GENERAL",
      "label": "General Inquiry",
      "description": "General questions about our service"
    },
    {
      "value": "TECHNICAL",
      "label": "Technical Issue",
      "description": "App crashes, bugs, or technical problems"
    },
    {
      "value": "BILLING",
      "label": "Billing & Payments",
      "description": "Questions about subscriptions, payments, or refunds"
    },
    {
      "value": "ACCOUNT",
      "label": "Account Issues",
      "description": "Login problems, account settings, or profile issues"
    },
    {
      "value": "CONTENT",
      "label": "Content & Matching",
      "description": "Issues with matches, profiles, or content moderation"
    },
    {
      "value": "SAFETY",
      "label": "Safety & Security",
      "description": "Report abuse, harassment, or safety concerns"
    }
  ]
}
```

---

## Error Responses

All endpoints return structured error responses:

```json
{
  "status": "error",
  "message": "Description of the error",
  "errors": [
    {
      "field": "title",
      "message": "Title is required"
    }
  ]
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `401`: Unauthorized
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error

---

## File Upload Specifications

**Supported File Types:**
- Images: JPEG, PNG, GIF
- Documents: PDF, TXT, DOC, DOCX

**File Size Limits:**
- Admin uploads: 10MB per file, max 5 files
- Customer uploads: 10MB per file, max 5 files (ticket submission), max 3 files (responses)

**Upload Directories:**
- Admin tickets: `uploads/support-tickets/`
- Customer tickets: `uploads/customer-tickets/`

---

## Permissions Required

**Admin Permissions:**
- `support_tickets.read`: View tickets
- `support_tickets.write`: Create/update tickets
- `support_tickets.assign`: Assign tickets to agents
- `support_tickets.delete`: Delete tickets
- `knowledge_base.read`: View KB articles
- `knowledge_base.write`: Create/edit KB articles
- `knowledge_base.publish`: Publish/unpublish articles

---

## Rate Limits

- **Admin endpoints**: 100 requests per 15 minutes per IP
- **Customer endpoints**: 50 requests per 15 minutes per IP
- **File uploads**: 10 uploads per hour per IP

---

## Integration Examples

### Frontend Ticket Submission Form
```javascript
const submitTicket = async (formData) => {
  const response = await fetch('/api/customer-support/submit', {
    method: 'POST',
    body: formData // FormData with files
  });
  
  const result = await response.json();
  if (result.status === 'success') {
    alert(`Ticket created: ${result.data.ticketNumber}`);
  }
};
```

### Admin Dashboard Integration
```javascript
const getTicketAnalytics = async () => {
  const response = await fetch('/api/support-tickets/analytics/dashboard', {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });
  
  const analytics = await response.json();
  return analytics.data;
};
```

This completes the comprehensive customer support and ticketing system implementation with full API documentation.