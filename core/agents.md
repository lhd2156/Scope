# Atlas â€” AI Agent Instructions

## What is Atlas?
Atlas is a real-world adventure platform where users document, discover, and plan experiences on an interactive map. Users drop pins, upload photos, write stories, and share adventures with friends. An AI engine plans optimized itineraries from community data.

**Elevator Pitch:** "PokÃ©mon Go meets Instagram â€” real places, real photos, real adventures on a map."

## Architecture Overview
Polyglot microservices with 3 backends + 1 frontend:

| Service | Framework | Directory | Responsibility |
|---------|-----------|-----------|---------------|
| Core Platform | C# / ASP.NET Core 8 | `Atlas.Core/` | Auth, real-time (SignalR), users, friends, notifications |
| Content Engine | Python / Django 5 | `atlas_content/` | Spots, trips, photos, reviews, social feed |
| Intelligence API | Python / Flask 3 | `atlas_intel/` | AI itineraries, recommendations, vibe matching |
| Frontend | Vue.js 3 / TypeScript | `atlas-frontend/` | All UI, Mapbox maps, Pinia state, dark/light mode |

**Communication:**
- Frontend â†’ Nginx â†’ Services (REST)
- Service â†” Service (Kafka events)
- Core â†’ Frontend (SignalR WebSocket for real-time)

## Critical Rules for Agents
1. **Read `atlas_architecture.tex` FIRST** â€” it is the single source of truth (~2600 lines)
2. **Never merge microservices** â€” each service is independent with its own Dockerfile
3. **Never skip security** â€” rate limiting, input validation, JWT auth on every endpoint
4. **Write tests for everything** â€” xUnit (C#), Pytest (Python), Vitest (Vue)
5. **Follow the build order** â€” Foundation â†’ Core â†’ Content â†’ Intel â†’ Frontend â†’ Integration
6. **Commit after EVERY milestone** â€” see commit strategy in the architecture doc
7. **Never hardcode secrets** â€” use environment variables from `.env`
8. **Use the exact tech stack** â€” no substitutions without explicit approval
9. **Reason through edge cases independently** â€” the user will provide minimal guidance
10. **Service boundaries are sacred** â€” services NEVER access another service's database tables

## Database
Single SQL Server instance with logical schema separation:
- `core.*` â€” Users, Friendships, Notifications, LiveSessions
- `content.*` â€” Spots, Photos, Trips, TripSpots, TripMembers, Reviews, Likes
- `intel.*` â€” ItineraryCache, UserPreferences, SpotFeatures

## Key Files
- `atlas_architecture.tex` â€” Full architecture spec (THE source of truth)
- `atlas-assets/design-tokens.css` â€” CSS custom properties for dark/light mode
- `atlas-assets/icons/atlas-icons.svg` â€” 38 SVG icons
- `.env.example` â€” All environment variables (agent creates from template)

## Design System
- **Dark mode default**, light mode toggle via `ThemeToggle.vue`
- **Colors:** Emerald Teal `#10b981` (primary), Warm Gold `#f59e0b` (accent)
- **Font:** Inter from Google Fonts
- **All colors via CSS variables** â€” never hardcode hex values in components

## Commit Format
```
<type>(<scope>): <short description>
```
Types: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `style`, `ci`

**Commit after EVERY milestone. Never batch features into one commit.**


---

# Agent 1: Core Platform â€” Task Instructions

## Your Role
You are the **Core Platform Agent** (codename: **Sentinel**). You build the C# / ASP.NET Core 8 service that handles authentication, user management, real-time features (SignalR), friends system, and notifications.

## Your Directory Scope
You own: `Atlas.Core/` (and ALL subdirectories)
- `Atlas.Core.API/`
- `Atlas.Core.Domain/`
- `Atlas.Core.Infrastructure/`
- `Atlas.Core.Tests/`

**Do NOT create or modify** anything outside `Atlas.Core/`.

## Reference
Read `atlas_architecture.tex` â€” Sections 4.2, 5, 8, 9, 10, 18, and 19.

## Prerequisites
Agent 0 (Foundation) must be complete. SQL Server and Kafka must be running.

## Tasks (in order)

### 1. Scaffold Project
Create `Atlas.Core.sln` with 4 projects:
- `Atlas.Core.API` (ASP.NET Core Web API)
- `Atlas.Core.Domain` (Class Library â€” entities, interfaces, enums)
- `Atlas.Core.Infrastructure` (Class Library â€” EF Core, repos, services)
- `Atlas.Core.Tests` (xUnit test project)

### 2. Domain Layer
Create entities: `User`, `Friendship`, `Notification`, `LiveSession`
Create interfaces: `IUserRepository`, `IFriendshipRepository`, `INotificationRepository`
Create enums: `FriendshipStatus`, `NotificationType`

### 3. Infrastructure Layer
- `CoreDbContext` with EF Core mapping to `core.*` schema
- Repository implementations
- `KafkaProducerService` â€” publish events
- `S3Service` â€” avatar upload
- `CognitoService` â€” OAuth (with bypass if env var empty)

### 4. API Layer â€” Auth
`AuthController` at `/api/core/auth`:
- POST `/register` â€” ASP.NET Core Identity, return JWT
- POST `/login` â€” validate credentials, return JWT + refresh token
- POST `/refresh` â€” exchange refresh token for new access token
- POST `/logout` â€” invalidate refresh token
- POST `/forgot-password` â€” send reset email
- POST `/reset-password` â€” reset with token
- POST `/oauth/cognito` â€” Cognito OAuth login
- GET `/me` â€” get current user from JWT

JWT: 15min access, 7 days refresh. Payload: sub, email, name, roles, iat, exp.

### 5. API Layer â€” Users, Friends, Notifications, Live
Build all controllers from Section 5.2.

### 6. SignalR Hubs
- `TripHub` â€” JoinTrip, LeaveTrip, SpotAdded, TripUpdated, MemberJoined
- `LocationHub` â€” ShareLocation, StopSharing (5s ping interval)
- `NotificationHub` â€” OnConnected subscribes to personal channel

### 7. Middleware
- `RateLimitMiddleware` â€” 100 req/min global, 10 req/min auth
- `ExceptionHandlingMiddleware` â€” catch all errors, return standard error JSON
- `RequestLoggingMiddleware` â€” Serilog JSON logging

### 8. Health Check
`GET /api/core/health` â€” checks DB + Kafka connectivity

### 9. Tests
xUnit tests for every controller and service. Use Moq for mocking.

### 10. Dockerfile
Multi-stage build from Section 17.1.

## Kafka Topics Produced
- `user.registered`, `user.updated`, `friend.accepted`, `live.location.updated`

## Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "details": [...],
    "traceId": "..."
  }
}
```

## Commits
```
feat(core): scaffold ASP.NET Core project structure
feat(core): add EF Core models and DbContext
feat(core): implement user registration and login
feat(core): implement JWT token issuance and refresh
feat(core): add users controller and profile endpoints
feat(core): add friends controller with request flow
feat(core): add notifications controller
feat(core): add live session controller
feat(core): implement SignalR TripHub
feat(core): implement SignalR LocationHub
feat(core): implement SignalR NotificationHub
feat(core): add Kafka producer service
feat(core): add rate limiting middleware
feat(core): add exception handling middleware
test(core): add unit tests for auth controller
test(core): add unit tests for all services
chore(core): add Dockerfile
```

## Branch
Work on: `feature/core-platform`

## Success Criteria
- All 30+ endpoints return correct responses
- JWT auth flow works end-to-end
- SignalR hubs accept connections
- Kafka events publish successfully
- All tests pass
- Docker container starts and serves `/api/core/health`
