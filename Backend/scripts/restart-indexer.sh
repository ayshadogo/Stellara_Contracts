#!/usr/bin/env bash
# restart-indexer.sh — Auto-restart the Stellara indexer on failure
# Usage: ./scripts/restart-indexer.sh [--max-retries N]

set -euo pipefail

MAX_RETRIES=${1:-5}
RETRY_DELAY=10
SERVICE_NAME="stellara-indexer"
LOG_FILE="/var/log/stellara/indexer-recovery.log"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG_FILE"; }

restart_indexer() {
  if command -v systemctl &>/dev/null && systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    log "Restarting systemd service: $SERVICE_NAME"
    systemctl restart "$SERVICE_NAME"
  elif command -v pm2 &>/dev/null; then
    log "Restarting via pm2: $SERVICE_NAME"
    pm2 restart "$SERVICE_NAME" || pm2 start npm --name "$SERVICE_NAME" -- run start:indexer
  else
    log "ERROR: No supported process manager found (systemd/pm2)"
    exit 1
  fi
}

check_indexer_health() {
  local api_url="${API_URL:-http://localhost:3000}"
  local status
  status=$(curl -sf "$api_url/health/ready" | grep -o '"status":"[^"]*"' | head -1 || echo '"status":"down"')
  [[ "$status" == *'"ok"'* ]]
}

log "=== Indexer recovery started ==="

for attempt in $(seq 1 "$MAX_RETRIES"); do
  log "Attempt $attempt/$MAX_RETRIES"
  restart_indexer

  sleep "$RETRY_DELAY"

  if check_indexer_health; then
    log "Indexer recovered successfully on attempt $attempt"
    exit 0
  fi

  log "Health check failed after restart attempt $attempt"
  RETRY_DELAY=$((RETRY_DELAY * 2))
done

log "ERROR: Indexer failed to recover after $MAX_RETRIES attempts"
exit 1
