# Scope Frontend

Premium Vue 3 + TypeScript frontend for **Scope** — a real-world adventure platform for discovering spots, planning collaborative trips, and exploring travel stories on an interactive map.

## Stack

- Vue 3 + `<script setup>`
- TypeScript (strict)
- Vite 6
- Pinia
- Vue Router
- Mapbox GL JS
- Vitest + Playwright

## Getting Started

```bash
npm install
npm run dev
```

The app runs on the default Vite dev server unless you configure a different port.

## Environment Flags

Scope uses Vite environment variables for local configuration.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/` | Base URL for backend API requests |
| `VITE_MAPBOX_TOKEN` | _(empty)_ | Mapbox token for map rendering |
| `VITE_CSRF_ENDPOINT` | _(empty)_ | Optional CSRF bootstrap endpoint |
| `VITE_DEMO_MODE` | `false` | Routes the frontend service layer to local demo fixtures instead of live APIs |
| `VITE_ENABLE_DEMO_WEATHER` | `false` | Uses deterministic demo weather instead of live OpenWeatherMap/Open-Meteo data when demo mode is enabled |
| `VITE_ENABLE_CLIENT_WEATHER_FALLBACK` | `false` | Allows browser-side weather provider calls when the backend weather endpoint is unavailable; keep disabled for production |
| `VITE_ENABLE_TRIP_MOCK_FALLBACK` | `false` | Allows fixture-backed trip lists/details when the trip API is empty or unavailable; keep disabled for production |
| `VITE_ENABLE_TRIP_LOCAL_WRITE_FALLBACK` | `false` | Allows localStorage trip writes when the trip API is unavailable; keep disabled for production |
| `VITE_ENABLE_AGENT_LOCAL_FALLBACK` | `false` | Allows local trip copilot responses when the Intel agent endpoint is unavailable; keep disabled for production |
| `VITE_OPENWEATHERMAP_API_KEY` | _(empty)_ | Optional browser fallback key for local development; production weather should use the Intel backend weather endpoint |
| `VITE_ENABLE_AUTH_MOCK_FALLBACK` | `false` | Keeps the legacy auth fallback path available for local API-offline development |
| `VITE_ENABLE_USER_MOCK_FALLBACK` | `false` | Enables user-profile-only fallback behavior outside demo mode |

### Demo Mode

Copy `.env.example` to `.env.local` (or create `.env.local`) and enable demo mode:

```bash
VITE_DEMO_MODE=true
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

When `VITE_DEMO_MODE=true`:

- the API client short-circuits to fixture-backed mock data
- auth uses the seeded shared demo account
- realtime notifications stay idle instead of trying to connect to SignalR
- weather still uses the backend/live providers unless `VITE_ENABLE_DEMO_WEATHER=true`
- spots, trips, feed, notifications, maps, and itinerary generation all resolve from local demo fixtures

### Demo Login

- **Email:** `demo@scope.travel`
- **Password:** `Scope2024!`

## Demo Fixtures

Fixture files live in `src/mock/`.

- `users.json` — 5 seeded travelers with pravatar avatars and activity history
- `spots.json` — 20 seeded Texas spots with Unsplash imagery and real coordinates
- `trips.json` — 3 itinerary-ready demo trips with members, pacing notes, and budget context
- `feed.json` — 15 feed items spanning pin drops, reviews, and trip milestones
- `notifications.json` — 10 seeded notifications for inbox and badge states
- `index.ts` — fixture normalization layer that maps raw JSON into typed frontend models

## Scripts

```bash
npm run dev          # start local development server
npm run build        # type-check and build production assets
npm run preview      # preview the production build
npm run test         # run unit tests
npm run test:e2e     # run Playwright end-to-end tests
npm run lint         # lint Vue + TypeScript files
```

## Docker Build Args

The frontend Docker build also accepts the demo toggle:

```bash
docker build \
  --build-arg VITE_DEMO_MODE=true \
  --build-arg VITE_MAPBOX_TOKEN=your_mapbox_token_here \
  -t scope-frontend .
```

## Notes

- Dark mode is the primary visual target.
- Demo mode is deterministic by design, so seeded counts and content stay stable for reviews, screenshots, and live walkthroughs.
- The fixture layer is intentionally separated from the legacy offline fallback data so product demos remain curated and repeatable.
