# FIXED Dockerfile for communication-service
# This fixes the OpenSSL compatibility issue with Prisma

FROM node:18-slim

WORKDIR /app

# Install OpenSSL 1.1 for Prisma compatibility
# This is required because Prisma's query engine needs libssl.so.1.1
RUN apt-get update -y && \
    apt-get install -y openssl libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY prisma/ ./prisma/

# Generate Prisma client for the correct platform
RUN npx prisma generate

# Build TypeScript application
RUN npm run build

# Create non-root user for security
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs commuser

# Change ownership of the app directory
RUN chown -R commuser:nodejs /app

# Switch to non-root user
USER commuser

# Expose the service port
EXPOSE 3006

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3006/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["npm", "start"]

