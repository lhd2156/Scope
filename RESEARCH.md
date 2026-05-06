# Scope — Research & Readiness Dossier

> **Purpose.** This is the single document any future implementation agent (or human) should read before touching a new feature in Scope. It maps the territory, flags the landmines, specifies the test surface for every feature area, and lays out a concrete blueprint for swapping the current hardcoded "sample" recommendation layer for one that learns from real user behavior.
>
> **Tone.** Honest, specific, implementation-ready. No cheerleading. If something is currently a stub, it says "stub."
>
> **Scope.** Covers all four services (`Scope.Core`, `scope_content`, `scope_intel`, `scope-frontend`) plus cross-cutting concerns (Kafka, auth, telemetry, recommendations).
>
> **Last scanned:** 2026-04-22.

---

## 0. TL;DR — The 10 Things Future-You Needs To Know

1. **The Intel service is lying to itself.** `scope_intel/app/services/content_client.py` returns a hardcoded 6-spot tuple (`SAMPLE_SPOTS`). Every recommendation, every vibe match, every itinerary is computed off those six Fort-Worth entries. There is **no HTTP client to Django** inside `ContentServiceClient`. This must be swapped before a single real user interacts with recs.
2. **The frontend silently masks backend failures.** `scope-frontend/src/services/intelService.ts` wraps every Intel call in `try { … } catch { fall back to mockSpots }`. That means if recs return `500` or `[]`, the user still sees plausible cards — which destroys the signal that something is broken. Gate this fallback behind `isScopeQaMode()` only.
3. **Intel has tables nobody reads.** `intel.SpotFeatures`, `intel.UserPreferences`, and `intel.ItineraryCache` are written to by the Kafka consumer but **only `ItineraryCache` is ever read back**. `SpotFeatures.popularity_score` and `sentiment_score` are dead writes.
4. **The only behavioral signal we capture is `spot.liked`.** That's a single bit per (user, spot). Real recommendations need an interaction ledger: views, dwell time, saves, trip additions, searches, dismissals, follows, reviews, completed visits. Section 5 defines the full ledger.
5. **Kafka is half-wired.** Producers publish on write paths (Content, Core), but the Intel consumer's `handle_message` is a pure function — no loop ever calls it in production. There's a `start()` that subscribes but no `poll()` loop driving `handle_message`. See Section 3.3.
6. **The collaborative-filtering score is a placeholder.** `sum(1 for liker in spot.liked_by_users if liker == user_id or liker in liked_spot_likers)` — that's a set-overlap count, not collaborative filtering. Matrix factorization / implicit ALS never materialized.
7. **There is no "why this rec" explainability persistence.** The `reason` field in `recommend_spots` is a format string. When a user says "why am I seeing this?", you cannot audit.
8. **Test coverage is wide but shallow on quality.** 300+ tests exist. Almost all check HTTP status codes and schema shape. Zero tests measure ranking quality (NDCG, MAP, Precision@k), diversity, cold-start behavior, or fairness. Section 4 fixes this.
9. **Auth is consistent.** JWT HS256 + `require_auth`/`IsAuthenticatedJWT`/`[Authorize]` is uniform across all three backends. Future endpoints should follow the existing decorator patterns; don't invent new ones.
10. **Service boundaries are real and well-kept.** No service reads another's tables. Intel talks to Content via (what will become) HTTP, not cross-schema joins. **Preserve this.** The temptation to "just read content.Spots from Intel" must be resisted.

---

## 1. System Map

### 1.1 Services at a glance

| Service | Framework | Entry | Port | Purpose | DB Schema |
|---|---|---|---|---|---|
| `Scope.Core` | ASP.NET Core 8 / C# | `Scope.Core.API/Program.cs` | 5001 | Auth, users, friends, notifications, live GPS sessions, SignalR hubs | `core.*` |
| `scope_content` | Django 5 / DRF | `scope_content/scope_content/urls.py` | 5002 | Spots, trips, photos, reviews, likes, feed | `content.*` |
| `scope_intel` | Flask 3 | `scope_intel/app.py` → `app/factory.py` | 5003 | Itinerary gen, recs, vibe match, route optimize, weather, geocoding | `intel.*` |
| `scope-frontend` | Vue 3 + Vite + TS | `src/main.ts` | 5173 | SPA, Mapbox, Pinia, SignalR client, WASM geo helpers | — |
| `scope-cli` | Rust | `scope-cli/src/main.rs` | — | `scope seed/health/env check/benchmark/deploy` | — |
| `scope-metrics` | Go | `scope-metrics/cmd/scope-metrics` | — | Prometheus exporter + alert webhook | — |
| `scope_geo` | C++/pybind11 | `scope_geo/src/*.cpp` | — | Native haversine, R-tree, A*, convex hull | — |
| `scope_media` | C/ctypes | `scope_media/src/*.c` | — | EXIF strip, thumbnail, blurhash | — |

### 1.2 Request flow (canonical)

```
Browser (Vue) ──► Nginx :80
                    ├─ /api/core/*       → Scope.Core     :80
                    ├─ /api/core/hubs/*  → SignalR WS     (upgrade)
                    ├─ /api/content/*    → scope_content  :8000
                    └─ /api/intel/*      → scope_intel    :5000

Async side-channel:
  Scope.Core  ──► Kafka topic ──► scope_intel consumer ──► intel.SpotFeatures / UserPreferences
  scope_content ──► Kafka topic ──► scope_intel consumer
  scope_content ──► Kafka topic ──► Scope.Core consumer (notifications)

Realtime:
  Scope.Core SignalR ──► Browser  (notifications, trip updates, live GPS)
```

### 1.3 Where state lives

| Data | Owner | Accessed by |
|---|---|---|
| Users, Refresh tokens, Friendships, Notifications, LiveSessions | `core.*` | Scope.Core only |
| Spots, Photos, Trips, TripSpots, TripMembers, Reviews, Likes | `content.*` | scope_content only |
| ItineraryCache, UserPreferences, SpotFeatures | `intel.*` | scope_intel only |
| Photos binary | AWS S3 `scope-photos-*` | scope_content writes, presigned URLs read |
| Session auth state | JWT (stateless) | All three backends validate independently |
| Itinerary results | `intel.ItineraryCache` (hash-keyed, TTL'd) | scope_intel read/write |

### 1.4 Existing API surface (consolidated)

#### Scope.Core (`/api/core`)
- **Auth** `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`
- **Users** `/users/{id}` (GET), `/users/search?q=`
- **Friends** `/friends/request/{userId}` (POST), `/friends/{id}/accept` (PUT). **Missing per spec:** decline, remove, list, pending, block
- **Notifications** `/notifications` (GET, paginated). **Missing per spec:** mark-read, mark-all-read, delete, unread-count
- **Live** `/live/start/{tripId}`, `/live/ping`, `/live/trip/{tripId}`. **Missing per spec:** stop
- **Health** `/health`
- **SignalR hubs** (per architecture doc): TripHub, LocationHub, NotificationHub

#### scope_content (`/api/content`)
- **Spots** `/spots` (GET, POST), `/spots/{id}` (GET/PUT/DELETE), `/spots/nearby`, `/spots/user/{userId}`, `/spots/explore`, `/spots/{id}/like` (POST/DELETE), `/spots/{id}/photos`
- **Trips** CRUD + `/trips/{id}/spots`, `/trips/{id}/members`, `/trips/public` (per `trips/urls.py` — verified exists)
- **Photos** upload, presigned-url, delete, update caption
- **Reviews** write/list/update/delete
- **Feed** `/feed`, `/feed/trending`
- **Health, metrics**

#### scope_intel (`/api/intel`)
- **Itinerary** `/itinerary/generate` (POST), `/itinerary/{id}` (GET)
- **Recommendations** `/recommend/spots` (POST), `/recommend/similar/{spotId}` (POST)
- **Vibe** `/vibe-match` (POST)
- **Routing** `/route/optimize` (POST)
- **Weather** `/weather` (GET)
- **Geocoding** `/geocode`, `/reverse-geocode`
- **Health, metrics**

### 1.5 Frontend route map

| Route | Component | Auth | Pinia stores used |
|---|---|---|---|
| `/` | `HomePage.vue` | public | feed, spots |
| `/explore` | `ExplorePage.vue` | public | spots, map |
| `/map` | `MapPage.vue` | public | map, spots |
| `/trips/new` | `TripPlannerPage.vue` | private | trips, auth |
| `/trips/:id` | `TripDetailPage.vue` | private | trips, notifications |
| `/spots/new`, `/spots/:id/edit` | `SpotComposerPage.vue` | private | spots |
| `/spots/:id` | `SpotDetailPage.vue` | public | spots |
| `/profile/:id` | `ProfilePage.vue` | private | auth, spots, trips |
| `/friends` | `FriendsPage.vue` | private | auth, notifications |
| `/settings` | `SettingsPage.vue` | private | auth, onboarding |
| `/login`, `/register` | auth pages | guest-only | auth |

**Stores:** `auth`, `spots`, `trips`, `map`, `notifications`, `feed`, `onboarding`, `toasts`.

**Services (HTTP/RT clients):** `api`, `authService`, `spotService`, `tripService`, `feedService`, `intelService`, `mapService`, `signalrService`, `s3Service`, `analyticsService`, `mapboxLoader`, `mockDataLoader`, `demoMode`, `wasmService`.

---

## 2. Feature Readiness Matrix

Legend: **✅ real** = wired end-to-end against real infra · **🟡 partial** = works on happy path but missing spec'd branches · **🟧 hardcoded** = functionally a stub using sample/mock data · **❌ missing** = spec'd but not built.

### 2.1 Auth & Identity
| Feature | Frontend | Backend | Status | Gap |
|---|---|---|---|---|
| Register (email/password) | ✅ | ✅ | ✅ real | |
| Login | ✅ | ✅ | ✅ real | |
| Refresh token rotation | ✅ | ✅ | ✅ real | |
| Logout (token revoke) | ✅ | ✅ | ✅ real | |
| Forgot / reset password | ❌ | ❌ | ❌ missing | spec'd, no controller |
| AWS Cognito OAuth | ❌ | ❌ | ❌ missing | `CognitoService` file exists per spec, but no endpoint routes it |
| `/auth/me` | ✅ | ✅ | ✅ real | |
| Role-based admin | ✅ domain | 🟡 | 🟡 partial | `User.Role` exists; no admin-only controller gating anywhere |

### 2.2 Users / Friends / Social
| Feature | Status | Gap |
|---|---|---|
| Get user by id | ✅ real | |
| Search users | ✅ real | |
| Update profile / avatar upload | 🟡 partial | Spec'd `PUT /users/{id}` and `PUT /users/{id}/avatar`; not in `Controllers.cs` |
| User stats (`/users/{id}/stats`) | ❌ missing | Spec'd but no controller; frontend `ProfileStats.vue` reads from spots store |
| Send friend request | ✅ real | |
| Accept friend request | ✅ real | |
| Decline / remove / list / pending / block | ❌ missing | Only `CreateRequest` and `Accept` exist in `FriendsController` |
| Feed of friends' activity | 🟡 partial | `feed_aggregator.py` returns public spots+trips, **not filtered by friendship** |
| Notifications list | ✅ real | |
| Mark read / delete / unread count | ❌ missing | Only list endpoint exists |
| SignalR push notification | 🟡 | Hub file exists; no proof it is wired to events in test coverage |

### 2.3 Spots / Content
| Feature | Status | Gap |
|---|---|---|
| Create / read / update / delete spot | ✅ real | |
| Nearby spots (lat/lng/radius) | ✅ real | Uses bounding-box filter — not great-circle; see §4.3 for test |
| Explore with filters | ✅ real | |
| Like / unlike | ✅ real | Emits `spot.liked` Kafka |
| Photos per spot | ✅ real | |
| Photo upload → S3 → EXIF strip → thumbnail | ✅ real | `scope_media` wired |
| Reviews CRUD | ✅ real | |
| Rating aggregate on `Spot.rating` | 🟧 | `Spot.rating` field is a user-input self-report; no recompute from reviews |
| Likes count on `SpotSummary.likesCount` | ✅ real | via `with_spot_list_relations` |

### 2.4 Trips
| Feature | Status | Gap |
|---|---|---|
| Create / read / update / delete trip | ✅ real | |
| Add / remove / reorder spots | ✅ real | |
| Invite / remove / list members | ✅ real | |
| Public trips index | ✅ real | |
| Trip cover photo | ✅ real | |
| Live GPS location sharing (SignalR) | 🟡 partial | REST endpoints exist; end-to-end "members see each other's pings" is untested |

### 2.5 Intelligence / AI — **The big ones**
| Feature | Status | Gap |
|---|---|---|
| `POST /recommend/spots` | 🟧 **hardcoded** | Reads `SAMPLE_SPOTS`; no real Content data |
| `POST /recommend/similar/{id}` | 🟧 **hardcoded** | Same |
| `POST /vibe-match` | 🟧 **hardcoded** | Same |
| `POST /itinerary/generate` | 🟧 **hardcoded** | `search_spots()` returns sample tuple |
| `POST /route/optimize` | ✅ real | Pure geometric; uses `scope_geo` native |
| `GET /weather` | 🟡 | Stub snapshot; see `weather_service.py` |
| `GET /geocode`, `/reverse-geocode` | 🟡 | Likely stub; verify against real provider |
| Kafka consumer populating `SpotFeatures` | 🟡 | `handle_message` exists; consumer loop not demonstrably running |
| User preference capture | 🟡 | `upsert_preference` called on `user.registered` with hardcoded `["culture", "food"]` |

### 2.6 Observability & Ops
| Feature | Status |
|---|---|
| Structured logging (all services) | ✅ real |
| `/health` endpoints | ✅ real |
| Prometheus `/metrics` | ✅ real |
| Correlation IDs / trace IDs | ✅ real |
| Rate limiting (Nginx + app) | ✅ real |
| CORS / security headers | ✅ real |
| S3 presigned URLs | ✅ real |
| Docker Compose | ✅ real |
| K8s manifests | ✅ real |
| Terraform plan | ✅ real |
| GitHub Actions CI | ✅ real |

### 2.7 Frontend UX
| Feature | Status |
|---|---|
| Dark/light theme | ✅ real |
| PWA manifest + SW | ✅ real |
| iOS safe-area handling | ✅ real |
| Responsive breakpoints | ✅ real |
| Onboarding overlay | ✅ real |
| Analytics (consented) | ✅ real |
| Demo mode (loads mock bundle) | ✅ real |
| **Intel mock fallback hiding failures** | 🟧 **hazard** — §0 point 2 |
| SEO meta + sitemap | ✅ real |
| Accessibility audits | ✅ real |

---

## 3. Critical Architecture Observations

### 3.1 The Recommendation Data Path Is Broken

**What the code actually does:**

```
ContentServiceClient.get_all_spots()
  → returns list(SAMPLE_SPOTS)   # 6 Fort-Worth literals
RecommendationEngine.recommend_spots(...)
  → builds TF-IDF over those 6
  → scores 6 items, returns top-N
```

**What it should do:**

```
ContentServiceClient.get_all_spots(bounding_box, category_hint, limit)
  → GET http://content:8000/api/content/spots?…   (with internal JWT)
  → yields Spot[] from content.Spots, paginated
RecommendationEngine.recommend_spots(user_id, …)
  → reads user history from intel.UserInteractions
  → reads spot features from intel.SpotFeatures
  → scores against full candidate set
  → persists rec explanation to intel.RecommendationAudit
```

See §5 for the full blueprint.

### 3.2 The Frontend Fallback Masks Everything

```typescript
// intelService.ts — present on every Intel call
try {
  const { data } = await api.post(...);
  return ...;
} catch {
  const { mockSpots } = await loadMockData();
  return { data: mockSpots.sort(...).slice(0, limit) };
}
```

This is fine in `isScopeQaMode()` but **disastrous in production** because:
- Zero-real-data renders look identical to broken-backend renders.
- Analytics records engagement with mock content as if it were real.
- Error monitoring never sees the backend failure.

**Fix pattern:**
```typescript
if (isScopeQaMode()) { /* keep fallback */ }
else { throw err; /* let ErrorBoundary + toast surface it */ }
```

### 3.3 Kafka Consumer Is Missing Its Run Loop

`scope_intel/app/kafka/consumer.py` defines `start()` that subscribes and `handle_message(topic, payload)` that dispatches. But **no `poll()` loop** calls `handle_message` in a long-running process. The integration tests monkey-patch `handle_message` directly.

**Fix sketch:**
```python
def run(self) -> None:
    self.start()
    while not self._stop.is_set():
        msg = self._consumer.poll(1.0)
        if msg is None or msg.error(): continue
        self.handle_message(msg.topic(), json.loads(msg.value()))
```
Ship this as a sidecar process in the Intel Docker image (`python -m app.kafka.consumer`).

### 3.4 `SpotFeatures` Is Write-Only

Every `spot.created` / `spot.liked` / `review.created` message writes to `intel.SpotFeatures`, but the `RecommendationEngine` never queries it. It rebuilds TF-IDF from scratch every cache-miss from the (hardcoded) `content_client`. This is expensive and redundant.

### 3.5 `Spot.rating` Is Self-Reported, Not Aggregated

`content.Spots.Rating` is set by the pin's creator. `content.Reviews` has its own ratings. There is no trigger/signal that recomputes `Spots.Rating = AVG(Reviews.Rating)`. Recs using `Spot.rating` are using the author's opinion of their own pin. **Expose both** as `author_rating` and `community_rating`.

### 3.6 The Interaction Ledger Doesn't Exist

To build real recommendations we need to log every user↔spot (and user↔trip) interaction with an event type and timestamp. Today we have:
- `content.Likes` (SpotId, UserId, CreatedAt) — binary
- `content.Reviews` (…Rating, Comment) — rich but rare
- `core.Notifications` — notification-side only

**Missing** (must build before real recs):
- `spot viewed`, `spot detail dwell`, `spot saved (bookmark without liking)`, `spot dismissed in recs`, `spot added to trip`, `spot visited (visited_at set)`, `search query issued`, `search result clicked`, `friend's post clicked`, `rec clicked vs ignored`.

See §5.3 for schema.

### 3.7 Friendship Graph Isn't Used For Feed Or Recs

`feed_aggregator.py` returns **all public** spots/trips ordered by `-created_at` — it does not filter by "friend of `request.user`". The architecture doc explicitly says "Social feed (friends' recent spots + trips)". This is a latent product regression.

---

## 4. Test Case Catalog — Feature-by-Feature

**Conventions used below:**
- `U` = unit, `I` = integration (single service + DB), `C` = contract (Kafka / cross-service), `E` = E2E (Playwright), `Q` = quality (offline evaluation metric), `S` = security, `P` = performance.
- Each row: *Test ID · Type · Precondition · Action · Assertion*.
- These are **specifications**, not yet code. Future implementers should convert them directly into xUnit / pytest / Vitest / Playwright tests.

### 4.1 Auth

| ID | T | Pre | Action | Assert |
|---|---|---|---|---|
| AUTH-U-01 | U | — | `AuthService.HashPassword("hunter2")` twice | Different hashes, both verify |
| AUTH-U-02 | U | — | Issue JWT, decode at each service | Same `sub`, `exp`, `roles` |
| AUTH-I-01 | I | DB clean | `POST /auth/register` | 201, user row present, `PasswordHash` not equal to `"hunter2"` |
| AUTH-I-02 | I | User exists | `POST /auth/login` wrong password | 401, no refresh token issued |
| AUTH-I-03 | I | User exists | 11× bad login in 60s from same IP | 11th returns 429 with `Retry-After` |
| AUTH-I-04 | I | Valid refresh | `POST /auth/refresh` | New access + refresh; old refresh revoked |
| AUTH-I-05 | I | Revoked refresh | Reuse it | 401, row flagged re-used |
| AUTH-S-01 | S | — | Register with `'; DROP TABLE Users; --` as username | 400 from validator, table intact |
| AUTH-S-02 | S | — | Sign a JWT with `alg: none` | All three services reject |
| AUTH-S-03 | S | — | JWT with `exp` in past | 401 everywhere |
| AUTH-E-01 | E | fresh browser | register → login → reload → still authed | true |

### 4.2 Spots CRUD

| ID | T | Pre | Action | Assert |
|---|---|---|---|---|
| SPOT-U-01 | U | — | `SpotSerializer` with `lat=91` | ValidationError |
| SPOT-U-02 | U | — | Serializer with 2001-char description | truncated / rejected (pick one; spec says rejected) |
| SPOT-I-01 | I | — | `POST /spots` no auth | 401 |
| SPOT-I-02 | I | authed | `POST /spots` valid | 201, row in DB, Kafka `spot.created` emitted |
| SPOT-I-03 | I | spot created | `GET /spots/{id}` anon | 200 if public, 404 if private |
| SPOT-I-04 | I | other user's spot | `PUT /spots/{id}` as non-owner, non-admin | 403 |
| SPOT-I-05 | I | owner, public | `DELETE /spots/{id}` | 204, cache invalidated for spots+feed namespaces |
| SPOT-C-01 | C | Content up, Kafka up | Create spot | Intel consumer receives `spot.created` and upserts `SpotFeatures` row |
| SPOT-E-01 | E | authed user | drop pin via `SpotComposerPage` | pin shows on `/map` within 2s |

### 4.3 Geo / Nearby

| ID | T | Pre | Action | Assert |
|---|---|---|---|---|
| NEAR-U-01 | U | — | `NearbyQuerySerializer` rejects `radius=0` | yes |
| NEAR-U-02 | U | — | `radius=10001` | 400 (max 10km per spec) |
| NEAR-I-01 | I | 3 spots at 0.5km, 5km, 50km | `nearby?lat=0&lng=0&radius=10000` (m) | returns first two |
| NEAR-I-02 | I | — | great-circle check vs bounding-box at ±60° latitude | If using bounding-box, flag: at high latitude the box is not circular — test captures known bug |
| NEAR-U-03 | U | native geo avail | `haversine((0,0),(0,180))` | ~20015 km ± 1 |

### 4.4 Friends graph

| ID | T | Pre | Action | Assert |
|---|---|---|---|---|
| FRND-I-01 | I | A, B exist | A → `/friends/request/B` | 201, notif created for B |
| FRND-I-02 | I | pending A→B | A → `/friends/request/B` again | 409 (not 500; add idempotency) |
| FRND-I-03 | I | pending A→B | B → `/friends/{id}/accept` | 200, `friend.accepted` emitted |
| FRND-I-04 | I | accepted | either → `GET /friends` | both see the relationship once |
| FRND-I-05 | I | blocked B | A → request | 403 |
| FRND-S-01 | S | — | Non-participant C accepts A-B request | 403 |
| FRND-E-01 | E | UI | Search friend → request → accept on other account → both see each other | true |

### 4.5 Feed

| ID | T | Pre | Action | Assert |
|---|---|---|---|---|
| FEED-I-01 | I | A friend of B; B has public spot and private spot | `GET /feed` as A | only B's public spot appears |
| FEED-I-02 | I | non-friend C has public spot | `GET /feed` as A | **currently passes even though should fail** — see §3.7; this test encodes the desired behavior after fix |
| FEED-I-03 | I | 50 items, cursor-based | two pages, no overlap, no gap | true |
| FEED-I-04 | I | trending | 4 likes on spot-X this week, 3 on spot-Y | spot-X ranks above spot-Y |
| FEED-Q-01 | Q | — | NDCG@10 of feed ordering vs "chronological ground truth among friends" | ≥ 0.8 |

### 4.6 Trips & Collaboration

| ID | T | Pre | Action | Assert |
|---|---|---|---|---|
| TRIP-I-01 | I | authed | `POST /trips` with dates reversed | 400 |
| TRIP-I-02 | I | trip owner | `POST /trips/{id}/spots` | 201, `trip.spot.added` Kafka |
| TRIP-I-03 | I | viewer | `PUT /trips/{id}/spots/reorder` | 403 |
| TRIP-I-04 | I | — | add same spot twice | 2nd returns 409 (unique constraint) |
| TRIP-E-01 | E | 2 browsers, both members | one adds spot via SignalR → other sees it within 2s | true |
| LIVE-I-01 | I | trip, member | ping at (32.75, -97.33) | session updated, kafka `live.location.updated` |
| LIVE-I-02 | I | no active session | ping | 404 (not 500) |
| LIVE-E-01 | E | geolocation mocked | start sharing → partner sees marker move | true |

### 4.7 Photos

| ID | T | Pre | Action | Assert |
|---|---|---|---|---|
| PHOTO-U-01 | U | — | `ImageProcessor.detect_format(magic_bytes=JPEG)` | `"jpeg"` |
| PHOTO-U-02 | U | JPEG with GPS EXIF | strip | output has no GPS tags, still valid JPEG |
| PHOTO-I-01 | I | 11 MB upload | — | 413 |
| PHOTO-I-02 | I | .exe renamed .jpg | — | 400 (magic check catches) |
| PHOTO-I-03 | I | valid JPEG | upload | row in Photos, S3 key present, thumbnail and blurhash generated, original bytes gone from response |

### 4.8 Recommendations — *new quality-focused suite*

> These are the tests that **must** replace the current two "returns 3 things, status 200" tests before calling recs "done."

| ID | T | Pre | Action | Assert |
|---|---|---|---|---|
| REC-U-01 | U | mock content client returns 100 spots across 8 categories | `recommend_spots(user, liked=[s1], interests=["food"], limit=10)` | all 10 have `spotId ≠ s1`; at least 6 are category=food |
| REC-U-02 | U | as above | same call twice | idempotent ordering (deterministic given fixed inputs) |
| REC-U-03 | U | same | user liked nothing, no interests (cold start) | returns 10, ≥3 distinct categories (diversity floor) |
| REC-U-04 | U | same | all 100 spots have popularity=0 except one with 100 | the popular one is in top-3 but not #1 if user has strong interest divergence (no runaway popularity bias) |
| REC-U-05 | U | — | user's liked spots are in Fort Worth; candidate set spans globe | top-5 median distance < 50 km of liked centroid |
| REC-U-06 | U | — | spot previously dismissed in recs (new `RecommendationAudit.dismissed_at`) | not re-recommended within 7 days |
| REC-Q-01 | Q | holdout: 20% of likes hidden | offline eval | **Precision@10 ≥ 0.25**, **NDCG@10 ≥ 0.30**, **coverage (distinct spots recommended / total) ≥ 0.40** |
| REC-Q-02 | Q | same | Gini of spot-appearance distribution | ≤ 0.6 (long-tail gets surfaced) |
| REC-Q-03 | Q | — | avg pairwise category entropy in a top-10 list | ≥ `log2(4)` ≈ 2.0 (diverse) |
| REC-Q-04 | Q | synthetic user A likes only "food"; user B likes only "culture" | swap their top-10 | ≥ 8/10 different — personalization works |
| REC-I-01 | I | content service live | `POST /recommend/spots` | returns items whose IDs exist in `content.Spots` |
| REC-I-02 | I | content service down | same | 503 (**not** fallback to sample) |
| REC-I-03 | I | — | rate limit: 31 calls in 60s | 31st → 429 |
| REC-S-01 | S | — | call with `userId` ≠ JWT `sub` | 403 |
| REC-E-01 | E | — | load `/explore` | rec section renders 4-8 cards, none duplicate pins I already liked |
| REC-E-02 | E | — | click "not interested" on a card | same card absent on reload for 7d |
| SIM-U-01 | U | 100 spots | `similar(s1, 5)` where s1 has unique category | top-5 share category |
| SIM-U-02 | U | — | similar for unknown id | `[]`, not 500 |
| VIBE-U-01 | U | — | `vibe_match("sunset chill by the water", 5)` | top-5 contain at least 3 with vibe strings containing "chill", "serene", or similar per trained lexicon |

### 4.9 Itinerary

| ID | T | Pre | Action | Assert |
|---|---|---|---|---|
| ITN-U-01 | U | 3 spots, pace=relaxed, 2 days | `_build_days` | each day has ≤ 2 spots, times from `TIME_SLOTS` |
| ITN-U-02 | U | spots all with `estimated_cost=100`, budget=50, group=1 | `generate` | `eligible_spots=[]`, returns empty days, totalCost=0, **doesn't crash** |
| ITN-U-03 | U | outdoor spot + sunny weather | scoring | outdoor wins over indoor equivalent |
| ITN-U-04 | U | same payload twice, same user | second call | served from cache, identical `id` |
| ITN-I-01 | I | — | generate with `endDate < startDate` | 400 |
| ITN-Q-01 | Q | 5 users, each with strong category preference | compare each user's itinerary | user-specific categories dominate their own itineraries |

### 4.10 Route Optimization
| ID | T | Pre | Action | Assert |
|---|---|---|---|---|
| ROUTE-U-01 | U | 3 points at corners of triangle | `optimize` | total pairwise distance in order ≤ brute-force optimal + 15% (nearest-neighbor heuristic bound) |
| ROUTE-U-02 | U | 1 point | — | returns it unchanged |
| ROUTE-U-03 | U | 0 points | — | `[]`, not 500 |
| ROUTE-U-04 | U | native_geo available vs not | same inputs | both produce sensible results; native faster |

### 4.11 Kafka / Cross-service

| ID | T | Pre | Action | Assert |
|---|---|---|---|---|
| KFK-C-01 | C | Kafka up | content emits `spot.created` | intel consumer increments processed counter, row in SpotFeatures |
| KFK-C-02 | C | intel down 30s | content emits 10 events | when intel up, all 10 processed (offsets persisted) |
| KFK-C-03 | C | malformed JSON | — | message DLQ'd, consumer keeps running |
| KFK-U-01 | U | — | producer with Kafka unreachable | publish fails open (no 500 on content `POST /spots`); warning logged |

### 4.12 Frontend

| ID | T | Pre | Action | Assert |
|---|---|---|---|---|
| FE-U-01 | U | — | `authSessionStorage` restore after reload | same token reattached to axios |
| FE-U-02 | U | JWT `exp` in 2s | SPA behavior | silent refresh before expiry, no user-visible blip |
| FE-U-03 | U | intel endpoint 500s, `ScopeQaMode=false` | `intelService.recommendSpots` | throws, ErrorBoundary catches, toast shown |
| FE-U-04 | U | QA mode on, same | resolves with mock | true |
| FE-U-05 | U | `SanitizeSpotSummary` on payload with `<script>` | — | script tags stripped |
| FE-E-01 | E | — | offline (kill network) → navigate `/` | SW serves shell, "you're offline" banner |
| FE-E-02 | E | iOS viewport, notch | — | safe-area insets respected |
| FE-E-03 | E | a11y scan Explore page | axe-core | 0 serious violations |
| FE-P-01 | P | cold load of `/explore` on slow 3G | — | LCP < 3.5s, FID < 100ms (tracked; fails CI if regresses) |

### 4.13 Non-functional

| ID | T | Scenario | Assert |
|---|---|---|---|
| NFR-P-01 | P | 200 concurrent `GET /spots` | p95 < 400ms, error rate < 0.1% |
| NFR-P-02 | P | 50 concurrent `/itinerary/generate` (cold) | p95 < 3s; 50 warm p95 < 200ms |
| NFR-S-01 | S | ZAP baseline scan | 0 high findings |
| NFR-S-02 | S | dep audit | 0 critical `npm/pip/dotnet` advisories |

---

## 5. Real-Data Recommendation Engine — Blueprint

This is the prescription for replacing the hardcoded recommender with one that grows stronger the more real people use Scope. **Four stages**, each shippable independently. Don't try to do it in one go.

### 5.1 Goals
- **No hardcoded spot data, ever.** All candidates come from `content.Spots` via the Content HTTP API.
- **Every user interaction becomes a signal.** Implicit + explicit.
- **Cold start is graceful.** New users and new spots don't see empty rec lists.
- **Every rec is explainable.** The UI can show "because you liked X and you're within 5 km of Y."
- **Quality is measurable.** Offline holdout scores block regression in CI.

### 5.2 Signal Taxonomy — what we log

| Signal | Weight class | Where captured | Stored in |
|---|---|---|---|
| `spot.liked` | strong (+) | existing Django endpoint | `intel.UserInteraction` |
| `spot.unliked` | strong (−) | existing | same |
| `spot.viewed` (detail page opened) | weak (+) | new frontend beacon → Content `/api/content/interactions` | same |
| `spot.dwell_ms` (time on detail > 5s) | medium (+) | same | same |
| `spot.saved` (bookmark) | strong (+) | new `content.Bookmarks` | `content.Bookmarks` + event |
| `spot.dismissed_in_recs` | strong (−) | new endpoint `POST /api/intel/recommend/feedback` | `intel.RecommendationAudit` |
| `spot.added_to_trip` | very strong (+) | existing trip endpoint emits new event | `intel.UserInteraction` |
| `spot.visited_at set` | very strong (+) | existing spot create/update | same |
| `review.created` with rating ≥ 4 | very strong (+) | existing | same |
| `review.created` with rating ≤ 2 | very strong (−) | existing | same |
| `search.query` | context | new frontend beacon | `intel.SearchLog` |
| `search.result_clicked` | medium (+) | new | `intel.UserInteraction` |
| `trip.completed` | very strong (+) for all spots in trip | existing status transition | fan-out |
| `friend.accepted` | graph edge for social-boost | existing | `intel.FriendEdge` (materialized from Kafka) |

**Rule of thumb:** any action the user takes that costs them a click or more should produce an event. Passive mouse hovers don't count.

### 5.3 New Intel Schema

```sql
CREATE TABLE intel.UserInteraction (
    Id             UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserId         UNIQUEIDENTIFIER NOT NULL,
    SpotId         UNIQUEIDENTIFIER NOT NULL,
    InteractionType NVARCHAR(32) NOT NULL,  -- liked, unliked, viewed, dwelt, saved, dismissed, added_to_trip, visited, reviewed_pos, reviewed_neg, searched_click
    Weight         FLOAT NOT NULL,          -- precomputed per signal class at ingest
    Context        NVARCHAR(200) NULL,      -- JSON: {source: "explore"|"detail"|"rec-card"|"search", query?: ...}
    OccurredAt     DATETIME2 NOT NULL,
    INDEX IX_UserInteraction_User (UserId, OccurredAt DESC),
    INDEX IX_UserInteraction_Spot (SpotId, OccurredAt DESC)
);

CREATE TABLE intel.RecommendationAudit (
    Id             UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserId         UNIQUEIDENTIFIER NOT NULL,
    SpotId         UNIQUEIDENTIFIER NOT NULL,
    Rank           INT NOT NULL,
    Score          FLOAT NOT NULL,
    SignalBreakdown NVARCHAR(MAX),         -- JSON: {text: 0.4, collab: 0.12, geo: 0.05, social: 0.2, popularity: 0.03}
    Reason         NVARCHAR(500),
    ServedAt       DATETIME2 NOT NULL,
    ClickedAt      DATETIME2 NULL,
    DismissedAt    DATETIME2 NULL,
    INDEX IX_RecAudit_User (UserId, ServedAt DESC)
);

CREATE TABLE intel.FriendEdge (
    Id             UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserAId        UNIQUEIDENTIFIER NOT NULL,
    UserBId        UNIQUEIDENTIFIER NOT NULL,
    EstablishedAt  DATETIME2 NOT NULL,
    UNIQUE (UserAId, UserBId)
);

-- Augment existing SpotFeatures
ALTER TABLE intel.SpotFeatures ADD
    UniqueVisitors   INT DEFAULT 0,
    LikeCount        INT DEFAULT 0,
    SaveCount        INT DEFAULT 0,
    TripAddCount     INT DEFAULT 0,
    AvgReviewRating  FLOAT NULL,
    AvgDwellMs       FLOAT NULL,
    EmbeddingVector  NVARCHAR(MAX) NULL;   -- JSON float array (128-dim) once we move beyond TF-IDF
```

### 5.4 Two-Stage Ranking

Industry-standard pattern. Always beats a single-pass heuristic.

**Stage 1 — Candidate generation (recall-oriented, fast).** Produce ~200 plausible spots per request from these sources, union them:
1. **Geo cone**: spots within `R` km of request (`destination` or device GPS or centroid of user's liked spots). `scope_geo` R-tree.
2. **Category match**: spots whose category ∈ user's top-3 inferred categories (from interaction history) or explicitly declared interests.
3. **Collaborative**: spots liked/saved by users who liked/saved ≥ 3 of the target user's top-10 spots.
4. **Social**: spots liked by friends in the last 30 days.
5. **Content-similar**: nearest neighbors (by spot embedding) to the user's top-3 interacted spots.
6. **Fresh**: public spots created in last 14 days in the target geography (exploration / anti-staleness).

Cap each source at 50, union, dedupe, drop spots the user already authored, liked, or dismissed.

**Stage 2 — Ranker (precision-oriented).** Score each candidate with a linear combination (learn weights later; start with principled defaults):

```
score = 0.30 * textual_similarity(user_interest_vec, spot_embed)
      + 0.20 * social_proof(friends_who_liked, recency)
      + 0.15 * collaborative_signal(user, spot)
      + 0.12 * geo_relevance(user_geo, spot_geo)
      + 0.10 * popularity_zscore(spot)
      + 0.08 * quality_signal(avg_rating, sentiment)
      + 0.05 * freshness(age_days)
      - 0.50 * negative_signal(dismissed, disliked)
      - 0.15 * diversity_penalty(category_overrepresented_in_topN)
```

Each term normalized to [0, 1] per request (z-score or min-max within candidate pool). Weights live in `intel.config.yaml` so Ops can A/B without redeploys.

**Diversity post-processing.** Apply Maximal Marginal Relevance (MMR) with λ=0.7 to the top 30 to reshuffle so the final list isn't all "food". This is how you hit REC-Q-03.

### 5.5 Cold Start

| Situation | Strategy |
|---|---|
| New user, 0 interactions | Show top spots by (popularity × quality) in their geo (device IP or signup-time city). Category diversity enforced via MMR. Log all renders; the first few clicks bootstrap profile. |
| New spot, 0 likes | Lean on text similarity + geo. Prior = category average popularity. Allow a 7-day "fresh" boost so new spots get exposure before becoming invisible. |
| New user **and** new region (bootstrap) | Fall back to globally curated "editor's picks" queue — but this queue is populated from `intel.SpotFeatures` by an offline job, **not hardcoded**. See §5.7. |

### 5.6 The Editor's-Picks Queue (cold-start fallback — still no hardcoding)

Run nightly:
```sql
-- pseudocode
SELECT TOP 200 s.Id
FROM content.Spots s
JOIN intel.SpotFeatures f ON s.Id = f.SpotId
WHERE s.IsPublic = 1
ORDER BY (f.PopularityScore * 0.5 + f.SentimentScore * 0.3 + f.AvgReviewRating/5 * 0.2) DESC
```
Write to `intel.CuratedQueue` per-city. The "sample data" of the new world — but derived, not written by hand.

### 5.7 Training & Evaluation Harness

1. **Daily ETL (`scope_intel` scheduled job)**: roll up `UserInteraction` → update `SpotFeatures.*Count` and `AvgDwellMs`.
2. **Weekly (as soon as we have ≥ 500 users)**:
   - Train TF-IDF on all `content.Spots.description` + `vibe` + tags. Persist vocabulary hash.
   - Train implicit-feedback matrix factorization (e.g., `implicit.als`) on `UserInteraction` with weights. Export user/spot latent vectors to `SpotFeatures.EmbeddingVector` and a new `UserEmbeddings` table.
3. **Evaluation**:
   - Hold out last 10% of interactions chronologically.
   - Compute `Precision@10`, `Recall@50`, `NDCG@10`, `MAP@10`, **Coverage**, **Gini** (fairness), **Intra-list diversity**.
   - Post to `scope-metrics` as gauges: `scope_rec_ndcg10`, `scope_rec_coverage`, `scope_rec_gini`. Alert on >10% regression.
4. **Online A/B (once traffic > 1000 DAU)**: bucket users by hash(`userId`) % 100; serve control vs candidate weights. Compare CTR + conversion to trip-add.

### 5.8 Content Client — The Critical Rewrite

Replace `scope_intel/app/services/content_client.py` end-to-end.

```python
# --- intended shape, NOT code to paste blindly ---
class ContentServiceClient:
    def __init__(self, base_url: str, service_token_provider: ServiceTokenProvider):
        self._base = base_url                     # http://content:8000
        self._auth = service_token_provider       # mints internal JWT per request
        self._session = requests.Session()
        self._cache = TTLCache(maxsize=4096, ttl=60)  # short TTL; write paths invalidate

    def get_spots(self, *, bbox=None, category=None, since=None, limit=500) -> list[Spot]:
        key = (bbox, category, since, limit)
        if hit := self._cache.get(key): return hit
        params = {...}
        r = self._session.get(f"{self._base}/api/content/spots", params=params, headers=self._auth.header(), timeout=2.0)
        r.raise_for_status()
        result = [Spot(**self._map(row)) for row in r.json()["data"]]
        self._cache[key] = result
        return result

    def get_spot(self, spot_id: str) -> Spot | None: ...
    def get_nearby(self, lat, lng, radius_m, limit=200) -> list[Spot]: ...
    def search_spots(self, destination: str, interests: list[str]) -> list[Spot]: ...  # geocode + nearby
```

**No more `SAMPLE_SPOTS` tuple.** The only place sample data stays is tests, where it becomes `tests/fixtures/spots.json` loaded via a `FakeContentServiceClient` implementing the same interface.

### 5.9 Interaction Capture — Where It Hooks Into the Frontend

Add a tiny service `scope-frontend/src/services/interactionService.ts`:
```
logInteraction({ kind, spotId, context? }) → POST /api/content/interactions
```
Call sites:
- `SpotDetailPage.vue` mounted → `viewed`, after 5s dwell → `dwelt`.
- "Save for later" button → `saved`.
- "Not for me" on rec card → `dismissed` (posts to `/api/intel/recommend/feedback`).
- Search form → `searched` with query; click on result → `searched_click`.
- `TripPlannerPage.vue` add spot → `added_to_trip`.
Batched via `sendBeacon` on unload to avoid losing events.

### 5.10 Rollout Plan (execution order — do NOT reorder)

1. **Schema.** Add `intel.UserInteraction`, `intel.RecommendationAudit`, `intel.FriendEdge`; augment `intel.SpotFeatures`. Migrations only; no code reads them yet.
2. **Event pipeline.** Emit new Kafka topics (`spot.viewed`, `spot.dismissed`, etc.) from Content on new endpoints. Intel consumer writes to `UserInteraction`. Tests KFK-C-01..03 fixed here.
3. **Real `ContentServiceClient`.** Swap hardcoded tuple. Existing REC tests must still pass — but now against a `FakeContentServiceClient` with JSON fixtures.
4. **Remove frontend mock fallback outside QA mode.** Fix REC-I-02 (real 503 on content-down).
5. **Candidate generation.** Refactor `RecommendationEngine._get_spot_similarity_index` into the 6-source union from §5.4.
6. **New ranker weights.** Principled defaults; all pluggable.
7. **Audit log.** Every recommendation served writes to `RecommendationAudit` (fire-and-forget).
8. **Diversity / MMR.** Add REC-U-04, REC-Q-03 tests; make them pass.
9. **Cold start + curated queue.** Nightly job + fallback path.
10. **Offline eval harness.** Precision@10 / NDCG@10 gauge into `scope-metrics`.
11. **Matrix factorization.** Only once ≥ 500 users with ≥ 5 interactions each. Not before.
12. **Online A/B.** Once matrix factorization beats linear baseline offline.

**Do not let step 11 or 12 be done before step 3.** No shortcut makes up for bad data plumbing.

---

## 6. Feature Implementation Readiness — What's Needed Before Each Work Stream

When future you is told "build X", check here first.

### 6.1 "Build password reset"
- Controller: `AuthController.ForgotPassword`, `ResetPassword`.
- Needs: email service (Amazon SES wrapper in `Scope.Core.Infrastructure`), token table (`core.PasswordResetTokens`, single-use, 1h TTL), rate limit (AUTH-I-03 pattern).
- Tests: AUTH-I-06..08 (add).

### 6.2 "Build friend decline / list / pending"
- 4 handlers in `FriendsController`. Reference patterns are already in `NotificationsController.List`.
- Tests: FRND-I-06..09 (add symmetric to FRND-I-04/05).

### 6.3 "Make feed show only friends' posts"
- `feed_aggregator.py:_load_spot_references` must take a `friend_ids` list.
- Intel consumer already hears `friend.accepted`; add `intel.FriendEdge` upsert. Content needs a read-side copy too: subscribe in Content's Kafka consumer → `content.FriendEdgeCache`. (Content cannot read `core.Friendships` across services — keep boundaries.)
- Tests: FEED-I-02 becomes pass-gating.

### 6.4 "Ship real recommendations"
- Follow §5.10 step by step.
- Entry test: REC-I-01 (content service live → rec IDs exist in `content.Spots`). This is the gate-keeper.

### 6.5 "Add SignalR notification delivery"
- `NotificationHub` exists per spec; confirm wiring. Add: when `core.Notifications` row inserted, push to `hub.Clients.User(userId).SendAsync("NotificationReceived", payload)`.
- Tests: NOTIF-I-01 (create notif, WS client receives within 1s).

### 6.6 "Aggregate spot rating from reviews"
- Add Django signal on `Review.save` / `delete` → recompute `Spot.rating` (community) separately from existing self-rating column (rename to `author_rating`).
- Tests: RATING-U-01 (3 reviews of 5/5/3 → community=4.33).

### 6.7 "Password breach check on register"
- Hash-prefix k-anonymity check against `haveibeenpwned.com`.
- Tests: AUTH-S-04 (register with known-breached password → 400).

---

## 7. Anti-Patterns Observed (don't repeat these)

1. **Fallback-in-service-layer hiding errors** (`intelService.ts`). Fallbacks belong in QA fixtures, not production code.
2. **"It returns 200 and has 3 items"** as the entire rec test suite. Quality metrics must live in CI.
3. **Schema owned-but-unread** (`SpotFeatures` dead writes). Any column written but never read is a bug-in-waiting.
4. **Hardcoded sample tuple as production data source** (`SAMPLE_SPOTS`). The classic "I'll wire it up later" that ships.
5. **String-format "reasons" for recs with no persistence.** We can't learn from what we can't replay.
6. **Self-reported `Spot.rating` overloading a "community" name.** Separate author signal from aggregate signal.
7. **`time.sleep` / `time.time` in tests** (check `tests/test_ml_timeout.py`). Use `freezegun` or injected clock.

---

## 8. Glossary & File Pointers

| Term | Lives in |
|---|---|
| Spot | `scope_content/spots/models.py` — `Spot` |
| Interaction event (future) | `scope_intel/app/models.py` — add `UserInteraction` |
| Recommendation audit (future) | `scope_intel/app/models.py` — add `RecommendationAudit` |
| JWT payload | `scope_intel/app/auth.py` + `common/middleware/jwt_auth.py` + `Scope.Core.Infrastructure` auth service |
| Kafka topics | Producer: per-service `kafka_producer.py`; Consumer (Intel): `scope_intel/app/kafka/consumer.py` |
| Native geo | `scope_intel/app/services/native_geo.py` → `scope_geo/` |
| Mock data (frontend) | `scope-frontend/src/services/mockData.ts`, `mockDataLoader.ts`, `socialMockData.ts`, `demoMedia.ts` |
| Feature extraction | `scope_intel/app/ml/feature_extraction.py` |
| Similarity model | `scope_intel/app/ml/model_loader.py` (TF-IDF wrapper) |

---

## 9. How To Use This Document

- **Starting a new feature?** §2 tells you if it exists, §6 tells you what to build, §4 gives you the test cases.
- **About to touch recommendations?** Read §3.1–3.6 first, then §5 cover-to-cover. Do not skip §5.10.
- **Writing tests?** §4 is the catalog — copy the IDs into test names so reports are greppable.
- **Adding a Kafka topic?** Update §3.3 and §5.2; add a KFK-C-xx test.
- **Onboarding a new agent?** Give them §0 and §1, then route by task.

This file is living. Update it when reality changes — it's the memory that makes future implementation *smooth*.
