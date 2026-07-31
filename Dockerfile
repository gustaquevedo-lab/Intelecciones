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

# Remove devDependencies after build to keep image lean
RUN npm prune --production

# Set production env for runtime
ENV NODE_ENV=production

RUN mkdir -p /app/data && chmod 777 /app/data

EXPOSE 5000

CMD ["sleep", "3600"]
