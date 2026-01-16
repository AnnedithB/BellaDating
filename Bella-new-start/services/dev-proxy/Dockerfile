# ============================================================================
# STAGE 1: Builder
# ============================================================================
FROM node:18-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY services/dev-proxy/package*.json ./
RUN npm install --legacy-peer-deps

COPY services/dev-proxy/tsconfig.json ./
COPY services/dev-proxy/src ./src

RUN npm run build

# ============================================================================
# STAGE 2: Production
# ============================================================================
FROM node:18-alpine AS production

RUN apk add --no-cache wget dumb-init

ENV NODE_ENV=production
WORKDIR /app

COPY services/dev-proxy/package*.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4100/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
