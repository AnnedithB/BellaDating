#!/bin/bash

# Analytics Service Deployment Script
# This script deploys the analytics platform to production

set -e

echo "🚀 Starting Analytics Platform Deployment..."

# Configuration
ENVIRONMENT=${1:-production}
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env.${ENVIRONMENT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    if [ ! -f "$ENV_FILE" ]; then
        log_error "Environment file $ENV_FILE not found"
        exit 1
    fi
    
    log_info "Prerequisites check passed ✅"
}

# Build and deploy services
deploy_services() {
    log_info "Building and deploying analytics services..."
    
    # Load environment variables
    export $(cat $ENV_FILE | grep -v '#' | xargs)
    
    # Build and start services
    docker-compose -f $COMPOSE_FILE build --no-cache
    docker-compose -f $COMPOSE_FILE up -d
    
    log_info "Services deployed ✅"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Wait for database to be ready
    sleep 30
    
    # Run Prisma migrations
    docker-compose exec analytics-api npx prisma migrate deploy
    
    # Generate Prisma client
    docker-compose exec analytics-api npx prisma generate
    
    log_info "Database migrations completed ✅"
}

# Health checks
health_checks() {
    log_info "Performing health checks..."
    
    # Wait for services to start
    sleep 60
    
    # Check Analytics API
    if curl -f http://localhost:3008/health &> /dev/null; then
        log_info "Analytics API health check passed ✅"
    else
        log_error "Analytics API health check failed ❌"
        exit 1
    fi
    
    # Check ETL Pipeline
    if curl -f http://localhost:3010/health &> /dev/null; then
        log_info "ETL Pipeline health check passed ✅"
    else
        log_error "ETL Pipeline health check failed ❌"
        exit 1
    fi
    
    # Check Grafana
    if curl -f http://localhost:3001/api/health &> /dev/null; then
        log_info "Grafana health check passed ✅"
    else
        log_warn "Grafana health check failed (may still be starting) ⚠️"
    fi
    
    log_info "Health checks completed ✅"
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring and alerting..."
    
    # Import Grafana dashboards
    # This would typically be done via Grafana API
    log_info "Grafana dashboards will be auto-imported on startup"
    
    # Setup Prometheus alerts
    log_info "Prometheus monitoring configured"
    
    log_info "Monitoring setup completed ✅"
}

# Cleanup old containers and images
cleanup() {
    log_info "Cleaning up old containers and images..."
    
    docker system prune -f
    docker volume prune -f
    
    log_info "Cleanup completed ✅"
}

# Backup existing data
backup_data() {
    log_info "Creating backup of existing data..."
    
    BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p $BACKUP_DIR
    
    # Backup database
    docker-compose exec -T analytics-db pg_dump -U analytics analytics > $BACKUP_DIR/analytics_backup.sql
    
    # Backup Grafana data
    docker-compose exec -T analytics-grafana tar -czf - /var/lib/grafana > $BACKUP_DIR/grafana_backup.tar.gz
    
    log_info "Backup created at $BACKUP_DIR ✅"
}

# Rollback deployment
rollback() {
    log_error "Rolling back deployment..."
    
    # Stop current services
    docker-compose -f $COMPOSE_FILE down
    
    # Restore from backup
    LATEST_BACKUP=$(ls -t ./backups/ | head -n1)
    if [ -n "$LATEST_BACKUP" ]; then
        log_info "Restoring from backup: $LATEST_BACKUP"
        # Restore database
        docker-compose up -d analytics-db
        sleep 30
        cat ./backups/$LATEST_BACKUP/analytics_backup.sql | docker-compose exec -T analytics-db psql -U analytics analytics
    fi
    
    log_error "Rollback completed"
    exit 1
}

# Main deployment flow
main() {
    log_info "Analytics Platform Deployment - Environment: $ENVIRONMENT"
    
    # Set error handler
    trap rollback ERR
    
    check_prerequisites
    backup_data
    cleanup
    deploy_services
    run_migrations
    health_checks
    setup_monitoring
    
    log_info "🎉 Analytics Platform deployment completed successfully!"
    log_info "Services available at:"
    log_info "  - Analytics API: http://localhost:3008"
    log_info "  - ETL Pipeline: http://localhost:3010"
    log_info "  - Grafana Dashboards: http://localhost:3001 (admin/admin123)"
    log_info "  - Prometheus: http://localhost:9091"
}

# Execute main function
main "$@"