FROM node:20-bookworm-slim

# Set environment variables
ENV NODE_ENV=production \
    PORT=3011 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0

WORKDIR /app

# Install system dependencies required by Playwright and Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root application user and group with UID/GID 1001
RUN groupadd -g 1001 appuser && \
    useradd -u 1001 -g appuser -m -s /bin/bash appuser

# Copy package manifests
COPY package*.json ./

# Install application dependencies
RUN npm ci || npm install

# Install Playwright Chromium browser binary and its system libraries
RUN npx playwright install --with-deps chromium

# Create directories and grant appropriate permissions for UID 1001
RUN mkdir -p /app/public/uploads /app/chat-uploads /tmp/logs /ms-playwright \
    && chown -R appuser:appuser /app /ms-playwright \
    && chmod -R 755 /ms-playwright

# Copy project source code
COPY --chown=appuser:appuser . .

# Ensure storage directories exist with proper ownership
RUN mkdir -p /app/public/uploads /app/chat-uploads \
    && chown -R appuser:appuser /app/public/uploads /app/chat-uploads

# Switch to non-root user (UID 1001)
USER 1001

# Expose target service port
EXPOSE 3011

# Start LinkedIn automation server
CMD ["npm", "start"]
