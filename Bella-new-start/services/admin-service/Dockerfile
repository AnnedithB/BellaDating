# ============================================================================
# STAGE 1: Dependencies
# ============================================================================
FROM node:18-alpine AS deps

WORKDIR /app

COPY shared/package*.json ./shared/
COPY services/admin-service/package*.json ./services/admin-service/

RUN cd shared && npm install --omit=dev --legacy-peer-deps && npm cache clean --force
RUN cd services/admin-service && npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# ============================================================================
# STAGE 2: Builder
# ============================================================================
FROM node:18-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY shared/package*.json ./shared/
COPY services/admin-service/package*.json ./services/admin-service/

RUN cd shared && npm install --legacy-peer-deps
RUN cd services/admin-service && npm install --legacy-peer-deps

COPY shared/ ./shared/
COPY services/admin-service/src ./services/admin-service/src
COPY services/admin-service/prisma ./services/admin-service/prisma
COPY services/admin-service/tsconfig.json ./services/admin-service/

RUN cd shared && npm run build || true
RUN cd services/admin-service && npx prisma generate && npm run build

# ============================================================================
# STAGE 3: Production
# ============================================================================
FROM node:18-alpine AS production

RUN apk add --no-cache openssl wget dumb-init

WORKDIR /app

COPY --from=deps /app/shared/node_modules ./shared/node_modules
COPY --from=deps /app/services/admin-service/node_modules ./services/admin-service/node_modules

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/services/admin-service/dist ./services/admin-service/dist
COPY --from=builder /app/services/admin-service/package.json ./services/admin-service/package.json
COPY --from=builder /app/services/admin-service/prisma ./services/admin-service/prisma
COPY --from=builder /app/services/admin-service/node_modules/.prisma ./services/admin-service/node_modules/.prisma

COPY services/admin-service/docker-entrypoint.sh ./services/admin-service/
RUN chmod +x ./services/admin-service/docker-entrypoint.sh

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

WORKDIR /app/services/admin-service
EXPOSE 3009

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3009/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "docker-entrypoint.sh"]