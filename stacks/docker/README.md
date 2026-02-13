# Docker Deployment Stack

Run OpenClaw gateway in a container for portable, isolated deployment.

## Quick Start

```bash
# Build
docker build -t openclaw-gateway .

# Run
docker run -d \
  --name openclaw \
  --restart unless-stopped \
  --env-file .env \
  -v openclaw-workspace:/home/openclaw/.openclaw \
  -p 18789:18789 \
  openclaw-gateway
```

## Docker Compose

```bash
docker compose up -d
```

## Files

| File | Description |
|------|-------------|
| `Dockerfile` | Multi-stage build for OpenClaw gateway |
| `docker-compose.yml` | Full stack with volume mounts and health checks |
| `.env.example` | Environment variable template |

## Persistent Data

The workspace directory (`~/.openclaw`) is mounted as a Docker volume to persist:
- SOUL.md, AGENTS.md, TOOLS.md config
- MEMORY.md and daily memory logs
- Vector search index (SQLite)
- Session history

## Networking

Default gateway port: `18789`. Expose only if needed for remote access (prefer Tailscale over direct exposure).

## Health Checks

Docker Compose includes a health check that pings the gateway every 30s. Unhealthy containers are automatically restarted.
