# Multi-stage build for smaller production image
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install all dependencies including dev
RUN npm ci

# Copy source code
COPY src/ ./src/

# Copy scripts
COPY scripts/ ./scripts/

# Build the project
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Copy production package file (no prepare script)
COPY package.prod.json ./package.json

# Install only production dependencies (no package-lock.json to force fresh install)
RUN npm install --production && npm cache clean --force

# Copy built files from builder stage
COPY --from=builder /app/build ./build
COPY --from=builder /app/scripts ./scripts

# Install bash for scripts
RUN apk add --no-cache bash curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpuser -u 1001

# Change ownership
RUN chown -R mcpuser:nodejs /app

# Switch to non-root user
USER mcpuser

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the server
CMD ["node", "build/server.js"]
