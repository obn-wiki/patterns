# OpenClaw Gateway — Production Dockerfile
# Multi-stage build for minimal image size

# --- Build stage ---
FROM node:22-slim AS builder

WORKDIR /app

# Install OpenClaw
RUN npm install -g openclaw

# --- Runtime stage ---
FROM node:22-slim

# Create non-root user
RUN groupadd -r openclaw && useradd -r -g openclaw -m openclaw

# Copy OpenClaw from builder
COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=builder /usr/local/bin/openclaw /usr/local/bin/openclaw

# Create workspace directory
RUN mkdir -p /home/openclaw/.openclaw/workspace/memory && \
    chown -R openclaw:openclaw /home/openclaw/.openclaw

# Switch to non-root user
USER openclaw
WORKDIR /home/openclaw/.openclaw

# Default port
EXPOSE 18789

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:18789/health || exit 1

# Start gateway
CMD ["openclaw", "gateway", "start"]
