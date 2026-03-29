# Atlas API Reference

This document is a practical route reference for the API surface currently present in the repository.

It is intended as a developer-facing quick map, not a replacement for:

- `atlas_architecture.tex` (architecture source of truth)
- service-level tests
- serializer / schema definitions

## Conventions

### Response envelopes

Atlas APIs use service-specific response conventions that were aligned during the audit passes:

- **Core** commonly returns `ApiResponse<object>` envelopes for business endpoints
- **Content** commonly returns `{ data: ... }` envelopes for detail/mutation responses, with paginated list responses using DRF pagination structures
- **Intel** commonly returns `success_response(...)` envelopes
- **Health endpoints** may intentionally return a bare JSON object instead of the standard business envelope

### Auth expectations

- Core protected routes require JWT auth
- Content protected routes use JWT-backed Django auth/permissions
- Intel business routes generally require auth; health does not

---

## Core API (`/api/core`)

Source: `Atlas.Core/Atlas.Core.API/Controllers/Controllers.cs`

### Auth

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/core/auth/register` | create user account |
| POST | `/api/core/auth/login` | issue access/refresh credentials |
| POST | `/api/core/auth/refresh` | refresh access credentials |
| POST | `/api/core/auth/logout` | revoke refresh token / end session |
| GET | `/api/core/auth/me` | return the current authenticated user |

### Users

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/core/users/{id}` | fetch a user profile by id |
| GET | `/api/core/users/search?q=...` | search active users by username/display name |

### Friends

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/core/friends/request/{userId}` | send a friend request |
| PUT | `/api/core/friends/{id}/accept` | accept a pending friend request |

### Notifications

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/core/notifications?page=1&pageSize=20` | list notifications for the current user |

### Live sessions

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/core/live/start/{tripId}` | start live trip sharing |
| PUT | `/api/core/live/ping` | update current live location |
| GET | `/api/core/live/trip/{tripId}` | list active live sessions for a trip |

### Health

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/core/health` | health/status summary |

---

## Content API (`/api/content`)

Source:

- `atlas_content/atlas_content/urls.py`
- `atlas_content/*/urls.py`
- service views under `spots/`, `trips/`, `photos/`, `reviews/`, `feed/`

### Health

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/content/health` | content service health |

### Spots

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/content/spots/` | list spots visible to the caller |
| POST | `/api/content/spots/` | create a new spot |
| GET | `/api/content/spots/nearby` | geospatial nearby-spot query |
| GET | `/api/content/spots/explore` | public explore feed for spots |
| GET | `/api/content/spots/user/{userId}` | public spots for a given user |
| GET | `/api/content/spots/{spotId}` | retrieve spot detail |
| PUT | `/api/content/spots/{spotId}` | update spot detail |
| DELETE | `/api/content/spots/{spotId}` | delete a spot |
| POST | `/api/content/spots/{spotId}/like` | like a spot |
| DELETE | `/api/content/spots/{spotId}/like` | unlike a spot |
| GET | `/api/content/spots/{spotId}/photos` | list photos attached to a spot |

### Trips

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/content/trips/` | list the authenticated user’s trips/collaborations |
| POST | `/api/content/trips/` | create a trip |
| GET | `/api/content/trips/public` | list public trips |
| GET | `/api/content/trips/{tripId}` | retrieve trip detail |
| PUT | `/api/content/trips/{tripId}` | update trip detail |
| DELETE | `/api/content/trips/{tripId}` | delete a trip |
| POST | `/api/content/trips/{tripId}/spots` | add/update a trip spot |
| PUT | `/api/content/trips/{tripId}/spots/reorder` | reorder trip spots |
| DELETE | `/api/content/trips/{tripId}/spots/{spotId}` | remove a trip spot |
| GET | `/api/content/trips/{tripId}/members` | list trip members |
| POST | `/api/content/trips/{tripId}/members` | add or upsert a trip member |
| DELETE | `/api/content/trips/{tripId}/members/{userId}` | remove a non-owner trip member |

### Photos

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/content/photos/upload` | upload/store a photo for a spot |
| GET | `/api/content/photos/presigned-url` | request an upload URL |
| PUT | `/api/content/photos/{photoId}` | update photo metadata |
| DELETE | `/api/content/photos/{photoId}` | delete a photo |

### Reviews

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/content/reviews/spot/{spotId}` | list reviews for a spot |
| POST | `/api/content/reviews/spot/{spotId}` | create or upsert the caller’s review for a spot |
| PUT | `/api/content/reviews/{reviewId}` | update a review |
| DELETE | `/api/content/reviews/{reviewId}` | delete a review |

### Feed

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/content/feed/` | authenticated social feed |
| GET | `/api/content/feed/trending` | trending public spots |

---

## Intel API (`/api/intel`)

Source: `atlas_intel/app/api/*.py`

### Itineraries

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/intel/itinerary/generate` | generate an itinerary and cache the result |
| GET | `/api/intel/itinerary/{itineraryId}` | retrieve a cached itinerary by id |

### Recommendations

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/intel/recommend/spots` | generate spot recommendations for a user/context |
| POST | `/api/intel/recommend/similar/{spotId}` | generate similar-spot recommendations |

### Vibe matching

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/intel/vibe-match` | match a freeform description to Atlas vibes/spots |

### Route optimization

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/intel/route/optimize` | optimize route ordering across candidate stops |

### Weather

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/intel/weather` | forecast lookup for planning |

### Geocoding

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/intel/geocode` | forward geocode a query string |
| GET | `/api/intel/reverse-geocode` | reverse geocode coordinates |

### Health

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/intel/health` | service health/status summary |

---

## Frontend-facing integration note

For browser integration work, the frontend expects these service families to be reachable behind the edge proxy:

- `/api/core`
- `/api/content`
- `/api/intel`

Current reverse-proxy wiring is documented in `docs/DEPLOYMENT.md`.

## Related docs

- `README.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION-HARDENING.md`
- `atlas_architecture.tex`
