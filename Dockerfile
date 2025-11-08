# Multi-stage build for PIMPilot SaaS
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Make build script executable
RUN chmod +x scripts/build-with-env.sh || true

# Build application
# Render.com makes environment variables available during build
# The build script will verify they're set before building
RUN if [ -f scripts/build-with-env.sh ]; then \
      ./scripts/build-with-env.sh; \
    else \
      npm run build; \
    fi

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/dist/public ./client/dist

# Copy necessary files
COPY --chown=nodejs:nodejs server/index.ts ./server/
COPY --chown=nodejs:nodejs shared ./shared

# Create directories for uploads, assets, and logs
RUN mkdir -p attached_assets/product_images uploads logs && \
    chown -R nodejs:nodejs attached_assets uploads logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]

