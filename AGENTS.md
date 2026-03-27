# Atlas — AI Agent Instructions

## What is Atlas?
Atlas is a real-world adventure platform where users document, discover, and plan experiences on an interactive map. Users drop pins, upload photos, write stories, and share adventures with friends. An AI engine plans optimized itineraries from community data.

**Elevator Pitch:** "Pokémon Go meets Instagram — real places, real photos, real adventures on a map."

## Architecture Overview
Polyglot microservices with 3 backends + 1 frontend:

| Service | Framework | Directory | Responsibility |
|---------|-----------|-----------|---------------|
| Core Platform | C# / ASP.NET Core 8 | `Atlas.Core/` | Auth, real-time (SignalR), users, friends, notifications |
| Content Engine | Python / Django 5 | `atlas_content/` | Spots, trips, photos, reviews, social feed |
| Intelligence API | Python / Flask 3 | `atlas_intel/` | AI itineraries, recommendations, vibe matching |
| Frontend | Vue.js 3 / TypeScript | `atlas-frontend/` | All UI, Mapbox maps, Pinia state, dark/light mode |

**Communication:**
- Frontend → Nginx → Services (REST)
- Service ↔ Service (Kafka events)
- Core → Frontend (SignalR WebSocket for real-time)

## Critical Rules for Agents
1. **Read `atlas_architecture.tex` FIRST** — it is the single source of truth (~2600 lines)
2. **Never merge microservices** — each service is independent with its own Dockerfile
3. **Never skip security** — rate limiting, input validation, JWT auth on every endpoint
4. **Write tests for everything** — xUnit (C#), Pytest (Python), Vitest (Vue)
5. **Follow the build order** — Foundation → Core → Content → Intel → Frontend → Integration
6. **Commit after EVERY milestone** — see commit strategy in the architecture doc
7. **Never hardcode secrets** — use environment variables from `.env`
8. **Use the exact tech stack** — no substitutions without explicit approval
9. **Reason through edge cases independently** — the user will provide minimal guidance
10. **Service boundaries are sacred** — services NEVER access another service's database tables

## Database
Single SQL Server instance with logical schema separation:
- `core.*` — Users, Friendships, Notifications, LiveSessions
- `content.*` — Spots, Photos, Trips, TripSpots, TripMembers, Reviews, Likes
- `intel.*` — ItineraryCache, UserPreferences, SpotFeatures

## Key Files
- `atlas_architecture.tex` — Full architecture spec (THE source of truth)
- `atlas-assets/design-tokens.css` — CSS custom properties for dark/light mode
- `atlas-assets/icons/atlas-icons.svg` — 38 SVG icons
- `.env.example` — All environment variables (agent creates from template)

## Design System
- **Dark mode default**, light mode toggle via `ThemeToggle.vue`
- **Colors:** Emerald Teal `#10b981` (primary), Warm Gold `#f59e0b` (accent)
- **Font:** Inter from Google Fonts
- **All colors via CSS variables** — never hardcode hex values in components

## Commit Format
```
<type>(<scope>): <short description>
```
Types: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `style`, `ci`

**Commit after EVERY milestone. Never batch features into one commit.**
