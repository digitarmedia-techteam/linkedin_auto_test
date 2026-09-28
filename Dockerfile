FROM node:20-bookworm-slim

# Environment
ENV NODE_ENV=production \
    PORT=3011 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0

WORKDIR /app

# ---------------------------------------------------------
# System dependencies required by Playwright / Chromium
# ---------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    curl \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    xvfb \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------
# Non-root application user
# ---------------------------------------------------------
RUN groupadd -g 1001 appuser && \
    useradd -u 1001 -g appuser -m -s /bin/bash appuser

# ---------------------------------------------------------
# Install Node dependencies
# ---------------------------------------------------------
COPY package*.json ./

RUN npm ci || npm install

# ---------------------------------------------------------
# Install Playwright Chromium INSIDE Docker
# ---------------------------------------------------------
RUN npx playwright install chromium

# ---------------------------------------------------------
# Permissions
# ---------------------------------------------------------
RUN mkdir -p /app/screenshots /ms-playwright && \
    chown -R appuser:appuser /app /ms-playwright && \
    chmod -R 755 /ms-playwright

# ---------------------------------------------------------
# Application
# ---------------------------------------------------------
COPY --chown=appuser:appuser . .

USER 1001

EXPOSE 3011

CMD ["npm", "start"]