# ============================================================================
# STAGE 1: Dependencies
# ============================================================================
FROM node:18-alpine AS deps

WORKDIR /app

COPY shared/package*.json ./shared/
COPY services/interaction-service/package*.json ./services/interaction-service/

RUN cd shared && npm install --omit=dev --legacy-peer-deps && npm cache clean --force
RUN cd services/interaction-service && npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# ============================================================================
# STAGE 2: Builder
# ============================================================================
FROM node:18-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY shared/package*.json ./shared/
COPY services/interaction-service/package*.json ./services/interaction-service/

RUN cd shared && npm install --legacy-peer-deps
RUN cd services/interaction-service && npm install --legacy-peer-deps

COPY shared/ ./shared/
COPY services/interaction-service/src ./services/interaction-service/src
COPY services/interaction-service/prisma ./services/interaction-service/prisma
COPY services/interaction-service/tsconfig.json ./services/interaction-service/

RUN cd shared && npm run build || true
RUN cd services/interaction-service && npx prisma generate && npm run build

# ============================================================================
# STAGE 3: Production
# ============================================================================
FROM node:18-alpine AS production

RUN apk add --no-cache openssl wget dumb-init

WORKDIR /app

COPY --from=deps /app/shared/node_modules ./shared/node_modules
COPY --from=deps /app/services/interaction-service/node_modules ./services/interaction-service/node_modules

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/services/interaction-service/dist ./services/interaction-service/dist
COPY --from=builder /app/services/interaction-service/package.json ./services/interaction-service/package.json
COPY --from=builder /app/services/interaction-service/prisma ./services/interaction-service/prisma

# Copy generated Prisma client from builder
COPY --from=builder /app/services/interaction-service/node_modules/.prisma ./services/interaction-service/node_modules/.prisma
COPY --from=builder /app/services/interaction-service/node_modules/@prisma/client ./services/interaction-service/node_modules/@prisma/client

COPY services/interaction-service/docker-entrypoint.sh ./services/interaction-service/
RUN chmod +x ./services/interaction-service/docker-entrypoint.sh

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

WORKDIR /app/services/interaction-service
EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3003/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "docker-entrypoint.sh"]
