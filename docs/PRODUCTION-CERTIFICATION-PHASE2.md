# Scope Trips Production Certification - Phase 2 Evidence

Date: 2026-06-11

## Phase 2 Goal

Unblock only the production API header gate for `https://scopetrips.com`. Do not broaden into full UX/security certification until this fast production gate is green.

## Starting Failure

Production smoke was failing 3/6 because API health responses had duplicated security headers:

- Core health: duplicate `Strict-Transport-Security`
- Content health: duplicate `Strict-Transport-Security`
- Intel health: duplicate `Content-Security-Policy`

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 `
  -EdgeBaseUrl https://scopetrips.com `
  -MetricsHealthUrl https://scopetrips.com/api/metrics/health `
  -SkipMetricsScrape `
  -TimeoutSeconds 20
```

## Cloudflare Worker Result

The local Worker source still builds:

```powershell
npx wrangler deploy --dry-run --config .\cloudflare\api-proxy\wrangler.toml
```

Actual Worker deployment remains blocked by Cloudflare authentication. The active Wrangler login has Pages write and zone read access, but not Worker script or Worker route write access, so `npx wrangler deploy --config .\cloudflare\api-proxy\wrangler.toml` fails with Cloudflare authentication error `10000`.

No alternate local `CLOUDFLARE_*` / `WRANGLER_*` token was present, and no matching GitHub Cloudflare Worker secret or variable was configured.

## Origin Nginx Fix

Read-only SSM inspection found the production compose host online and serving an old release:

```text
/opt/scope/releases/296c5bba09cb6facef0634be413cd73269c29884
```

That deployed Nginx config predated the current `main` fix that hides upstream security headers before adding the edge policy.

Through AWS SSM, only the mounted production Nginx config was changed:

- backed up the remote config to `nginx/nginx.conf.phase2-20260611T022302Z.bak`
- inserted the current-main `proxy_hide_header` directives for HSTS, CSP, XCTO, XFO, Referrer-Policy, Permissions-Policy, COOP, and CORP
- ran `nginx -t`
- reloaded only the Nginx service

The SSM command returned a non-zero status after reload because a final diagnostic `printf` line was malformed, but the patch, `nginx -t`, and reload completed before that diagnostic failure.

## Passing Evidence

After the Nginx reload, production smoke passed 6/6:

```text
Passed: 6/6
All Scope smoke checks passed.
```

Direct header probes also returned one HSTS value on both origin and same-domain API health paths:

- `https://api.scopetrips.com/api/core/health`
- `https://api.scopetrips.com/api/content/health`
- `https://api.scopetrips.com/api/intel/health`
- `https://scopetrips.com/api/core/health`
- `https://scopetrips.com/api/content/health`
- `https://scopetrips.com/api/intel/health`

## Residual Durability Work

The production gate is green, but this phase used a narrow SSM hotfix against the current production release directory. The durable follow-up is to run a normal current-main app-host deploy so production is no longer on release `296c5bb`, and to refresh Cloudflare/Wrangler auth so the API proxy Worker can be deployed intentionally.

Do not reopen broad production certification until this durable deploy follow-up is scheduled or included in the next bounded phase.
