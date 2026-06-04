# Scope Backend API Reference

This is the practical backend route and event inventory for the code currently in this repository. The current code and route contract tests are the source of truth; older architecture notes may be stale.

## Response Conventions

- Core returns `ApiResponse<object>` for business routes. `/api/core/health` returns a health JSON object.
- Content returns `{ "data": ... }` for most detail/mutation routes. List routes may use the DRF pagination envelope.
- Intel returns `success_response(...)` / `error_response(...)` envelopes. Health and metrics are operational endpoints.
- All services emit `X-Correlation-Id` and structured request logs.

## Auth Summary

- Core protected routes use ASP.NET JWT auth.
- Content protected routes use JWT-backed DRF permissions.
- Intel protected routes use `@require_auth`.
- Metrics endpoints are unauthenticated but IP/CIDR allowlisted.

## Core API

Base path: `/api/core`

Operational endpoints:

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/core/health` | Public | DB is hard dependency; Redis/Kafka are surfaced as degraded checks |
| GET | `/metrics` | CIDR allowlist | Prometheus metrics |

Auth routes:

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/core/auth/register` | Public, auth rate limit | Publishes `user.registered` |
| POST | `/api/core/auth/login` | Public, auth rate limit | Returns 401 with `mfaRequired` when MFA is required |
| POST | `/api/core/auth/refresh` | Public, auth rate limit | Refresh token rotation |
| POST | `/api/core/auth/logout` | Public, auth rate limit | Revokes refresh token when provided |
| GET | `/api/core/auth/me` | JWT | Current user |
| POST | `/api/core/auth/password-reset/request` | Public, auth rate limit | Always returns accepted; publishes reset request when applicable |
| POST | `/api/core/auth/password-reset/complete` | Public, auth rate limit | Publishes password changed |
| POST | `/api/core/auth/email/verify/send` | JWT | Publishes verification request |
| POST | `/api/core/auth/email/verify` | Public, auth rate limit | Confirms verification token |
| POST | `/api/core/auth/mfa/enroll` | JWT | Starts MFA enrollment |
| POST | `/api/core/auth/mfa/enroll/confirm` | JWT | Confirms MFA code |
| POST | `/api/core/auth/mfa/disable` | JWT | Disables MFA |

Users:

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/core/users/{id}` | JWT | Email is only included for self/admin |
| PUT | `/api/core/users/{id}` | JWT, self/admin | Updates profile fields |
| GET | `/api/core/users/{id}/stats` | JWT | Private counts only for self/admin |
| GET | `/api/core/users/search?q=...` | JWT | Searches username/display name; does not search or return email |

Friends:

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/core/friends/request/{userId}` | JWT | Creates pending request and notification |
| PUT | `/api/core/friends/{id}/accept` | JWT, addressee only | Publishes `friend.accepted` |
| PUT | `/api/core/friends/{id}/reject` | JWT, addressee only | Publishes `friend.rejected` |
| DELETE | `/api/core/friends/{id}` | JWT, either party | Publishes `friend.removed` |
| GET | `/api/core/friends` | JWT | Paginated accepted friends |
| GET | `/api/core/friends/pending` | JWT | Pending inbound requests |

Notifications:

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/core/notifications?page=1&pageSize=20` | JWT | Caller-owned notifications |
| GET | `/api/core/notifications/unread-count` | JWT | Caller unread count |
| GET | `/api/core/notifications/preferences` | JWT | Caller notification delivery preferences |
| PUT | `/api/core/notifications/preferences` | JWT | Upserts per-category in-app/push/email preference |
| POST | `/api/core/notifications/push-subscriptions` | JWT | Saves browser Web Push subscription |
| PUT | `/api/core/notifications/{id}/read` | JWT, owner | Cross-user ids return 404 |
| PUT | `/api/core/notifications/read-all` | JWT | Marks caller notifications read |
| POST | `/api/core/notifications/{id}/actions` | JWT, owner | `open`, `mute_category`, friend accept/decline |
| DELETE | `/api/core/notifications/{id}` | JWT, owner | Cross-user ids return 404 |

Live sessions:

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/core/live/start/{tripId}` | JWT, Content trip member | Uses Content HTTP membership lookup |
| PUT | `/api/core/live/ping` | JWT, Content trip member | Publishes `live.location.updated` |
| GET | `/api/core/live/trip/{tripId}` | JWT, Content trip member | Active sessions for trip |
| POST | `/api/core/live/stop/{tripId}` | JWT, Content trip member | Publishes `live.session.stopped` |

SignalR hubs:

| Path | Auth | Notes |
|---|---|---|
| `/api/core/hubs/trips` | JWT | Trip collaboration; validates trip membership through Content |
| `/api/core/hubs/location` | JWT | Live location |
| `/api/core/hubs/notifications` | JWT | User notifications |

## Content API

Base path: `/api/content`

Operational endpoints:

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/content/health` | Public | DB plus storage/local media health |
| GET | `/api/content/metrics` | CIDR allowlist | Prometheus metrics |
| GET | `/metrics` | CIDR allowlist | Prometheus metrics alias |

Search:

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/content/search` | Public | Search across content indexes/fallbacks |
| GET | `/api/content/search/nearby` | Public | Nearby geospatial search |

Spots:

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/content/spots/` | Public/read scoped | Lists public plus caller-visible private spots |
| POST | `/api/content/spots/` | JWT | Publishes `spot.created` |
| GET | `/api/content/spots/nearby` | Public/read scoped | Validated lat/lng/radius query |
| GET | `/api/content/spots/explore` | Public | Public explore list |
| GET | `/api/content/spots/user/{userId}` | Public | Public spots for user |
| GET | `/api/content/spots/{spotId}` | Public/read scoped | Private spots hidden unless owner/admin |
| PUT | `/api/content/spots/{spotId}` | JWT, owner/admin | Publishes `spot.updated` |
| DELETE | `/api/content/spots/{spotId}` | JWT, owner/admin | Deletes index entry |
| POST | `/api/content/spots/{spotId}/like` | JWT | Publishes `spot.liked` when newly liked |
| DELETE | `/api/content/spots/{spotId}/like` | JWT | Removes caller like |
| GET | `/api/content/spots/{spotId}/photos` | Public/read scoped | Photos for visible spot |

Trips:

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/content/trips/` | JWT | Caller-created/member trips |
| POST | `/api/content/trips/` | JWT | Publishes `trip.created` |
| GET | `/api/content/trips/public` | Public | Public trips |
| GET | `/api/content/trips/share/{token}` | Public by token | Shared trip detail |
| GET | `/api/content/trips/{tripId}` | Public/read scoped | Public or caller-member trip |
| PUT | `/api/content/trips/{tripId}` | JWT, owner/editor | Updates trip, spots, optional members |
| DELETE | `/api/content/trips/{tripId}` | JWT, owner | Publishes `trip.deleted` |
| POST | `/api/content/trips/{tripId}/share` | JWT, owner | Creates/refreshes share token |
| POST | `/api/content/trips/{tripId}/spots` | JWT, owner/editor | Adds saved or planner-generated spot |
| PUT | `/api/content/trips/{tripId}/spots/reorder` | JWT, owner/editor | Reorders existing trip spots |
| DELETE | `/api/content/trips/{tripId}/spots/{spotId}` | JWT, owner/editor | Removes a trip spot |
| GET | `/api/content/trips/{tripId}/members` | JWT, trip member | Lists members |
| POST | `/api/content/trips/{tripId}/members` | JWT, owner | Publishes `trip.member.added` when new |
| DELETE | `/api/content/trips/{tripId}/members/{userId}` | JWT, owner | Cannot remove owner |

Photos:

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/content/photos/upload` | JWT, spot owner/admin | Publishes `photo.uploaded`; may publish `photo.thumbnail.requested` |
| GET | `/api/content/photos/presigned-url` | JWT | Returns unavailable local response when S3 keys are absent |
| PUT | `/api/content/photos/{photoId}` | JWT, owner/admin | Updates metadata |
| DELETE | `/api/content/photos/{photoId}` | JWT, owner/admin | Deletes photo row |

Reviews:

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/content/reviews/spot/{spotId}` | Public/read scoped | Reviews for visible spot |
| POST | `/api/content/reviews/spot/{spotId}` | JWT | Publishes `review.created` for first review |
| PUT | `/api/content/reviews/{reviewId}` | JWT, owner/admin | Updates review |
| DELETE | `/api/content/reviews/{reviewId}` | JWT, owner/admin | Deletes review and index entry |

Comments:

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/content/comments/?targetType=spot&targetId={id}` | Public/read scoped | Lists top-level comments for visible spot/trip |
| POST | `/api/content/comments/` | JWT | Creates comment; publishes `comment.created` and optional `mention.created` |
| POST | `/api/content/comments/{commentId}/replies/` | JWT | Creates one-level reply |
| PUT | `/api/content/comments/{commentId}/` | JWT, owner/admin | Updates comment body after safety check |
| DELETE | `/api/content/comments/{commentId}/` | JWT, owner/admin | Soft deletes comment |

Feed and interactions:

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/content/feed/` | JWT | Social feed |
| GET | `/api/content/feed/trending` | Public | Trending public spots |
| POST | `/api/content/interactions/` | JWT | Persists interaction and publishes `interaction.recorded` |

## Intel API

Base path: `/api/intel`

Operational endpoints:

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/intel/health` | Public | DB and ML readiness |
| GET | `/api/intel/metrics` | CIDR allowlist | Prometheus metrics |
| GET | `/metrics` | CIDR allowlist | Prometheus metrics alias |
| GET | `/api/intel/ml/info` | Public | Runtime/model readiness |

Business endpoints:

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/intel/itinerary/generate` | JWT | Generates and caches itinerary per user/request hash |
| GET | `/api/intel/itinerary/{itineraryId}` | JWT, owner | Reads cached itinerary |
| POST | `/api/intel/agent/plan-trip` | JWT | Agentic planner with wall-clock fallback |
| POST | `/api/intel/recommend/spots` | JWT | Personalized/curated spot recs |
| POST | `/api/intel/recommend/similar/{spotId}` | JWT | Similar spots |
| POST | `/api/intel/recommend/feedback` | JWT | Click/dismiss audit feedback |
| POST | `/api/intel/recommend/ncf` | JWT | NCF model when artifacts are present, fallback otherwise |
| POST | `/api/intel/vibe-match` | JWT | Vibe matching |
| POST | `/api/intel/route/optimize` | JWT | Route ordering |
| POST | `/api/intel/travel/nearby` | JWT | Route-aware nearby lodging, food, fuel, and stop suggestions |
| GET | `/api/intel/weather` | JWT | Forecast lookup |
| GET | `/api/intel/weather/current` | JWT | Current weather snapshot with backend caching and source freshness |
| GET | `/api/intel/geocode` | JWT | Forward geocode |
| GET | `/api/intel/reverse-geocode` | JWT | Reverse geocode |
| GET | `/api/intel/fuel/stations` | JWT | Google Places fuel lookup; unavailable response when key is absent |
| GET | `/api/intel/place-photo` | JWT | Google Places photo lookup; unavailable response when key is absent |

Public ML utilities:

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/intel/sentiment` | Public | Heuristic/model sentiment |
| POST | `/api/intel/classify-image` | Public | Image classification |
| POST | `/api/intel/predict-trip` | Public | Trip cost/duration prediction |

## Event Inventory

Content publishes envelope-shaped events through `ScopeKafkaProducer`:

```json
{
  "eventId": "uuid",
  "eventType": "spot.created",
  "timestamp": "2026-05-12T00:00:00Z",
  "source": "content-engine",
  "data": {}
}
```

Produced by Content:

| Topic | Producer path | Primary consumer |
|---|---|---|
| `spot.created` | spot create | Intel feature consumer |
| `spot.updated` | spot update | Intel feature consumer |
| `spot.liked` | spot like | Intel feature/interaction consumer, Core notifications |
| `review.created` | first review on spot | Intel feature/interaction consumer, Core notifications |
| `comment.created` | comment/reply create | Core notifications |
| `mention.created` | comment mentions | Core notifications |
| `interaction.recorded` | interaction endpoint | Intel interaction consumer |
| `trip.created` | trip create | Core friend activity notifications |
| `trip.deleted` | trip delete | Kafka topic provisioned; no current Intel handler |
| `trip.member.added` | trip member add | Core notifications |
| `photo.uploaded` | photo upload | Kafka topic provisioned |
| `photo.thumbnail.requested` | async thumbnail upload path | Content thumbnail worker |
| `photo.thumbnail.ready` | thumbnail worker success | Kafka topic provisioned |
| `photo.thumbnail.failed` | thumbnail worker DLQ | Kafka topic provisioned |

Produced by Core:

| Topic | Producer path | Primary consumer |
|---|---|---|
| `user.registered` | account registration | Intel preference bootstrap |
| `user.email_verification_requested` | email verification send | Email dispatcher/future worker |
| `user.password_reset_requested` | password reset request | Email dispatcher/future worker |
| `user.password_changed` | password reset complete | Audit/future worker |
| `friend.accepted` | friend accept | Intel friend edge mirror |
| `friend.removed` | friend delete | Intel friend edge mirror |
| `friend.rejected` | friend reject | Intel friend edge mirror |
| `live.location.updated` | live ping | Realtime/future worker |
| `live.session.stopped` | live stop | Realtime/future worker |

Consumed by Intel:

- `spot.created`
- `spot.updated`
- `spot.liked`
- `review.created`
- `interaction.recorded`
- `friend.accepted`
- `friend.removed`
- `friend.rejected`
- `user.registered`

Replay/idempotency:

- Spot feature events upsert by `spot_id`.
- Friend events upsert/delete bidirectional `FriendEdges`; replays are no-ops.
- Interaction-like events persist `source_event_id` from the Kafka envelope or domain id so duplicate deliveries do not double count affinity.
- Content thumbnail worker retries in-process without committing failed offsets; poison records are published to `photo.thumbnail.failed` after configured attempts.

## Background Workers

| Worker | Local/docker command | K8s wiring | Notes |
|---|---|---|---|
| Content thumbnail worker | `python manage.py scope_thumbnail_worker` | `content-worker` Deployment | Consumes `photo.thumbnail.requested` |
| Content outbox replay | `python manage.py replay_outbox_events --status failed` | Run as ops job | Replays failed Content Kafka publishes |
| Content Celery worker | `celery -A scope_content worker ...` | Compose only currently | Async Django tasks |
| Core notification consumer | hosted service in Core | Core Deployment | Consumes Content notification topics and writes notifications |
| Core notification delivery dispatcher | hosted service in Core | Core Deployment | Sends pending push/email delivery attempts |
| Intel Kafka worker | `python -m app.kafka.consumer_worker` | `intel-worker` Deployment | Consumes spot/review/interaction/friend events |
| gRPC servers | started during app boot when `GRPC_ENABLED=true` | Content 50051, Intel 50052 | Health services registered |

## Provider-Key-Dependent Paths

| Service | Provider/config | Behavior without key |
|---|---|---|
| Content photos | `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Falls back to local media storage; presigned URL returns `enabled: false` |
| Intel fuel | `GOOGLE_PLACES_API_KEY` | Returns configured=false with clear coverage message |
| Intel place photos | `GOOGLE_PLACES_API_KEY` | Returns `photoUrl: null` and clear coverage message |
| Intel geocoding | `GEOCODE_API_KEY` optional for configured provider | Falls back to provider-free/local behavior where implemented |
| Intel agent | Ollama env/config | Uses fallback plan text on planner/model failures |
| Core HIBP | `HibpPasswordPolicy:Enabled` | Disabled by default; local password policy still applies |
| Core Web Push | `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`, frontend `VITE_WEB_PUSH_PUBLIC_KEY` | Push delivery attempts fail with `web_push_not_configured`; in-app notifications still work |

Production config should not rely on fixture fallbacks. Intel's Content client uses fixtures only in tests or before Flask app context exists; outside tests, missing `CONTENT_SERVICE_URL` is a startup/config error.

## Backend Wiring Notes

- `docker-compose.yml` provisions Core, Content, Intel, `content-worker`, `intel-worker`, Redis/Kafka/SQL Server, and a one-shot `kafka-init` profile for all known backend topics.
- `k8s/05-kafka.yaml` includes `kafka-topic-init` because Kubernetes disables Kafka auto topic creation.
- `k8s/06-applications.yaml` exposes Content gRPC on 50051 and Intel gRPC on 50052, uses HTTP health probes for backend web pods, and includes `content-worker` and `intel-worker`.
- Core does not read Content tables directly. Live trip membership uses Content HTTP.
- Intel reads Content through `ContentServiceClient` HTTP and mirrors Core friendships through Kafka.

## Local Verification Blockers

Current local verification observed during this sprint:

- Core build succeeds with the installed SDK.
- Core test execution is blocked locally because `Microsoft.AspNetCore.App` 8.0.0 is missing; only ASP.NET Core 10.0.7 is installed.
- Vulnerability scanning is blocked by local disk exhaustion: C: reported 0 bytes free during NuGet/pip-audit cache/temp writes. After clearing generated repo build/cache artifacts, only limited space was recovered, so package audit results should not be treated as complete.
