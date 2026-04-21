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

# Agent 3: Intelligence API â€” Task Instructions

## Your Role
You are the **Intelligence Agent** (codename: **Oracle**). You build the Python / Flask 3 service that handles AI-powered itinerary generation, spot recommendations, vibe matching, route optimization, weather, and geocoding.

## Your Directory Scope
You own: `atlas_intel/` (and ALL subdirectories)

**Do NOT create or modify** anything outside `atlas_intel/`.

## Reference
Read `atlas_architecture.tex` â€” Sections 4.4, 7, 9, 10, 18, and Appendix A + B.

## Prerequisites
Agent 0 (Foundation) must be complete. SQL Server and Kafka must be running.

## Tasks (in order)

### 1. Initialize Flask Project
Use application factory pattern:
```python
# app.py
def create_app():
    app = Flask(__name__)
    app.config.from_object(config)
    register_blueprints(app)
    register_error_handlers(app)
    return app
```

### 2. Route Blueprints
Create blueprints in `routes/`:
- `itinerary.py` â€” `/api/intel/itinerary/*`
- `recommendations.py` â€” `/api/intel/recommend/*`
- `weather.py` â€” `/api/intel/weather`
- `geocoding.py` â€” `/api/intel/geocode`, `/api/intel/reverse-geocode`

### 3. Itinerary Generation (Section 7.3)
`POST /api/intel/itinerary/generate`

Algorithm:
1. Receive: destination, dates, budget, interests, pace, group size
2. Query Content Engine API for spots in area
3. Score each spot: `S = w1*rating + w2*vibeMatch + w3*popularity - w4*cost`
4. Filter by budget
5. Apply pace (relaxed=3 spots/day, moderate=5, packed=8)
6. Optimize route order (nearest-neighbor heuristic)
7. Factor in weather (outdoor spots on sunny days)
8. Group by day, assign time slots
9. Cache result in `intel.ItineraryCache`
10. Return structured itinerary (see Appendix B for response shape)

### 4. Recommendation Engine (Section 7.4)
`POST /api/intel/recommend/spots`
- Content-based: TF-IDF on descriptions + category matching
- Collaborative: Users who liked similar spots also liked X
- Uses scikit-learn: `TfidfVectorizer`, `cosine_similarity`

`POST /api/intel/recommend/similar/{spotId}`
- Find spots with similar feature vectors

### 5. Vibe Matcher
`POST /api/intel/vibe-match`
- Embed vibe tags into vector space
- Cosine similarity matching
- Return top N matching spots

### 6. Route Optimizer
`POST /api/intel/route/optimize`
- Nearest-neighbor heuristic for TSP
- Input: list of spot coordinates
- Output: optimized order with distances

### 7. Weather & Geocoding
- `GET /api/intel/weather?lat=&lng=&date=` â€” external weather API
- `GET /api/intel/geocode?q={query}` â€” address to coordinates
- `GET /api/intel/reverse-geocode?lat=&lng=` â€” coordinates to address

### 8. JWT Auth
Custom decorator:
```python
from functools import wraps
import jwt

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').split(' ')[1]
        payload = jwt.decode(token, current_app.config['JWT_SECRET'], algorithms=['HS256'])
        request.user_id = payload['sub']
        return f(*args, **kwargs)
    return decorated
```

### 9. Input Validation
Use Marshmallow schemas for all request bodies.

### 10. Kafka Consumer
Consume events and update `intel.*` tables:
- `spot.created` â†’ extract features, insert `SpotFeatures`
- `spot.liked` â†’ increment `PopularityScore`
- `review.created` â†’ run sentiment analysis, update `SentimentScore`
- `user.registered` â†’ create default `UserPreferences`

### 11. Health Check
`GET /api/intel/health` â€” checks DB + ML model loaded.

### 12. Tests
Pytest for itinerary, recommendations, vibe matcher. Run: `pytest atlas_intel/tests/`

### 13. Dockerfile
From Section 17.3. Use gunicorn with 2 workers.

## Commits
```
feat(intel): scaffold Flask app with factory pattern
feat(intel): add itinerary generation endpoint
feat(intel): implement itinerary algorithm
feat(intel): add spot recommendation engine
feat(intel): add vibe matching service
feat(intel): add route optimizer
feat(intel): add weather and geocoding endpoints
feat(intel): add JWT auth decorator
feat(intel): add Kafka consumer for spot features
test(intel): add pytest tests for itinerary
test(intel): add pytest tests for recommendations
chore(intel): add Dockerfile
```

## Branch
Work on: `feature/intel-api`

## Success Criteria
- Itinerary generates multi-day plans with correct time slots and costs
- Recommendations return relevant spots
- Vibe matching finds similar spots
- Route optimizer produces shorter total distance
- Kafka consumer processes events and updates tables
- All tests pass
- Docker container starts and serves `/api/intel/health`
