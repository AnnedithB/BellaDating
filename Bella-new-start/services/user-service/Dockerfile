# ============================================================================
# STAGE 1: Dependencies (Production Only)
# ============================================================================
FROM node:18-alpine AS deps

WORKDIR /app

COPY shared/package*.json ./shared/
COPY services/user-service/package*.json ./services/user-service/

# Install ONLY production dependencies
RUN cd shared && npm install --omit=dev --legacy-peer-deps && npm cache clean --force
RUN cd services/user-service && npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# ============================================================================
# STAGE 2: Builder (With Dev Dependencies for TypeScript)
# ============================================================================
FROM node:18-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY shared/package*.json ./shared/
COPY services/user-service/package*.json ./services/user-service/

# Install ALL dependencies (including devDependencies for TypeScript compilation)
RUN cd shared && npm install --legacy-peer-deps
RUN cd services/user-service && npm install --legacy-peer-deps

# Copy source code
COPY shared/ ./shared/
COPY services/user-service/src ./services/user-service/src
COPY services/user-service/prisma ./services/user-service/prisma
COPY services/user-service/tsconfig.json ./services/user-service/

# Build
RUN cd shared && npm run build || true
RUN cd services/user-service && npx prisma generate && npm run build

# ============================================================================
# STAGE 3: Production (Optimized)
# ============================================================================
FROM node:18-alpine AS production

RUN apk add --no-cache openssl wget dumb-init

WORKDIR /app

# Copy ONLY production node_modules from deps stage (not builder)
COPY --from=deps /app/shared/node_modules ./shared/node_modules
COPY --from=deps /app/services/user-service/node_modules ./services/user-service/node_modules

# Copy built artifacts from builder stage
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/services/user-service/dist ./services/user-service/dist
COPY --from=builder /app/services/user-service/package.json ./services/user-service/package.json
COPY --from=builder /app/services/user-service/prisma ./services/user-service/prisma

# Copy generated Prisma client from builder
COPY --from=builder /app/services/user-service/node_modules/.prisma ./services/user-service/node_modules/.prisma
COPY --from=builder /app/services/user-service/node_modules/@prisma/client ./services/user-service/node_modules/@prisma/client

# Copy entrypoint script
COPY services/user-service/docker-entrypoint.sh ./services/user-service/
RUN chmod +x ./services/user-service/docker-entrypoint.sh

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Create uploads directory with correct permissions
# This ensures the directory exists and has the right ownership before switching users
RUN mkdir -p /app/services/user-service/uploads && \
    chown -R nodejs:nodejs /app/services/user-service/uploads && \
    chmod -R 755 /app/services/user-service/uploads

RUN chown -R nodejs:nodejs /app
USER nodejs

WORKDIR /app/services/user-service
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "docker-entrypoint.sh"]
