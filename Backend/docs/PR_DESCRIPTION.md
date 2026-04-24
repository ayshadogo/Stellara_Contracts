# feat(backend): API versioning, Swagger docs, SLOs, and automated recovery

Resolves #693 · Resolves #694 · Resolves #684 · Resolves #685

---

## Summary

This PR implements four backend reliability and developer-experience improvements assigned to @nanaf6203-bit as part of the Stellar Wave program.

---

## Changes

### #693 — API Versioning Strategy

**Files:** `Backend/src/versioning/`

- `versioning.middleware.ts` — NestJS middleware that inspects the request path for `/api/v{n}/` and sets response headers:
  - `X-API-Version: v1|v2`
  - `Deprecation: true` + `Sunset: 2026-12-31` + `Link: </api/v2>; rel="successor-version"` for deprecated versions
- `versioning.controller.ts` — `V1Controller` (`/api/v1/status`) and `V2Controller` (`/api/v2/status`) for version negotiation
- `versioning.module.ts` — Applies middleware globally via `MiddlewareConsumer`

**Deprecation policy:** v1 is deprecated, sunset 2026-12-31. v2 is current stable.

---

### #694 — OpenAPI/Swagger Documentation

**Files:** `Backend/src/swagger/swagger.setup.ts`

- Centralizes the Swagger `DocumentBuilder` config (previously inline in `main.ts`)
- Adds versioning migration notes and authentication docs to the description
- Registers all API tags: `Health`, `Users`, `Versioning`, `SLO`, `Recovery`
- Exposes `/api/docs` (UI), `/api/docs-json`, and `/api/docs-yaml`
- All new controllers use `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiParam`

---

### #684 — Service Level Objectives (SLOs)

**Files:** `Backend/src/slo/`

- `slo.definitions.ts` — Defines 3 SLO targets:
  - `api_availability`: 99.9% (30-day window)
  - `api_latency_p99`: 99% (1-day window)
  - `indexer_availability`: 99.5% (1-day window)
- `slo.service.ts` — Reads existing Prometheus counters (`http_requests_total`, `errors_total`) to compute current SLO compliance and error budget remaining. Emits `slo_error_budget_remaining{slo=...}` gauge. Logs warnings on breach.
- `slo.controller.ts` — `GET /api/v2/slo` returns all SLO statuses
- `slo.module.ts` — Registers the new Prometheus gauge

---

### #685 — Automated Recovery Procedures

**Files:** `Backend/src/recovery/`, `Backend/scripts/`, `Backend/docs/`

- `recovery.service.ts` — Cron job (every minute) that:
  1. Calls `HealthService.getReadinessReport()`
  2. For each `down` dependency, calls `remediate(target)`
  3. `database` → `PrismaService.$disconnect()` + `$connect()`
  4. `redis` → TCP probe to verify reachability
  5. Keeps an in-memory history of the last 100 actions
- `recovery.controller.ts`:
  - `GET /api/v2/recovery/history` — view action log
  - `POST /api/v2/recovery/trigger/:target` — manual trigger
- `recovery.module.ts` — imports `HealthModule`
- `scripts/restart-indexer.sh` — bash script with exponential backoff retry (up to 5 attempts) for systemd/pm2 indexer restart
- `scripts/rebuild-cache.sh` — waits for Redis, flushes `cache:*` keys, triggers health warm-up
- `docs/recovery-procedures.md` — manual runbook for all failure scenarios

---

## How to wire up

Add the new modules to `app.module.ts`:

```typescript
import { VersioningModule } from './versioning/versioning.module';
import { SloModule } from './slo/slo.module';
import { RecoveryModule } from './recovery/recovery.module';

@Module({
  imports: [
    // ... existing modules
    VersioningModule,
    SloModule,
    RecoveryModule,
  ],
})
export class AppModule {}
```

Optionally replace the inline Swagger setup in `main.ts` with:

```typescript
import { setupSwagger } from './swagger/swagger.setup';
// ...
setupSwagger(app);
```

Make scripts executable:

```bash
chmod +x Backend/scripts/restart-indexer.sh Backend/scripts/rebuild-cache.sh
```

---

## Testing

- `GET /api/v1/status` → 200 with `X-API-Version: v1`, `Deprecation: true`, `Sunset`, `Link` headers
- `GET /api/v2/status` → 200 with `X-API-Version: v2`, no deprecation headers
- `GET /api/v2/slo` → JSON array of SLO statuses with error budgets
- `GET /api/v2/recovery/history` → recovery action log
- `POST /api/v2/recovery/trigger/database` → triggers DB reconnect
- `GET /api/docs` → Swagger UI with all tags and bearer auth
