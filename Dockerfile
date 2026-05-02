# Dockerfile for Intelecciones (Monorepo)
FROM node:20-slim

# Install dependencies for Puppeteer/WhatsApp-web.js and build tools
RUN apt-get update && apt-get install -y \
    chromium \
    python3 \
    make \
    g++ \
    libsqlite3-dev \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use the installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

WORKDIR /app

# Copy backend dependencies and install
COPY backend/package*.json ./
RUN npm install

# Copy backend source
COPY backend/ .

# Build
RUN npm run build

# Create persistence directories with proper permissions
RUN mkdir -p /app/data && chmod 777 /app/data

EXPOSE 5000

CMD ["npm", "start"]
