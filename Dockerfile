FROM node:22-slim

# Install system build dependencies for native modules (sqlite3) and curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Set timezone
ENV TZ=Asia/Colombo
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Copy package manifests
COPY package.json package-lock.json* ./

# Install production dependencies and rebuild sqlite3 against system glibc
RUN npm install --omit=dev --build-from-source=sqlite3

# Copy application code
COPY server.js ./
COPY src/ ./src/
COPY public/ ./public/

# Create persistent directories
RUN mkdir -p /app/data/backups /app/data/credentials /app/logs

# Default environment variables
ENV PORT=3000 \
    HOST=0.0.0.0 \
    NODE_ENV=production \
    DEVICE_IP=192.168.10.15 \
    DEVICE_PORT=4370 \
    DB_PATH=data/attendance.db \
    BACKUP_DIR=data/backups \
    LOG_DIR=logs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
