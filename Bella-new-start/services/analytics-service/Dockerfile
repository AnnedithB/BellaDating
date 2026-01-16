# ============================================================================
# STAGE 1: Dependencies
# ============================================================================
FROM node:18-alpine AS deps

WORKDIR /app

COPY shared/package*.json ./shared/
COPY services/analytics-service/package*.json ./services/analytics-service/

RUN cd shared && npm install --omit=dev --legacy-peer-deps --verbose 2>&1 | tail -20 && npm cache clean --force
RUN cd services/analytics-service && npm install --omit=dev --legacy-peer-deps --verbose 2>&1 | tail -20 && npm cache clean --force

# ============================================================================
# STAGE 2: Builder
# ============================================================================
FROM node:18-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY shared/package*.json ./shared/
COPY services/analytics-service/package*.json ./services/analytics-service/

RUN cd shared && npm install --legacy-peer-deps
RUN cd services/analytics-service && npm install --legacy-peer-deps

COPY shared/ ./shared/
COPY services/analytics-service/src ./services/analytics-service/src
COPY services/analytics-service/prisma ./services/analytics-service/prisma
COPY services/analytics-service/tsconfig.json ./services/analytics-service/

RUN cd shared && npm run build || true
RUN cd services/analytics-service && npx prisma generate && npm run build

# ============================================================================
# STAGE 3: Production
# ============================================================================
FROM node:18-alpine AS production

RUN apk add --no-cache openssl wget dumb-init

WORKDIR /app

COPY --from=deps /app/shared/node_modules ./shared/node_modules
COPY --from=deps /app/services/analytics-service/node_modules ./services/analytics-service/node_modules

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/services/analytics-service/dist ./services/analytics-service/dist
COPY --from=builder /app/services/analytics-service/package.json ./services/analytics-service/package.json
COPY --from=builder /app/services/analytics-service/prisma ./services/analytics-service/prisma
COPY --from=builder /app/services/analytics-service/node_modules/.prisma ./services/analytics-service/node_modules/.prisma

COPY services/analytics-service/docker-entrypoint.sh ./services/analytics-service/
RUN chmod +x ./services/analytics-service/docker-entrypoint.sh

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

WORKDIR /app/services/analytics-service
EXPOSE 3008

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3008/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "docker-entrypoint.sh"]
