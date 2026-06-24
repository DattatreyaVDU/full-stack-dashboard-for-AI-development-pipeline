# ── Stage 1: Build the React dashboard ───────────────────────────────────────
FROM node:18-alpine AS frontend-builder

WORKDIR /build/dashboard
COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# ── Stage 2: Production backend ───────────────────────────────────────────────
FROM node:18-alpine

WORKDIR /app

# Install backend dependencies
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy server source
COPY server/src ./src

# Copy built frontend into server/public so Express serves it
COPY --from=frontend-builder /build/dashboard/dist ./public

# Create data and projects directories (overridden by Docker volumes at runtime)
RUN mkdir -p /app/data /projects

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/db.json

CMD ["node", "src/index.js"]
