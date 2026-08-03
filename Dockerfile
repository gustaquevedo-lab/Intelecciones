FROM node:20-slim

# Build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libsqlite3-dev \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install ALL deps (including devDependencies — tsc is needed for build)
COPY backend/package*.json ./
RUN npm install

# Copy source and compile
COPY backend/ .
RUN npm run build
# Ensure native modules (better-sqlite3) are compiled for production
RUN npm rebuild better-sqlite3 --build-from-source

# Set production environment
ENV NODE_ENV=production

RUN mkdir -p /app/data && chmod 777 /app/data

EXPOSE 5000

CMD ["node", "dist/server.js"]
