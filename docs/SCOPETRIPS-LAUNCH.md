# Scope Trips Launch Notes

Use this path when launching the static Scope Trips web surfaces on a free host.

## Recommended production shape

- `https://scopetrips.com` - marketing site from `scope-site`
- `https://www.scopetrips.com` - marketing alias for `https://scopetrips.com`
- `https://app.scopetrips.com` - Vue app from `scope-frontend`
- `https://api.scopetrips.com` - reserved for the backend when the paid/always-on stack is ready

## Fastest free hosting setup

Create two Cloudflare Pages projects from this repository:

| Project | Root directory | Build command | Build output |
| --- | --- | --- | --- |
| `scopetrips-site` | `scope-site` | `npm ci && npm run build` | `dist` |
| `scopetrips-app` | `scope-frontend` | `npm ci && npm run build` | `dist` |

Recommended `scopetrips-site` environment variable:

```text
NODE_VERSION=24
VITE_SCOPE_WEB_APP_URL=https://app.scopetrips.com
```

Recommended `scopetrips-app` environment variables for a static demo launch:

```text
NODE_VERSION=24
VITE_API_BASE_URL=/
VITE_DEMO_MODE=true
VITE_ENABLE_AUTH_MOCK_FALLBACK=true
VITE_ENABLE_TRIP_MOCK_FALLBACK=true
VITE_ENABLE_TRIP_LOCAL_WRITE_FALLBACK=true
VITE_ENABLE_SPOT_MOCK_FALLBACK=true
VITE_ENABLE_SPOT_LOCAL_WRITE_FALLBACK=true
VITE_ENABLE_AGENT_LOCAL_FALLBACK=true
VITE_ENABLE_USER_MOCK_FALLBACK=true
VITE_ENABLE_MAP_MOCK_FALLBACK=true
VITE_ENABLE_FEED_MOCK_FALLBACK=true
VITE_ENABLE_NOTIFICATION_MOCK_FALLBACK=true
VITE_DISABLE_SERVICE_WORKER=false
```

Add `VITE_MAPBOX_TOKEN` if real Mapbox rendering should work in production.

## Namecheap DNS when using Cloudflare DNS

This is the cleanest option. In Namecheap, change the domain nameservers to the two nameservers Cloudflare gives you after adding `scopetrips.com` to Cloudflare. Then manage all DNS in Cloudflare.

In Cloudflare Pages, attach these custom domains:

```text
scopetrips.com -> scopetrips-site
www.scopetrips.com -> scopetrips-site
app.scopetrips.com -> scopetrips-app
```

Cloudflare will create the needed DNS records automatically.

## Namecheap DNS without moving nameservers

If DNS stays in Namecheap, create these records after the Pages projects exist:

```text
Type: CNAME
Host: www
Value: scopetrips-site.pages.dev
TTL: Automatic

Type: CNAME
Host: app
Value: scopetrips-app.pages.dev
TTL: Automatic
```

For the apex/root domain `scopetrips.com`, either use Cloudflare DNS or use Namecheap URL redirect from `@` to `https://www.scopetrips.com`. Cloudflare DNS is preferred because the apex can be proxied cleanly with HTTPS.

Keep `api.scopetrips.com` empty until the backend is deployed.
