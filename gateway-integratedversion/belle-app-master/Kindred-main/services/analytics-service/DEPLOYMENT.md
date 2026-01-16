# Analytics Platform Deployment Guide

## Overview

This document provides comprehensive instructions for deploying the Real-time Connect Analytics Platform to production. The platform consists of a hybrid analytics architecture combining Mixpanel for product analytics with a custom business intelligence backend.

## Architecture Components

- **Analytics API Service**: Express.js API serving analytics data
- **ETL Pipeline Service**: Automated data processing and aggregation
- **PostgreSQL Database**: Data warehouse for analytics storage
- **Redis Cache**: High-performance caching layer
- **Grafana**: Analytics dashboards and visualization
- **Prometheus**: Metrics collection and monitoring

## Prerequisites

### System Requirements
- Docker Engine 20.10+
- Docker Compose 2.0+
- Minimum 8GB RAM
- 100GB+ storage for data retention
- Ubuntu 20.04+ or similar Linux distribution

### External Dependencies
- Mixpanel Project Token and API Secret
- SMTP server for alerting (optional)
- SSL certificates for production (recommended)

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd services/analytics-service
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.production .env.production.local

# Edit configuration with your values
nano .env.production.local
```

**Required Configuration:**
- `MIXPANEL_TOKEN`: Your Mixpanel project token
- `MIXPANEL_SECRET`: Your Mixpanel API secret
- `POSTGRES_PASSWORD`: Secure database password
- `JWT_SECRET`: Secure JWT signing key
- `ENCRYPTION_KEY`: Data encryption key

### 3. Deploy Platform

```bash
# Make deployment script executable
chmod +x deploy.sh

# Deploy to production
./deploy.sh production
```

### 4. Verify Deployment

Check service health:
```bash
# Analytics API
curl http://localhost:3008/health

# ETL Pipeline
curl http://localhost:3010/health

# Grafana
open http://localhost:3001
```

## Detailed Configuration

### Database Configuration

The analytics platform uses PostgreSQL as the primary data warehouse:

```yaml
# Core database settings
DATABASE_URL: PostgreSQL connection string
POSTGRES_USER: Database username
POSTGRES_PASSWORD: Secure password
POSTGRES_DB: Database name
```

**Performance Tuning:**
```sql
-- Recommended PostgreSQL settings for analytics workload
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 256MB
maintenance_work_mem = 1GB
checkpoint_completion_target = 0.9
wal_buffers = 64MB
```

### ETL Pipeline Configuration

The ETL pipeline runs scheduled jobs for data processing:

```yaml
# Schedule configuration (cron format)
ETL_SCHEDULE_DAILY: "0 2 * * *"    # Daily at 2 AM
ETL_SCHEDULE_HOURLY: "0 * * * *"   # Every hour
ETL_BATCH_SIZE: 1000               # Records per batch
ETL_MAX_RETRIES: 3                 # Retry attempts
```

**Processing Jobs:**
- **Daily KPI Aggregation**: User metrics, revenue, engagement
- **Hourly Behavior Analysis**: Session data, interaction patterns
- **Weekly Retention Cohorts**: User retention calculations
- **Data Quality Checks**: Validation and cleanup

### API Configuration

The Analytics API provides REST endpoints for dashboard consumption:

```yaml
# API settings
API_PORT: 3008                     # Service port
API_RATE_LIMIT_WINDOW: 900000      # 15 minutes
API_RATE_LIMIT_MAX: 100            # Max requests per window
CACHE_TTL: 300                     # 5 minutes cache
```

**Available Endpoints:**
- `GET /kpis/overview` - High-level KPI summary
- `GET /kpis/retention` - User retention metrics
- `GET /kpis/revenue` - Revenue and monetization data
- `GET /kpis/user-behavior` - Behavioral analytics
- `GET /kpis/funnel` - Conversion funnel analysis

### Monitoring Configuration

Comprehensive monitoring with Grafana and Prometheus:

```yaml
# Monitoring settings
GRAFANA_ADMIN_PASSWORD: admin123   # Change in production
PROMETHEUS_RETENTION: 30d          # Metrics retention
```

**Pre-configured Dashboards:**
- Analytics Platform Overview
- ETL Pipeline Performance
- API Response Times
- Database Performance
- System Resource Usage

## Production Deployment

### Security Considerations

1. **Environment Variables**: Use secure secrets management
2. **Database Security**: Enable SSL, restrict access
3. **API Security**: Implement authentication/authorization
4. **Network Security**: Use private networks, firewalls
5. **Data Encryption**: Encrypt sensitive data at rest

### Scaling Considerations

**Horizontal Scaling:**
```yaml
# Docker Compose scaling
docker-compose up --scale analytics-api=3
docker-compose up --scale analytics-etl=2
```

**Database Scaling:**
- Read replicas for analytics queries
- Partitioning for large fact tables
- Connection pooling optimization

**Cache Optimization:**
- Redis cluster for high availability
- Application-level caching strategies
- CDN for static dashboard assets

### Backup Strategy

**Automated Backups:**
```bash
# Database backup (daily)
pg_dump analytics > backup_$(date +%Y%m%d).sql

# Grafana configuration backup
tar -czf grafana_backup.tar.gz /var/lib/grafana

# Redis data backup
redis-cli BGSAVE
```

**Backup Retention:**
- Daily backups: 30 days
- Weekly backups: 12 weeks
- Monthly backups: 12 months

## Troubleshooting

### Common Issues

**ETL Pipeline Failures:**
```bash
# Check ETL logs
docker-compose logs analytics-etl

# Restart ETL service
docker-compose restart analytics-etl

# Manual ETL trigger
docker-compose exec analytics-etl npm run etl:daily
```

**API Performance Issues:**
```bash
# Check API logs
docker-compose logs analytics-api

# Monitor Redis cache
docker-compose exec analytics-redis redis-cli info

# Database query analysis
docker-compose exec analytics-db psql -U analytics -c "SELECT * FROM pg_stat_activity;"
```

**Database Connection Issues:**
```bash
# Test database connectivity
docker-compose exec analytics-api npx prisma db push

# Check database status
docker-compose exec analytics-db pg_isready
```

### Performance Optimization

**Query Optimization:**
```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_daily_kpi_date ON daily_kpi_summary(date);
CREATE INDEX CONCURRENTLY idx_user_events_timestamp ON user_events(timestamp);
```

**Cache Warming:**
```bash
# Warm cache with common queries
curl http://localhost:3008/kpis/overview
curl http://localhost:3008/kpis/retention
```

### Monitoring and Alerting

**Health Checks:**
```bash
# Automated health monitoring
curl -f http://localhost:3008/health || alert "Analytics API down"
curl -f http://localhost:3010/health || alert "ETL Pipeline down"
```

**Performance Metrics:**
- API response times < 500ms
- ETL job completion rates > 99%
- Database query performance
- Memory and CPU utilization

## Maintenance

### Regular Maintenance Tasks

**Daily:**
- Monitor ETL job completion
- Check API error rates
- Verify backup completion

**Weekly:**
- Review performance metrics
- Update Grafana dashboards
- Analyze data quality reports

**Monthly:**
- Database maintenance (VACUUM, ANALYZE)
- Security updates
- Capacity planning review

### Updates and Upgrades

**Rolling Updates:**
```bash
# Update Analytics API
docker-compose build analytics-api
docker-compose up -d --no-deps analytics-api

# Update ETL Pipeline
docker-compose build analytics-etl
docker-compose up -d --no-deps analytics-etl
```

**Database Migrations:**
```bash
# Apply Prisma migrations
docker-compose exec analytics-api npx prisma migrate deploy

# Generate new Prisma client
docker-compose exec analytics-api npx prisma generate
```

## Support and Documentation

### Additional Resources

- [API Documentation](./swagger/index.html)
- [Database Schema](./prisma/schema.prisma)
- [Monitoring Dashboards](./monitoring/grafana/)
- [Performance Guidelines](../../shared/PERFORMANCE.md)

### Contact Information

For technical support and questions:
- Development Team: dev-team@company.com
- Infrastructure Team: infrastructure@company.com
- On-call Support: +1-XXX-XXX-XXXX

---

**Version**: 1.0.0  
**Last Updated**: $(date +%Y-%m-%d)  
**Environment**: Production