# Manual Recovery Procedures

## Indexer Stuck / Not Processing

**Symptoms:** `indexer_lag_ledgers` metric rising, `/health/ready` shows indexer degraded.

```bash
# Auto-restart (retries up to 5 times with exponential backoff)
./scripts/restart-indexer.sh

# Or manually via pm2
pm2 restart stellara-indexer

# Check lag after restart
curl http://localhost:3000/health | jq '.runtime'
```

## Database Connection Loss

**Symptoms:** `/health/ready` returns `database: down`, 500 errors on DB-backed endpoints.

```bash
# Trigger automated DB reconnection via API
curl -X POST http://localhost:3000/api/v2/recovery/trigger/database

# Or restart the app (PrismaService reconnects on init)
pm2 restart stellara-backend

# Verify
curl http://localhost:3000/health/ready
```

## Redis Cache Failure

**Symptoms:** High cache miss rate, slow responses, Redis health check failing.

```bash
# Flush stale cache and rebuild
./scripts/rebuild-cache.sh

# Or trigger via API
curl -X POST http://localhost:3000/api/v2/recovery/trigger/redis

# Monitor cache hit rate
curl http://localhost:3000/metrics | grep cache_
```

## Health Check Auto-Remediation

The `RecoveryService` runs every minute via cron. It calls `/health/ready` internally and triggers `remediate(target)` for any `down` dependency automatically.

View recovery history:
```bash
curl http://localhost:3000/api/v2/recovery/history | jq .
```

## SLO Breach Response

```bash
# Check current SLO status and error budgets
curl http://localhost:3000/api/v2/slo | jq .

# If api_availability is breached:
# 1. Check error rate in Prometheus
# 2. Identify failing endpoints via http_requests_total{status=~"5.."}
# 3. Roll back recent deployment if error spike correlates
```
