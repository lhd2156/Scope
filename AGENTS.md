# Atlas — Lead Agent Instructions

## What is Atlas?
Atlas is a real-world adventure platform where users document, discover, and plan experiences on an interactive map. Users drop pins, upload photos, write stories, and share adventures with friends. An AI engine plans optimized itineraries from community data.

**Elevator Pitch:** "Pokémon Go meets Instagram — real places, real photos, real adventures on a map."

## Architecture Overview
Polyglot microservices with 3 backends + 3 clients:

| Service | Framework | Directory | Responsibility |
|---------|-----------|-----------|---------------|
| Core Platform | C# / ASP.NET Core 8 | `Atlas.Core/` | Auth, real-time (SignalR), users, friends, notifications |
| Content Engine | Python / Django 5 | `atlas_content/` | Spots, trips, photos, reviews, social feed |
| Intelligence API | Python / Flask 3 | `atlas_intel/` | AI itineraries, recommendations, vibe matching |
| Web Frontend | Vue.js 3 / TypeScript | `atlas-frontend/` | Responsive UI, Mapbox maps, Pinia state, dark/light mode |
| iOS Client | Swift 5.9 / SwiftUI | `atlas-ios/` | Native iPhone/iPad — Observation, MapKit/MapLibre, Keychain JWT |
| Android Client | Kotlin 2.0 / Jetpack Compose | `atlas-android/` | Native Android — Hilt, Retrofit, MapLibre, Encrypted JWT |

## Your Role as Lead
You are the orchestrator. You:
1. **Start with Foundation** — initialize the monorepo, Docker, databases, Kafka
2. **Delegate to sub-agents** — each sub-agent builds one service in parallel
3. **Review and integrate** — merge branches, verify cross-service communication
4. **Handle E2E testing** — Playwright tests, seed data, CI/CD, deployment

## Key Files
- `atlas_architecture.tex` — THE source of truth (~2600 lines). Read this FIRST.
- `atlas-assets/design-tokens.css` — CSS custom properties for dark/light mode
- `atlas-assets/icons/atlas-icons.svg` — 38 SVG icons

## Build Order
```
Phase 1: Foundation (you do this) → Docker, DB, Kafka, Nginx
Phase 2: Delegate to sub-agents → Core (C#) + Content (Django) + Intel (Flask) in parallel
Phase 3: Delegate Frontend → Vue.js after backends are done
Phase 4: Integration (you do this) → E2E tests, CI/CD, seed data, README
```

## Critical Rules
1. **Read `atlas_architecture.tex` FIRST** — it has EVERYTHING
2. **Never merge microservices** — each service is independent
3. **Never skip security** — rate limiting, validation, JWT on every endpoint
4. **Write tests for everything** — xUnit, Pytest, Vitest, Playwright
5. **Commit after EVERY milestone** — conventional commits, never batch
6. **Never hardcode secrets** — use `.env`
7. **Service boundaries are sacred** — never cross them

## Mobile Clients
Both mobile apps reuse the same REST + JWT contracts as the web frontend.

- `atlas-ios/` — Swift Package + SwiftUI. Build with `swift build` or open in
  Xcode. Networking is actor-based (`APIClient`), tokens live in Keychain,
  design tokens mirror `atlas-assets/design-tokens.css`.
- `atlas-android/` — Gradle KTS + Jetpack Compose. Run
  `gradle wrapper --gradle-version=8.9` once to bootstrap the wrapper, then
  `./gradlew assembleDebug testDebugUnitTest`. Tokens live in
  `EncryptedSharedPreferences`.

CI: `.github/workflows/mobile.yml` runs `swift test` on macOS 14 and
`./gradlew assembleDebug testDebugUnitTest` on Ubuntu.

## Database
Single SQL Server with logical schema separation:
- `core.*` — Users, Friendships, Notifications, LiveSessions
- `content.*` — Spots, Photos, Trips, TripSpots, TripMembers, Reviews, Likes
- `intel.*` — ItineraryCache, UserPreferences, SpotFeatures

## Commit Format
```
<type>(<scope>): <short description>
```
Types: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `style`, `ci`
