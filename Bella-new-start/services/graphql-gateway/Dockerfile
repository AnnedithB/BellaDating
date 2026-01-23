# ============================================================================
# KINDRED - GraphQL Gateway Dockerfile
# ============================================================================
# Build context MUST be project root: docker build -f services/graphql-gateway/Dockerfile .
# ============================================================================

# ============================================================================
# STAGE 1: Dependencies & Build
# ============================================================================
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    openssl \
    libc6-compat \
    python3 \
    make \
    g++

WORKDIR /app

# ============================================================================
# Install shared library dependencies
# ============================================================================
COPY shared/package*.json ./shared/
RUN cd shared && npm install --only=production --legacy-peer-deps && npm cache clean --force

# ============================================================================
# Install service dependencies (including devDependencies for build)
# ============================================================================
COPY services/graphql-gateway/package*.json ./services/graphql-gateway/
RUN cd services/graphql-gateway && npm install --legacy-peer-deps && npm cache clean --force

# ============================================================================
# Copy source code
# ============================================================================
COPY shared/ ./shared/
COPY services/graphql-gateway/ ./services/graphql-gateway/

# ============================================================================
# Build shared library
# ============================================================================
WORKDIR /app/shared
RUN if [ -f package.json ] && grep -q '"build"' package.json; then \
        npm run build || true; \
    fi

# ============================================================================
# Build graphql-gateway
# ============================================================================
WORKDIR /app/services/graphql-gateway

# Build TypeScript
RUN npm run build

# ============================================================================
# STAGE 2: Production Runtime
# ============================================================================
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    wget \
    openssl \
    dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app /app

# Create necessary directories
RUN mkdir -p /app/services/graphql-gateway/logs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set working directory to service
WORKDIR /app/services/graphql-gateway

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4000/.well-known/apollo/server-health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start command
CMD ["node", "dist/server.js"]
