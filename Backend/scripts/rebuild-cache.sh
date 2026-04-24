#!/usr/bin/env bash
# rebuild-cache.sh — Flush and signal cache rebuild after Redis failure
# Usage: ./scripts/rebuild-cache.sh

set -euo pipefail

REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
LOG_FILE="/var/log/stellara/cache-recovery.log"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG_FILE"; }

log "=== Redis cache rebuild started ==="

# Wait for Redis to be reachable
for i in $(seq 1 10); do
  if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping &>/dev/null; then
    log "Redis is reachable"
    break
  fi
  log "Waiting for Redis... ($i/10)"
  sleep 3
  if [[ $i -eq 10 ]]; then
    log "ERROR: Redis not reachable after 30s"
    exit 1
  fi
done

# Flush application cache keys (preserve session keys)
FLUSHED=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --scan --pattern "cache:*" | \
  xargs -r redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" del)
log "Flushed $FLUSHED cache keys"

# Trigger warm-up via health endpoint
API_URL="${API_URL:-http://localhost:3000}"
curl -sf "$API_URL/health/ready" > /dev/null && log "App health check passed — cache will warm on next requests"

log "=== Cache rebuild complete ==="
