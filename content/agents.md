# Scope â€” AI Agent Instructions

## What is Scope?
Scope is a real-world adventure platform where users document, discover, and plan experiences on an interactive map. Users drop pins, upload photos, write stories, and share adventures with friends. An AI engine plans optimized itineraries from community data.

**Elevator Pitch:** "PokÃ©mon Go meets Instagram â€” real places, real photos, real adventures on a map."

## Architecture Overview
Polyglot microservices with 3 backends + 1 frontend:

| Service | Framework | Directory | Responsibility |
|---------|-----------|-----------|---------------|
| Core Platform | C# / ASP.NET Core 8 | `Scope.Core/` | Auth, real-time (SignalR), users, friends, notifications |
| Content Engine | Python / Django 5 | `scope_content/` | Spots, trips, photos, reviews, social feed |
| Intelligence API | Python / Flask 3 | `scope_intel/` | AI itineraries, recommendations, vibe matching |
| Frontend | Vue.js 3 / TypeScript | `scope-frontend/` | All UI, Mapbox maps, Pinia state, dark/light mode |

**Communication:**
- Frontend â†’ Nginx â†’ Services (REST)
- Service â†” Service (Kafka events)
- Core â†’ Frontend (SignalR WebSocket for real-time)

## Critical Rules for Agents
1. **Read `scope_architecture.tex` FIRST** â€” it is the single source of truth (~2600 lines)
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
- `scope_architecture.tex` â€” Full architecture spec (THE source of truth)
- `scope-assets/design-tokens.css` â€” CSS custom properties for dark/light mode
- `scope-assets/icons/scope-icons.svg` â€” 38 SVG icons
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

# Agent 2: Content Engine â€” Task Instructions

## Your Role
You are the **Content Engine Agent** (codename: **Cartographer**). You build the Python / Django 5 service that handles all content â€” spots, trips, photos, reviews, likes, and the social feed.

## Your Directory Scope
You own: `scope_content/` (and ALL subdirectories)

**Do NOT create or modify** anything outside `scope_content/`.

## Reference
Read `scope_architecture.tex` â€” Sections 4.3, 6, 9, 10, 18, and Appendix A + B.

## Prerequisites
Agent 0 (Foundation) must be complete. SQL Server and Kafka must be running.

## Tasks (in order)

### 1. Initialize Django Project
```bash
django-admin startproject scope_content .
```
Configure `settings.py`:
- Database: SQL Server via `mssql-django`, schema prefix `content`
- Install: `djangorestframework`, `django-filter`, `django-cors-headers`
- JWT middleware for cross-service auth

### 2. Create Django Apps
```bash
python manage.py startapp spots
python manage.py startapp trips
python manage.py startapp photos
python manage.py startapp reviews
python manage.py startapp feed
```
Create `common/` directory for shared utilities.

### 3. Models (Section 4.3)
All models use `content.*` schema:
- `Spot` â€” 16 fields including lat/lng, category (8 choices), vibe, rating
- `Photo` â€” S3Key, S3Url, ThumbnailUrl, caption, sort order
- `Trip` â€” title, dates, budget, currency, status (4 choices), cover photo
- `TripSpot` â€” M2M with day number and sort order
- `TripMember` â€” user + role (owner/editor/viewer)
- `Review` â€” rating (1.0-5.0), comment, unique per user per spot
- `Like` â€” unique per user per spot

### 4. DRF Serializers & Views
Implement ALL endpoints from Section 6.2:

**Spots** (`/api/content/spots`): create, list (paginated + filterable), get, update, delete, nearby (lat/lng/radius), by user, explore, like/unlike, photos

**Trips** (`/api/content/trips`): create, list, get (with spots), update, delete, add/remove/reorder spots, invite/remove/list members, public browse

**Photos** (`/api/content/photos`): upload (S3), delete, update caption, presigned URL

**Reviews** (`/api/content/reviews`): create (per spot), list (per spot), update, delete

**Feed** (`/api/content/feed`): social feed (friends' activity), trending

### 5. S3 Integration
- Presigned upload URLs (1 hour expiry)
- Thumbnail generation with Pillow (300x300)
- **Local fallback:** If `AWS_ACCESS_KEY_ID` is empty, save to `media/` directory

### 6. JWT Auth Middleware
Decode the shared JWT from Core Platform using PyJWT:
```python
import jwt
token = request.META.get('HTTP_AUTHORIZATION', '').split(' ')[1]
payload = jwt.decode(token, settings.JWT_SECRET, algorithms=['HS256'])
request.user_id = payload['sub']
```

### 7. Kafka
**Produce:** `spot.created`, `spot.updated`, `spot.liked`, `trip.created`, `trip.member.added`, `review.created`, `photo.uploaded`
**Consume:** `user.updated`, `friend.accepted`

### 8. Django Admin
Register all models. Enable list display, search, and filters.

### 9. Health Check
`GET /api/content/health` â€” checks DB + S3 connectivity.

### 10. Tests
Pytest + Factory Boy for all endpoints. Test auth, permissions, pagination. Run: `pytest scope_content/`

### 11. Dockerfile
From Section 17.2. Use gunicorn with 3 workers.

## Pagination Format
```json
{
  "data": [...],
  "meta": { "page": 1, "pageSize": 20, "total": 47, "totalPages": 3 }
}
```

## Commits
```
feat(content): scaffold Django project and settings
feat(content): add spot models and migrations
feat(content): add trip models and migrations
feat(content): add photo, review, and like models
feat(content): implement spots API with DRF
feat(content): implement trips API with members
feat(content): implement photo upload with S3
feat(content): implement reviews API
feat(content): implement social feed endpoint
feat(content): add JWT auth middleware
feat(content): add Kafka producer and consumer
feat(content): enable Django admin panel
test(content): add pytest tests for spots API
test(content): add pytest tests for trips API
chore(content): add Dockerfile
```

## Branch
Work on: `feature/content-engine`

## Success Criteria
- All 25+ endpoints return correct responses (see Appendix B for exact shapes)
- JWT auth middleware correctly decodes tokens from Core Platform
- S3 upload works (or local fallback)
- Django Admin shows all models
- Kafka events publish on create/update/like
- All tests pass
- Docker container starts and serves `/api/content/health`
