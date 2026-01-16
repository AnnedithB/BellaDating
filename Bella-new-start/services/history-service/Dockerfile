# ============================================================================
# STAGE 1: Dependencies
# ============================================================================
FROM node:18-alpine AS deps

WORKDIR /app

COPY shared/package*.json ./shared/
COPY services/history-service/package*.json ./services/history-service/

RUN cd shared && npm install --omit=dev --legacy-peer-deps && npm cache clean --force
RUN cd services/history-service && npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# ============================================================================
# STAGE 2: Builder
# ============================================================================
FROM node:18-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY shared/package*.json ./shared/
COPY services/history-service/package*.json ./services/history-service/

RUN cd shared && npm install --legacy-peer-deps
RUN cd services/history-service && npm install --legacy-peer-deps

COPY shared/ ./shared/
COPY services/history-service/src ./services/history-service/src
COPY services/history-service/prisma ./services/history-service/prisma
COPY services/history-service/tsconfig.json ./services/history-service/

RUN cd shared && npm run build || true
RUN cd services/history-service && npx prisma generate && npm run build

# ============================================================================
# STAGE 3: Production
# ============================================================================
FROM node:18-alpine AS production

RUN apk add --no-cache openssl wget dumb-init

WORKDIR /app

COPY --from=deps /app/shared/node_modules ./shared/node_modules
COPY --from=deps /app/services/history-service/node_modules ./services/history-service/node_modules

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/services/history-service/dist ./services/history-service/dist
COPY --from=builder /app/services/history-service/package.json ./services/history-service/package.json
COPY --from=builder /app/services/history-service/prisma ./services/history-service/prisma

# Copy generated Prisma client from builder
COPY --from=builder /app/services/history-service/node_modules/.prisma ./services/history-service/node_modules/.prisma
COPY --from=builder /app/services/history-service/node_modules/@prisma/client ./services/history-service/node_modules/@prisma/client

COPY services/history-service/docker-entrypoint.sh ./services/history-service/
RUN chmod +x ./services/history-service/docker-entrypoint.sh

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

WORKDIR /app/services/history-service
EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3004/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "docker-entrypoint.sh"]
