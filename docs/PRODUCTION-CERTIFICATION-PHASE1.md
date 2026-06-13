# Scope Trips Production Certification - Phase 1 Evidence

Date: 2026-06-10

## Phase 1 Goal

Validate the local full-stack baseline, rerun the Rust SQL seed, inventory deployable surfaces enough to target the next phase, fix source-level fast-gate blockers where possible, and identify whether production can pass the fast smoke gate.

## Completed Evidence

- Docker Compose dependencies were running and healthy for SQL Server, Core, Content, Intel, Nginx, Scope Metrics, Redis, Kafka, and RabbitMQ.
- Rust SQL seed was rerun with `scope-cli\target\debug\scope.exe seed --directory scripts\sql`; the CLI reported 12 files and 98 batches completed against `ScopeDb`.
- Seed verification counts included 8 Core showcase users, 25 Django spots, 4 public Django trips, 49 reviews, 87 likes, and 2 Intel preferences.
- `scope-frontend` and `scope-site` builds completed after the static health/security assets and `_headers` updates.
- Local smoke passed 7/7 with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 `
  -EdgeBaseUrl http://localhost:8088 `
  -MetricsBaseUrl http://localhost:9090 `
  -TimeoutSeconds 15
```

- Cloudflare Pages production deployment for the current apex project completed on `scopetrips-site`:

```text
https://db764a65.scopetrips-site.pages.dev
```

- `https://scopetrips.com/healthz`, `https://scopetrips.com/security.txt`, and `https://scopetrips.com/.well-known/security.txt` now return the expected static operational responses from the Pages artifact.

## Source Fixes Made

- Updated the Core SQL seed so current non-null user/auth/profile columns are populated idempotently.
- Added static `healthz` and `security.txt` assets to both `scope-frontend` and `scope-site`.
- Updated Pages `_headers` for the new static operational assets.
- Removed stale `/api/*` redirect behavior from `scope-frontend/public/_redirects`; API proxying belongs in the Worker or Pages Function layer.
- Extended `scripts/smoke-test.ps1` for production-shaped metrics checks and duplicate security header detection.
- Updated launch/deployment docs for the current `scopetrips.com` Pages and same-domain API shape.
- Updated `cloudflare/api-proxy` so proxied HTTP API responses normalize to one canonical set of security headers.

## Remaining Production Blocker

Production smoke still failed 3/6 at the end of Phase 1:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 `
  -EdgeBaseUrl https://scopetrips.com `
  -MetricsHealthUrl https://scopetrips.com/api/metrics/health `
  -SkipMetricsScrape `
  -TimeoutSeconds 20
```

Failing checks:

- Core health: duplicate `Strict-Transport-Security`
- Content health: duplicate `Strict-Transport-Security`
- Intel health: duplicate `Content-Security-Policy`

The same duplicate headers were present on `https://api.scopetrips.com`, so the production origin and/or Cloudflare API proxy deployment had not picked up the current header normalization behavior.

`npx wrangler deploy --config .\cloudflare\api-proxy\wrangler.toml` was blocked by Cloudflare token permissions. The active token could write Pages and read zones, but could not edit Worker scripts or Worker routes.

## Next Bounded Phase Goal

Phase 2: Unblock the production API header gate only. Deploy the updated Cloudflare API proxy Worker with a token that can edit Worker scripts and routes, redeploy or reload the production origin Nginx config from current `main` if `api.scopetrips.com` still duplicates headers, then rerun the production smoke command until it passes 6/6 or one concrete external blocker is documented. Do not broaden into full UX/security certification until this fast production gate is green.
