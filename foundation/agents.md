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


---

# Agent 0: Foundation — Task Instructions

## Your Role
You are the **Foundation Agent** (codename: **Architect**). You set up the infrastructure that ALL other agents depend on. You run FIRST and ALONE. No other agent starts until you are done.

## Your Directory Scope
You own the **root directory** and these subdirectories:
- `docker-compose.yml`
- `.env.example`
- `.gitignore`
- `nginx/nginx.conf`
- `scripts/`
- `k8s/`
- `terraform/`

**Do NOT create or modify** `Atlas.Core/`, `atlas_content/`, `atlas_intel/`, or `atlas-frontend/`. Other agents handle those.

## Reference
Read `atlas_architecture.tex` — Sections 2, 3, 4, 12, 15, 16, and Appendix A + C.

## Tasks (in order)

### 1. Initialize Monorepo
Create the exact folder structure from Section 15. Create empty placeholder directories for each service so other agents can start clean.

### 2. Create `.gitignore`
Copy the exact `.gitignore` from Appendix A.

### 3. Create `.env.example`
Copy the exact template from Section 16. Include ALL variables for all services.

### 4. Write `docker-compose.yml`
Include these services (Section 12.1):
- `sqlserver` (mcr.microsoft.com/mssql/server:2022-latest, port 1433)
- `kafka` (confluentinc/cp-kafka:7.5.0, port 9092)
- `zookeeper` (confluentinc/cp-zookeeper:7.5.0, port 2181)
- `nginx` (nginx:alpine, port 80)
- Placeholders for `core`, `content`, `intel`, `frontend` (other agents fill these)

**CRITICAL — LOW MEMORY MODE (4GB laptop):**
The host machine has only 4GB RAM. You MUST set memory limits on all containers:
```yaml
services:
  sqlserver:
    mem_limit: 512m
    environment:
      - MSSQL_MEMORY_LIMIT_MB=512
      - ACCEPT_EULA=Y
  kafka:
    mem_limit: 256m
    environment:
      - KAFKA_HEAP_OPTS=-Xmx256m -Xms128m
  zookeeper:
    mem_limit: 128m
    environment:
      - KAFKA_HEAP_OPTS=-Xmx128m -Xms64m
  nginx:
    mem_limit: 64m
```
Do NOT run all services simultaneously. Start infrastructure first (sqlserver, kafka, zookeeper), then start application services ONE AT A TIME for testing. Use `docker-compose up -d sqlserver kafka zookeeper` first, verify, then add others.

### 5. Start Infrastructure
```bash
docker-compose up -d sqlserver kafka zookeeper
bash scripts/wait_for_services.sh
```

### 6. Create Database Schemas
Connect to SQL Server and run ALL CREATE TABLE statements from Section 4:
- `core.Users`, `core.Friendships`, `core.Notifications`, `core.LiveSessions`
- `content.Spots`, `content.Photos`, `content.Trips`, `content.TripSpots`, `content.TripMembers`, `content.Reviews`, `content.Likes`
- `intel.ItineraryCache`, `intel.UserPreferences`, `intel.SpotFeatures`
- Include all indexes.

### 7. Create Kafka Topics
Write `scripts/create_topics.sh` from Appendix C. Create all 11 topics.

### 8. Create Nginx Config
Write `nginx/nginx.conf` from Section 12.2 with rate limiting zones and upstream routing.

### 9. Create Wait Script
Write `scripts/wait_for_services.sh` from Appendix C.

## Commits (one per task)
```
chore: initialize monorepo folder structure
chore: add .gitignore and .env.example
chore: add docker-compose with sqlserver and kafka
feat(db): create core schema and tables
feat(db): create content schema and tables
feat(db): create intel schema and tables
chore: add nginx reverse proxy config
chore: add kafka topic creation script
chore: add wait-for-services script
```

## Branch
Work on: `feature/foundation`

## Success Criteria
- `docker-compose up sqlserver kafka zookeeper` starts without errors
- All 14 database tables exist with correct schemas
- All 11 Kafka topics are created
- Nginx config is syntactically valid

