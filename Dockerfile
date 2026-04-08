# Node.js Application Build - Generated for issue-1
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy all application source (monorepo-safe: ensures subdirectory package.json files exist for postinstall)
COPY . .

# Install ALL dependencies (including devDependencies for tests)
RUN npm ci --include=dev

# Build application (if build script exists)
RUN npm run build || echo "No build script found, skipping build step"

# Environment variables
ENV NODE_ENV=test
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3   CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start command
CMD ["npm", "start"]

