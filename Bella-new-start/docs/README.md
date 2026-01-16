# Kindred Backend Documentation

Welcome to the Kindred backend documentation. This guide will help you understand, set up, and test the microservices.

## Quick Start

1. **Setup** → [Getting Started Guide](./setup/GETTING_STARTED.md)
2. **Test APIs** → [API Testing](./api-tests/README.md)
3. **Troubleshoot** → [Common Issues](./troubleshooting/COMMON_ISSUES.md)

## Documentation Structure

```
docs/
├── setup/              # Setup and deployment guides
├── api-tests/          # API endpoint testing guides
├── architecture/       # System architecture docs
└── troubleshooting/    # Common issues and solutions
```

## Services Overview

| Service | Port | Status | Purpose |
|---------|------|--------|---------|
| User Service | 3001 | ✅ Running | Authentication, profiles, safety |
| Queuing Service | 3002 | ✅ Running | Matching algorithm, queue management |
| Subscription Service | 3010 | ✅ Running | Plans, billing, payments |
| GraphQL Gateway | 4000 | ⏳ Pending | Unified API gateway |

## Quick Links

- [Services Status](./setup/SERVICES_STATUS.md) ⭐
- [User Service API](./api-tests/USER_SERVICE.md)
- [Queuing Service API](./api-tests/QUEUING_SERVICE.md)
- [Subscription Service API](./api-tests/SUBSCRIPTION_SERVICE.md)
- [Getting Started](./setup/GETTING_STARTED.md)
