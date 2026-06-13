# Scope Trips Production Certification - Phase 4 Evidence

Date: 2026-06-11

## Phase 4 Goal

Inventory every deployable app, route, UI surface, API endpoint, worker/job, CLI, database/schema/seed asset, queue/cache/search/metrics dependency, Cloudflare Pages/Worker/DNS/TLS item, AWS/Terraform resource, and deployment workflow. Map each item to the tests or checks that should cover it. Do not pursue broad fixes except tiny documentation corrections. End with an evidence document, unresolved unknowns, and the bounded Phase 5 objective.

## Outcome

Phase 4 is a freeze-and-map phase only. No Docker stack was started, no production deploy was performed, and no broad fixes were attempted.

The certification track is currently six bounded phases:

1. Baseline, Rust SQL seed, local inventory, and local smoke
2. Production API header gate
3. Durable deploy alignment for the API header fix
4. Inventory freeze and certification map
5. Automated gate execution and coverage baseline
6. Browser UX, accessibility, security, infrastructure recovery, rollback, and final production evidence

Production smoke was green at the Phase 4 freeze point:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 `
  -EdgeBaseUrl https://scopetrips.com `
  -MetricsHealthUrl https://scopetrips.com/api/metrics/health `
  -SkipMetricsScrape `
  -TimeoutSeconds 20
```

Result:

```text
Passed: 6/6
All Scope smoke checks passed.
```

## Evidence Sources

- Local source inventory from deploy manifests, router files, controller files, SQL assets, CI workflows, Terraform modules, Docker Compose, Kubernetes manifests, and test files.
- Read-only Cloudflare inventory through Wrangler for Pages projects and Worker versions/deployments.
- Read-only DNS and TLS probes for `scopetrips.com`, `www.scopetrips.com`, `app.scopetrips.com`, and `api.scopetrips.com`.
- Read-only AWS inventory for EC2 compose hosts, S3 buckets, Cognito pools, SSM managed instances, ECR, and Route 53.
- Existing test coverage anchors from repository test names and package scripts.

## Deployable Runtime Inventory

| Item | Deploy targets | Runtime surface | Required checks |
| --- | --- | --- | --- |
| API proxy Worker | `cloudflare/api-proxy/wrangler.toml` route `scopetrips.com/api/*` | Same-domain API proxy to `api.scopetrips.com` | `npx wrangler deploy --dry-run --config cloudflare/api-proxy/wrangler.toml`; Worker version/deployment list; production smoke; header-count probes |
| WWW redirect Worker | `cloudflare/www-redirect/wrangler.toml` route `www.scopetrips.com/*` | Redirect to apex | Wrangler dry-run/list; redirect smoke for `www.scopetrips.com` |
| Cloudflare Pages site | `scope-site` project `scopetrips-site` | Public marketing/content site on `scopetrips.com` | `npm run build`; `npm test`; `npm run test:e2e`; Pages deployment list; production page smoke |
| Cloudflare Pages app redirect artifact | `scope-frontend/public/_redirects`; project `scopetrips-app` | `app.scopetrips.com` redirects to apex app paths | `npm run build`; redirects smoke; Pages deployment list |
| Nginx edge | `nginx/Dockerfile`, `nginx/nginx.conf`, Compose and K8s edge manifests | API routing, SPA serving, headers, TLS/certbot challenge, health | `nginx -t`; CI header contract; deploy preflight; smoke; duplicate-header probes |
| Core API | `Scope.Core/Scope.Core.API`, Compose `core`, K8s `core` | Auth, users, friends, notifications, live/presence, social safety | `dotnet build Scope.Core.sln`; `dotnet test Scope.Core.sln`; Core route contract tests; production `/api/core/health` smoke |
| Content API | `scope_content`, Compose `content`, K8s `content` | Spots, trips, photos, reviews, comments, feed, interactions, search | `python manage.py check`; `python -m pytest`; endpoint spec audit; IDOR/JWT/security/rate-limit tests; `/api/content/health` smoke |
| Content migrations | Compose `content-migrate`; Django migrations | Content DB schema migration | `python manage.py migrate --check` or controlled migration run; migration rollback review |
| Content thumbnail worker | Compose/K8s `content-worker` | Photo thumbnail processing | worker command smoke; photo upload/thumbnail tests; queue/dead-letter checks |
| Content Celery worker | Compose/K8s `content-celery` | Async content jobs, reindex, outbox-style tasks | Celery task tests; Redis/RabbitMQ connectivity; management command tests |
| Intel API | `scope_intel`, Compose/K8s `intel` | Weather, geocode, recommendations, place verification, trip AI | `python -m pytest tests`; endpoint spec audit; auth/rate/security tests; `/api/intel/health` smoke |
| Intel worker | Compose/K8s `intel-worker` | ML/background recommendation tasks | Intel worker tests; broker connectivity; logs/health check |
| RAG API | `scope-rag`, Compose/K8s `rag` | Ask, Scope AI, ingest, search, app knowledge, local vector store | `python -m pytest tests`; routes/security/vectorstore tests; `/api/rag/health` smoke |
| Frontend SPA | `scope-frontend`, Compose/K8s `frontend`, Cloudflare Pages app artifact | Primary user app | `npm run build`; unit coverage; Playwright critical flows; visual/responsive/a11y checks; production app smoke |
| Marketing site | `scope-site`, Compose/K8s `site`, Cloudflare Pages site | Public site/blog/legal/download pages | `npm run build`; `npm test`; Playwright site E2E; production page smoke |
| Admin app | `scope-admin`, Compose/K8s `admin` | Admin dashboard/users/spots/reviews/photos | `npm run build`; `npm test`; admin E2E; auth boundary checks |
| Metrics service | `scope-metrics` | Service health and application metrics | `go test ./...`; `/api/metrics/health` smoke; Prometheus scrape in non-production or allowlisted environment |
| Scope CLI | `scope-cli` | Ops health, seed, deploy validate, benchmark, env check | `cargo test`; `scope-cli health`; `scope-cli seed --dry-run`; deploy validate/env check |
| SQL Server | Compose/K8s `sqlserver`; Terraform RDS option still present | Core/content/intel databases | schema apply checks; CLI seed; integration tests; backup/restore check |
| Redis | Compose/K8s `redis` | Cache, rate limiting, Celery broker/cache support | service health; rate-limit tests; Celery connectivity tests |
| Kafka and Zookeeper | Compose/K8s `kafka`, `zookeeper`, `kafka-init`/`kafka-topic-init` | Event streaming and notifications | topic init check; Core/Content/Intel event producer/consumer tests |
| RabbitMQ | Compose/K8s `rabbitmq` | Queue/broker for async jobs | health check; worker connectivity; queue depth/retry checks |
| Elasticsearch | Compose/K8s `elasticsearch` | Content search/indexing | search tests; reindex command; health probe |
| Ollama | Compose/K8s `ollama` | Local LLM dependency for AI/RAG flows | health probe; model availability check; bounded AI route smoke |
| Prometheus | Compose/K8s `prometheus` | Metrics scraping | config validation; target health; scrape smoke |
| Grafana | Compose/K8s `grafana` | Metrics dashboarding | provisioning validation; login/access smoke |
| Certbot | Compose profile `tls` | TLS certificate issuance/renewal for non-Cloudflare-origin paths | dry-run renewal in staging; ACME challenge path smoke |

## Compose and Kubernetes Inventory

Docker Compose services frozen in scope: `sqlserver-volume-init`, `sqlserver`, `zookeeper`, `kafka`, `kafka-init`, `redis`, `elasticsearch`, `rabbitmq`, `content-media-init`, `ollama-volume-init`, `ollama`, `core`, `content-migrate`, `content`, `content-worker`, `content-celery`, `intel`, `intel-worker`, `rag`, `scope-metrics`, `scope-cli`, `frontend`, `site`, `admin`, `nginx-volume-init`, `nginx`, `certbot`, `prometheus`, and `grafana`.

GPU override: `docker-compose.gpu.yml` provides an Intel GPU build override.

Kubernetes resources frozen in scope:

- Namespace/service identity: `scope`, `content-aws`
- Config/secrets: `scope-shared-config`, `scope-secrets` example
- Datastores: SQL Server Service/PVC/StatefulSet; Redis Service/Deployment; RabbitMQ Service/PVC/StatefulSet; Elasticsearch Service/PVC/StatefulSet; Ollama Service/PVC/Deployment
- Streaming: Zookeeper Service/PVCs/Deployment; Kafka Service/PVC/Deployment; `kafka-topic-init` Job
- Apps: Core, Content, Intel, RAG, Metrics, Site, Admin, Frontend Deployments/Services; content/intel workers; content Celery worker
- CLI automation: `scope-cli-health` CronJob
- Edge: Nginx ConfigMap/Deployment/Service and `scope` Ingress
- Monitoring: Prometheus/Grafana ConfigMaps/Deployments/Services/PVCs
- Policies: default deny, internal allow, DNS allow, external HTTPS allow, pod identity allow, ingress controller allow

Required checks: `docker compose config`, profile-specific config validation, K8s YAML/schema validation, Nginx config validation, health/readiness probe review, and Phase 5 service-specific automated tests.

## Frontend Route and UI Surface Map

### Main App Routes

| Route | Surface | Required checks |
| --- | --- | --- |
| `/` | `HomePage` | router unit, app shell unit, navigation E2E, production smoke |
| `/explore` | `ExplorePage` | explore unit, search/store tests, production data flow E2E |
| `/map` | `MapPage` | map page/unit tests, Mapbox loader tests, responsive/device E2E |
| `/trips` | `TripsWorkspacePage` | trips store/service tests, trip E2E |
| `/trips/new` | `TripPlannerPage` | trip planner unit, AI assist unit, planner E2E |
| `/trips/:id/edit` | `TripPlannerPage` | authenticated edit journey, persistence/refresh checks |
| `/ai/trip-planner`, `/ai/ask`, `/scope/ai` | AI redirect/Scope AI surfaces | route redirect tests, Scope AI matrix E2E |
| `/trips/shared/:token` | `TripDetailPage` public share | anonymous share E2E, auth boundary tests |
| `/trips/:id` | `TripDetailPage` | trip detail unit/E2E, member/privacy checks |
| `/spots/new` | `SpotComposerPage` | spot form unit, upload service tests |
| `/spots/:id/edit` | `SpotComposerPage` | spot edit persistence/authorization E2E |
| `/spots/:id` | `SpotDetailPage` | spot detail/review/photo units, production data flow E2E |
| `/profile/:id` | `ProfilePage` | profile page/map units, account boundary checks |
| `/friends` | `FriendsPage` | friends unit/social flow E2E |
| `/notifications` | `NotificationsPage` | notifications store/service tests, realtime/push preference checks |
| `/settings` | `SettingsPage` | settings form tests, autosave/persistence checks |
| `/login` | `LoginPage` | auth flow E2E, auth store/service tests |
| `/register` | `RegisterPage` | auth flow E2E, validation tests |
| `/onboarding/preferences` | `OnboardingPreferencesPage` | onboarding store tests, onboarding E2E |
| `/privacy`, `/terms`, `/cookies`, `/accessibility`, `/security`, `/about`, `/help` | `LegalPage` | route smoke, content snapshot/a11y checks |
| catch-all | `NotFoundPage` | router fallback test |

### Main App Component Groups

| Group | Files | Required checks |
| --- | --- | --- |
| Shell/common | `AppShell`, `AppFooter`, `AppErrorBoundary`, `AuthSessionRuntime`, `Avatar`, `Button`, `CookieConsentBanner`, `EmptyStatePanel`, `ForYouSection`, `GuestNavbar`, `LazyImage`, `LoadingSpinner`, `Modal`, `Navbar`, `OnboardingOverlay`, `PageHero`, `RouteViewLoader`, `ScopeIcon`, `SearchBar`, `SectionHeading`, `Sidebar`, `SkeletonBlock`, `StarRatingDisplay`, `TabBar`, `ThemeToggle`, `Toast`, `ToastViewport`, `VirtualList` | unit tests where present, route smoke, visual/a11y/responsive pass |
| Auth | `AuthSplitShell`, `AuthField`, `DateField` | auth/date-field unit tests, login/register E2E |
| Map | `MapView`, `MapControls`, `SpotMarker`, `ClusterMarker`, `RouteLayer`, `LocationTracker`, map helper modules | map unit tests, device emulation E2E, canvas/map loading checks |
| Profile/settings | `ProfileHeader`, `ProfileAdventureCard`, `ProfileStats`, `ProfileMap`, `ProfileWorkspaceSkeleton`, `SettingsForm` | profile/settings unit tests, account-boundary and autosave E2E |
| Social/friends | `FeedItem`, `FeedItemSkeleton`, `FriendList`, `NotificationDropdown`, `UserCard`, `FriendCard`, `RequestCard`, `SuggestionCard` | social/friends unit tests, notifications/friends E2E |
| Spots | `SpotForm`, `SpotDetail`, `SpotCard`, `SpotCardSkeleton`, `NearbySpots`, `PhotoGallery`, `ReviewForm`, `ReviewList`, `ReviewSentiment` | spot/review/photo unit tests, upload and persistence E2E |
| Trips/AI | `TripPlanner`, `TripPlannerAiAssist`, `FloatingTripAiAssistant`, `TripDetail`, `TripCard`, `TripCollaborationBar`, `TripShareModal`, `TripTimeline`, `ItineraryView`, `MemberList` | trip planner/detail/unit tests, Scope AI matrix, share/member E2E |
| Stores/services | auth, feed, friends, map, notifications, onboarding, scopeAiPlanner, search, spots, toasts, trips, user stores; API/auth/feed/friend/fuel/intel/interaction/map/presence/push/RAG/S3/search/signalR/spot/travel/trip/user/wasm services | unit tests, contract mocks, authenticated and anonymous E2E journeys |

### Site Routes

| Route | Surface | Required checks |
| --- | --- | --- |
| `/` | `HomePage` | site unit/E2E, production smoke |
| `/features` | `FeaturesPage` | site unit/E2E |
| `/about` | `AboutPage` | site unit/E2E |
| `/blog` | `BlogPage` | router/content tests |
| `/blog/:slug` | `BlogPostPage` | router/content tests |
| `/download` | `DownloadPage` | site unit/E2E |
| `/privacy` | `LegalPage` privacy | legal route smoke |
| `/terms` | `LegalPage` terms | legal route smoke |
| catch-all | redirect to `/` | router fallback test |

Site source surface: `App.vue`, `main.ts`, `router.ts`, `data.ts`, `style.css`, and page files listed above.

### Admin Routes

| Route | Surface | Required checks |
| --- | --- | --- |
| `/login` | `LoginPage` | admin auth unit/E2E |
| `/dashboard` | `DashboardPage` | dashboard store/API tests, admin E2E |
| `/users` | `UsersPage` | Core user API mock tests, admin E2E |
| `/users/:id` | `UserDetailPage` | authz/account boundary checks |
| `/spots` | `SpotsPage` | Content API mock tests |
| `/trips` | trips simple/admin page | Content trip API checks |
| `/reviews` | `ReviewsPage` | review moderation checks |
| `/photos` | `PhotosPage` | upload/photo moderation checks |
| `/analytics` | analytics simple/admin page | metrics/API checks |
| `/settings` | settings simple/admin page | admin settings smoke |
| catch-all | redirect `/dashboard` | router fallback test |

Admin source surface: `AdminShell`, app/router/main files, API clients for Core/Content/Intel, auth/dashboard stores, page files, formatter utilities, and typed models.

## API Endpoint Map

### Core API

| Controller/surface | Endpoints | Required checks |
| --- | --- | --- |
| Health | `GET /api/core/health` | smoke, controller tests |
| Auth | register, login, refresh, logout, me, password reset request/complete, email verify send/complete, MFA enroll/confirm/disable under `/api/core/auth` | auth controller/service tests, route contract, auth E2E |
| Users | `GET/PUT/DELETE /api/core/users/{id}`, stats, search | users controller tests, IDOR/authz tests |
| Friends | request, accept, reject, delete, list, pending, suggestions under `/api/core/friends` | friends controller tests, social E2E |
| Notifications | list, unread count, read/read-all, preferences, push subscriptions, actions, delete under `/api/core/notifications` | notification controller/service tests, realtime/push preference E2E |
| Notification ops | delivery/outbox list and replay under `/api/core/notifications/admin` | admin authz tests, replay service tests |
| Live/presence | live start/ping/trip/stop; presence heartbeat | live/presence tests, SignalR/realtime checks |
| Social safety | blocks, unblock, report under `/api/core/social-safety` | authz/security tests |

### Content API

| Surface | Endpoints | Required checks |
| --- | --- | --- |
| Health/metrics/search | health, metrics, search, nearby search | endpoint spec audit, security headers, search tests |
| User cleanup | `DELETE /api/content/users/me` | account cleanup/auth boundary tests |
| Spots | list/create, compose, nearby, explore, saved, user spots, detail update/delete, like/unlike, photos | endpoint spec audit, spots API tests, IDOR/JWT/rate tests |
| Trips | list/create, public, share token, detail update/delete, share, spots add/remove/reorder, members add/list/remove | endpoint spec audit, trips API tests, public/private boundary E2E |
| Photos | upload, presigned URL, avatar upload/content, content fetch, update/delete | S3/upload/image processing/thumbnail tests, abuse-size/type checks |
| Reviews | spot reviews create/list, review update/delete | review API tests, sentiment integration checks |
| Comments | list/create, update/delete, replies | comments API tests, auth/rate checks |
| Feed/interactions | feed, trending, interactions | feed/interactions tests, search/index checks |

### Intel API

| Surface | Endpoints | Required checks |
| --- | --- | --- |
| Public health/info | `GET /api/intel/health`, metrics, ML info | route health tests, smoke |
| Location/weather | geocode, reverse geocode, weather, weather/current, travel/nearby, fuel stations, place photo | route tests, provider fallback tests, auth/rate checks |
| ML/recommendations | image classification, sentiment, vibe match, predict trip, spot recommendations, NCF, similar spot, feedback | ML/recommendation tests, endpoint spec audit |
| Trip AI | itinerary generate/get, agent plan-trip, agent trip-chat, route optimize | trip planner/orchestrator tests, auth/rate/security checks |
| Place verification | place verify | verification tests, upload/input abuse checks |

### RAG API

| Surface | Endpoints | Required checks |
| --- | --- | --- |
| Public health | `GET /api/rag/health` | route health/smoke |
| Authenticated AI/search | `POST /api/rag/ask`, `POST /api/rag/scope-ai`, `GET /api/rag/search`, `GET /api/rag/app-knowledge` | RAG route/security/retriever tests, frontend Scope AI matrix |
| Admin ingest | `POST /api/rag/ingest` | ingest authz tests, vector store persistence checks |

## Data, Jobs, and CLI Map

### SQL Assets

| Asset | Purpose | Required checks |
| --- | --- | --- |
| `scripts/sql/000_create_app_user.sql` | App SQL identity/bootstrap | dry-run review; local SQL apply |
| `scripts/sql/core/001_core_schema.sql` | Core schema | Core integration tests; schema apply |
| `scripts/sql/core/002_core_seed_data.sql` | Core seed data | Rust CLI seed check; login/profile smoke |
| `scripts/sql/core/003_security_enhancements.sql` | Core security schema | auth/security tests |
| `scripts/sql/core/004_notifications_platform.sql` | Notifications schema | notification tests |
| `scripts/sql/core/005_datetimeoffset_alignment.sql` | Date/time alignment | persistence/regression tests |
| `scripts/sql/core/006_showcase_users.sql` | Showcase users | seed verification; UI profile smoke |
| `scripts/sql/core/007_profile_privacy.sql` | Profile privacy | profile/account-boundary tests |
| `scripts/sql/content/001_content_schema.sql` | Content schema | Content integration tests; migrations |
| `scripts/sql/content/002_content_seed_data.sql` | Content seed data | Explore/spots/trips smoke |
| `scripts/sql/intel/001_intel_schema.sql` | Intel schema | Intel integration tests |
| `scripts/sql/intel/002_intel_seed_data.sql` | Intel seed data | recommendation/AI smoke |

### Background Jobs and Integrations

| Item | Purpose | Required checks |
| --- | --- | --- |
| Core notification event consumer | Kafka notification ingestion | Core service tests; Kafka topic/consumer smoke |
| Core notification outbox replay dispatcher | Reliable notification replay | outbox/replay tests; bounded replay smoke |
| SignalR hubs | Realtime notifications/presence | hub tests; browser realtime journey |
| Content thumbnail worker | Photo derivative generation | image processing tests; upload E2E |
| Content Celery tasks | async content work and reindexing | task/management tests; queue health |
| Content Elasticsearch indexing | spot/search indexing | reindex command; search tests |
| Intel worker | async ML/recommendation jobs | Intel worker/unit tests; broker health |
| RAG ingestion/vector store | knowledge ingestion/search | ingestion/vectorstore tests; persistence check |
| K8s `scope-cli-health` CronJob | scheduled health CLI | manifest validation; dry-run job execution |

### CLI

| Command family | Purpose | Required checks |
| --- | --- | --- |
| `health` | service health checks | `cargo test`; dry-run against local/prod-safe endpoints |
| `seed` | Rust SQL ingestion/seed orchestration | `cargo test`; seed dry-run; controlled local seed apply |
| `deploy validate` | deployment config validation | `cargo test`; CI/deploy preflight |
| `benchmark` | bounded performance checks | `cargo test`; opt-in benchmark run |
| `env check` | environment validation | `cargo test`; local/prod-safe env check |

## Cloudflare, DNS, and TLS Inventory

| Item | Frozen evidence | Required checks |
| --- | --- | --- |
| Pages project `scopetrips-site` | Production domains include `scopetrips.com` and `www.scopetrips.com`; recent production deployment on `main` observed | Pages deployment list; site build/test/E2E; apex/www smoke |
| Pages project `scopetrips-app` | Production domain includes `app.scopetrips.com`; app domain redirects to apex | Pages deployment list; redirect smoke |
| API proxy Worker | Current deployment has version `6cc2cc01-5dd7-4360-8504-1dd83fa325fe` at 100%; route is `scopetrips.com/api/*` | Worker source diff against local, dry-run/deploy audit, smoke |
| WWW redirect Worker | Route is `www.scopetrips.com/*` | redirect smoke |
| DNS | `scopetrips.com`, `www.scopetrips.com`, `app.scopetrips.com`, and `api.scopetrips.com` resolve to Cloudflare edge A/AAAA records | DNS resolve checks; Cloudflare DNS export/review |
| TLS | Google Trust Services edge certificates observed for apex, www, app, and API hostnames; current observed expirations are 2026-09-02 | TLS expiry monitor; certificate chain checks |
| Security headers | `_headers`, Nginx, API proxy, and smoke script define/verify browser-facing security headers | security header smoke; duplicate-header probes; CSP review |

## AWS and Terraform Inventory

| Terraform area | Resources in scope | Required checks |
| --- | --- | --- |
| Bootstrap state | S3 backend bucket, versioning, encryption, public access block, bucket policy, DynamoDB lock table | `terraform fmt`; `terraform init -backend=false`; backend access/recovery runbook |
| Credit guard | budget and guardrail data resources | `terraform validate`; budget alert verification |
| DNS module | Route 53 zone/records are declared but no live Route 53 scope zone was observed in the read-only inventory | `terraform plan`; reconcile with Cloudflare DNS as source of truth |
| VPC | VPC, flow logs, IGW, public/private subnets, NAT, route tables | `terraform validate/plan`; AWS inventory diff |
| IAM | EKS roles, node roles, pod identity role/policy for content | IAM least-privilege review; access analyzer/checkov/trivy IaC |
| EC2 compose | key pair, security group, instance profile/role/policies, DLM role/policy, EC2 instance, EIP | production preflight; SSM reachability; app-only deploy check |
| Lightsail compose | key pair, instance, static IP, disk, disk attachment, public ports | inventory reconciliation; retire/confirm platform choice |
| Data/storage | SQL Server/RDS resources, KMS keys, S3 photos buckets, S3 policies, lifecycle/versioning/public access block | backup/restore check; bucket policy/IaC security scan |
| Cognito | production and staging user pools, clients, domains | auth flow tests; password/MFA/callback policy review |
| ECR/EKS | ECR repositories and EKS cluster/addons/node groups are declared | live inventory reconciliation; image publish/signature checks |

Live AWS read-only inventory found a running production EC2 compose host, stopped staging compose hosts, production/staging photos buckets, production/staging Terraform state buckets, production/staging Cognito pools, and an online production SSM managed instance. No matching ECR repositories or Route 53 hosted zones were observed during this freeze.

## Deployment Workflows

| Workflow | Jobs/surfaces | Required checks |
| --- | --- | --- |
| CI | compose validate, infrastructure validate, Core, Content, Intel, RAG, Metrics, CLI, Frontend, Admin, Site, CodeQL, secret scan, Trivy filesystem, SBOM, pre-commit, security headers smoke, image signing | run or inspect latest CI; reproduce failing jobs locally where feasible |
| Deploy | preflight, GHCR image publish, Terraform plan/apply, ECR image publish, Kubernetes deploy, compose-host deploy, deployment bundle | production preflight; app-only compose deploy dry-run/approval path; rollback rehearsal |
| Production smoke | `scripts/smoke-test.ps1` | pass 6/6 before and after any production-affecting phase |
| Production preflight | `scripts/production-preflight.ps1` | required before deploy workflows; includes Nginx header guard |
| Local recovery runbook | `.local-runbooks/scope-recovery-runbook.md`, intentionally excluded from Git | verify local-only status; no secret values; rehearse read-only recovery steps |

## Existing Test Anchors

- Core: `Scope.Core/Scope.Core.Tests` includes controller, service, middleware, hub, route contract, auth, notification, user, friends, health, and presence coverage.
- Content: `scope_content/common/tests` and app-specific tests include endpoint spec audit, JWT enforcement, IDOR probes, CORS, rate limiting, security headers, S3/photo/image processing, search/indexing, tasks, management commands, spots, trips, reviews, comments, and feed coverage.
- Intel: `scope_intel/tests` includes endpoint spec audit, auth/rate/security, health, ML, recommendation, geocode/weather, place verification, trip planner, and trip AI orchestrator coverage.
- RAG: `scope-rag/tests` covers app catalog, chain, ingestion, retriever, routes, Scope AI chat, security, and vector store embeddings.
- Frontend: `scope-frontend/tests` includes unit tests plus Playwright auth, critical flows, device emulation, map, navigation, notifications, production button/data sweeps, Scope AI chat matrix, social, spot, trip, and theme flows.
- Site: site unit/router/surface tests and E2E tests.
- Admin: admin API/router/store/surface tests and admin E2E tests.
- Metrics: Go tests in `scope-metrics`.
- CLI: Rust inline tests in `scope-cli/src/main.rs`.

## Phase 5 Gate Map

Phase 5 should execute the non-browser automated gates first, because those are the fastest way to separate known code health from later browser/security exploration:

| Gate | Command/check family | Stop condition |
| --- | --- | --- |
| Core | `dotnet build Scope.Core.sln`; `dotnet test Scope.Core.sln` | pass or one concrete blocker |
| Content | `python manage.py check`; `python -m pytest` | pass or one concrete blocker |
| Intel | `python -m pytest tests` | pass or one concrete blocker |
| RAG | `python -m pytest tests` | pass or one concrete blocker |
| Metrics | `go test ./...` | pass or one concrete blocker |
| CLI/Rust SQL | `cargo test`; seed dry-run; deploy/env checks | pass or one concrete blocker |
| Frontend | `npm run build`; unit coverage command | pass or one concrete blocker |
| Site | `npm run build`; `npm test` | pass or one concrete blocker |
| Admin | `npm run build`; `npm test` | pass or one concrete blocker |
| Infrastructure config | `docker compose config`; K8s manifest validation; Terraform fmt/validate/plan where credentials allow | pass or one concrete blocker |
| Edge/Cloudflare | Wrangler dry-run/list checks; DNS/TLS/header probes | pass or one concrete blocker |
| Production smoke | `scripts/smoke-test.ps1` | pass 6/6 or one concrete blocker |

## Unresolved Unknowns

- The live API proxy Worker is deployed and currently points at version `6cc2cc01-5dd7-4360-8504-1dd83fa325fe`, but the exact deployed source should still be reconciled against `cloudflare/api-proxy/src/index.js` before treating it as audited.
- Production EC2 is still known from prior phases to be serving an older release directory with the Phase 2 Nginx hotfix applied to the mounted config; the app-only deploy path exists but has not been executed in this phase.
- Cloudflare dashboard-level DNS, WAF, transform rule, cache rule, and TLS mode settings were not fully exported. Only Wrangler, DNS, and TLS probes were used.
- Cloudflare DNS is active, while Terraform still declares Route 53 DNS resources. The ownership boundary should be explicitly reconciled before DNS automation changes.
- Current line/branch/function coverage percentages were not measured in Phase 4. This phase mapped existing tests and required gates only.
- UI component coverage is mapped by route/component group and existing test anchors. Phase 5/6 should confirm exact per-suite coverage and browser evidence.
- Production data persistence, refresh/session/account-boundary journeys were not re-executed in Phase 4.
- No Docker stack was started during Phase 4, so local container runtime health was not revalidated in this phase.

## Bounded Phase 5 Objective

Phase 5: Automated Gate Execution and Coverage Baseline. From the Phase 4 inventory map, run only the non-browser automated gates: Core build/test, Content check/pytest, Intel pytest, RAG pytest, Metrics Go tests, CLI Cargo tests plus Rust SQL seed dry-run/deploy/env checks, frontend/site/admin build and unit coverage gates, Docker Compose config validation, Kubernetes manifest validation, Terraform fmt/validate/plan where credentials allow, Wrangler dry-run/list checks, DNS/TLS/header probes, and the production smoke command. Record exact pass/fail evidence and coverage percentages where suites emit them. Fix only validated release-blocking defects required to make these gates pass. Stop when every listed automated gate has either passed or has one concrete documented external blocker. Do not start browser UX, accessibility, persistence, broad security, recovery, rollback, or final certification work until Phase 5 is closed.
