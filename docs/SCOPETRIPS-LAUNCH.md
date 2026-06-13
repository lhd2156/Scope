# Scope Trips Launch Notes

Use this path when launching the static Scope Trips web surfaces on a free host.

## Recommended production shape

- `https://scopetrips.com` - primary user-facing Scope Trips web app from `scope-frontend`
- `https://www.scopetrips.com` - canonical redirect/alias for `https://scopetrips.com`
- `https://scopetrips.com/api/*` - browser-facing API route, proxied to the backend origin by Cloudflare
- `https://app.scopetrips.com` - legacy app host; redirect it permanently to `https://scopetrips.com`
- `https://api.scopetrips.com` - backend origin only; do not use it as the browser-facing app API URL unless same-domain proxying is unavailable

## Fastest free hosting setup

Create Cloudflare Pages projects from this repository. The current Cloudflare binding has the apex domain on `scopetrips-site`, even though the deployed artifact is the Vue app build. Keep using that project for apex deploys unless you intentionally migrate the custom domain to `scopetrips-app`.

| Project | Root directory | Build command | Build output |
| --- | --- | --- | --- |
| `scopetrips-site` | `scope-frontend` | `npm ci && npm run build` | `dist` |
| `scopetrips-app` | `scope-frontend` | `npm ci && npm run build` | `dist` |
| `scopetrips-marketing` or future replacement | `scope-site` | `npm ci && npm run build` | `dist` |

Recommended `scopetrips-site` environment variable:

```text
NODE_VERSION=24
VITE_SCOPE_WEB_APP_URL=https://scopetrips.com
```

Recommended production app environment variables on whichever Pages project owns the apex domain (`scopetrips-site` today):

```text
NODE_VERSION=24
VITE_API_BASE_URL=/
VITE_DEMO_MODE=false
VITE_ENABLE_AUTH_MOCK_FALLBACK=false
VITE_ENABLE_TRIP_MOCK_FALLBACK=false
VITE_ENABLE_TRIP_LOCAL_WRITE_FALLBACK=false
VITE_ENABLE_SPOT_MOCK_FALLBACK=false
VITE_ENABLE_SPOT_LOCAL_WRITE_FALLBACK=false
VITE_ENABLE_AGENT_LOCAL_FALLBACK=false
VITE_ENABLE_USER_MOCK_FALLBACK=false
VITE_ENABLE_MAP_MOCK_FALLBACK=false
VITE_ENABLE_FEED_MOCK_FALLBACK=false
VITE_ENABLE_NOTIFICATION_MOCK_FALLBACK=false
VITE_DISABLE_SERVICE_WORKER=false
```

Add `VITE_MAPBOX_TOKEN` if real Mapbox rendering should work in production.

For a static demo-only launch, flip the demo and mock fallback flags back to `true`, but do not treat that deployment as production persistence validation.

## Namecheap DNS when using Cloudflare DNS

This is the cleanest option. In Namecheap, change the domain nameservers to the two nameservers Cloudflare gives you after adding `scopetrips.com` to Cloudflare. Then manage all DNS in Cloudflare.

In Cloudflare Pages, attach these custom domains:

```text
scopetrips.com -> scopetrips-site
www.scopetrips.com -> scopetrips-site
app.scopetrips.com -> redirect to https://scopetrips.com
```

Cloudflare will create the needed DNS records automatically.

If the domain is later moved to `scopetrips-app`, update this file and the deployment command in the release runbook in the same change.

Route `scopetrips.com/api/*` through the Cloudflare API proxy Worker or through the `scope-frontend/functions/api/[[path]].js` Pages Function. The browser should call `/api/...` from the apex app. Cloudflare Pages `_redirects` rules are not applied to matching Pages Functions routes, so API proxy behavior belongs in the Function or Worker code rather than in `_redirects`.

Current Worker source lives in `cloudflare/api-proxy`. Deploy it after changing proxy behavior or response header normalization:

```powershell
npx wrangler deploy --config .\cloudflare\api-proxy\wrangler.toml
```

The Wrangler token must be allowed to edit Worker scripts and routes for the `scopetrips.com` zone. A Pages-only token can deploy `scopetrips-site`, but it cannot update the API proxy Worker.

## Namecheap DNS without moving nameservers

If DNS stays in Namecheap, create these records after the Pages projects exist:

```text
Type: CNAME
Host: www
Value: scopetrips-app.pages.dev
TTL: Automatic

Type: CNAME
Host: app
Value: scopetrips-app.pages.dev
TTL: Automatic
```

The `app` CNAME is only for legacy redirects back to `https://scopetrips.com`. For the apex/root domain `scopetrips.com`, use Cloudflare DNS when possible because the apex can be proxied cleanly with HTTPS and Workers routes.

Keep `app.scopetrips.com` as a redirect-only legacy host. Keep `api.scopetrips.com` available for backend origin traffic, but prefer `https://scopetrips.com/api/*` for browser-facing production checks.
