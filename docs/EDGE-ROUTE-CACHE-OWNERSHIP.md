# Scope Trips Edge Route And Cache Ownership

Date: 2026-06-12

## Production Host Ownership

- `https://scopetrips.com` is the canonical public app host.
- `https://app.scopetrips.com` is a legacy app host and must redirect to `https://scopetrips.com`.
- `https://api.scopetrips.com` is the backend/API origin.
- Public app `/api/*` requests that enter the Cloudflare Pages/Functions surface proxy to `https://api.scopetrips.com`.

These invariants are enforced in CI by the `security-headers-smoke` job, which checks:

- `scope-frontend/functions/_middleware.js` keeps `scopetrips.com` as canonical and `app.scopetrips.com` as legacy.
- `scope-frontend/functions/api/[[path]].js` keeps `https://api.scopetrips.com` as the API origin.
- API proxy responses remain `Cache-Control: no-store`.

## Cache Ownership

- SPA entrypoints and route fallbacks are not cacheable. They must return `Cache-Control: no-store, no-cache, must-revalidate` so every deploy can point browsers at the current hashed bundle.
- Hashed Vite assets under `/assets/*` are immutable and may be cached for one year.
- API proxy responses are `no-store`.
- Raw Prometheus metrics are private; production public smoke checks metrics health, not raw scrape output.

## CSP Ownership

The app CSP is owned in:

- `nginx/nginx.conf` for the production compose edge.
- `scope-frontend/public/_headers` for frontend Pages/static edge deployments.
- `scope-site/public/_headers` for site Pages/static edge deployments.

Cloudflare Web Analytics/RUM compatibility is explicit:

- `script-src` allows `https://static.cloudflareinsights.com`.
- `connect-src` allows `https://cloudflareinsights.com`; the proxied `/cdn-cgi/rum` endpoint is covered by `'self'`.

Do not add broad `unsafe-eval` or wildcard script permissions for analytics.
