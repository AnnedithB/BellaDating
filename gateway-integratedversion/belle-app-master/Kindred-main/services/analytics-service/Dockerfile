# Analytics Service Dockerfile
FROM node:18-alpine AS base

# Install dependencies for building native packages
RUN apk add --no-cache libc6-compat

# Create app directory
WORKDIR /app

# Install shared dependencies
COPY shared/package*.json ./shared/
RUN cd shared && npm ci --only=production && npm cache clean --force

# Install analytics service dependencies
COPY services/analytics-service/package*.json ./services/analytics-service/
RUN cd services/analytics-service && npm ci --only=production && npm cache clean --force

# Copy source code
COPY shared/ ./shared/
COPY services/analytics-service/ ./services/analytics-service/

# Build shared modules
WORKDIR /app/shared
RUN npm run build

# Build analytics service
WORKDIR /app/services/analytics-service
RUN npm run build

# Generate Prisma client
RUN npx prisma generate

# Production stage
FROM node:18-alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S analytics && \
    adduser -S analytics -u 1001

# Create app directory
WORKDIR /app

# Copy built application
COPY --from=base --chown=analytics:analytics /app /app

# Switch to non-root user
USER analytics

# Expose port
EXPOSE 3008

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3008/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3008

# Start the application
CMD ["node", "services/analytics-service/dist/index.js"]