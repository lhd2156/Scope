# Core Platform Progress

## Status: IN PROGRESS

## Tasks
- [x] 1. Scaffold ASP.NET Core project (API, Domain, Infrastructure, Tests)
- [x] 2. Domain layer (User, Friendship, Notification, LiveSession entities)
- [x] 3. Infrastructure layer (EF Core, repos, Kafka, S3, Cognito)
- [x] 4. API — Auth endpoints (register, login, refresh, logout, OAuth)
- [x] 5. API — Users, Friends, Notifications, Live endpoints
- [x] 6. SignalR hubs (TripHub, LocationHub, NotificationHub)
- [x] 7. Middleware (rate limiting, exception handling, logging)
- [x] 8. Health check endpoint
- [x] 9. Unit tests (xUnit + Moq)
- [x] 10. Dockerfile (multi-stage)
- [x] 11. Run `dotnet restore && dotnet build` to validate compilation
- [x] 12. Run `dotnet test` to validate test suite
- [x] 13. Fix any build errors, missing NuGet packages, or test failures

## Current Task: Implement gzip/brotli response compression
## Last Updated: 2026-03-29T14:45:00Z

## Log
- All core platform code scaffolded in single commit on feature/core-platform
- 024d83d feat(core): scaffold ASP.NET Core project structure
- Previous blocker "no .NET SDK" was WRONG — dotnet 8.0.419 IS installed at C:\Program Files\dotnet\dotnet.exe
- Branch issue: committed while on feature/intel-api instead of feature/core-platform — needs cleanup
- Agent MUST run `dotnet restore` and `dotnet build` inside Atlas.Core/ to validate
- Agent MUST run `dotnet test` inside Atlas.Core.Tests/ to validate tests
- Agent MUST fix any compilation errors or test failures before marking COMPLETE
- 2026-03-29T02:18:00Z restore/build passed via C:\Program Files\dotnet\dotnet.exe with 0 warnings and 0 errors
- 2026-03-29T02:19:00Z test suite passed: 2 tests, 0 failures, 0 skipped
- 2026-03-29T02:19:00Z no build errors, missing NuGet packages, or test failures remained; core platform validation complete
- 2026-03-29T08:38:47Z re-read agents.md and atlas_architecture.tex, then audited Section 5.2 endpoint coverage against Atlas.Core controllers
- 2026-03-29T08:38:47Z added the missing auth/users/friends/notifications/live routes and a route-contract xUnit test that enforces all 31 documented core REST endpoints
- 2026-03-29T08:38:47Z reran build/test in Atlas.Core, fixed the AuthService test constructor dependency, and passed build (0 warnings, 0 errors) plus tests (3 passed, 0 failed)
- 2026-03-29T09:13:00Z completed the Phase 5 source-hygiene audit in Atlas.Core by verifying there are no TODO/FIXME markers, debug writes, or placeholder localhost/dev secret strings in production source
- 2026-03-29T09:13:00Z centralized remaining core magic values/config keys, removed the JWT placeholder fallback from appsettings, and added JwtTokenService plus source-hygiene xUnit coverage to keep the cleanup enforced
- 2026-03-29T09:13:00Z reran Atlas.Core build/test after the cleanup and passed build (0 warnings, 0 errors) plus tests (7 passed, 0 failed)
- 2026-03-29T09:22:00Z updated RateLimitMiddleware to enforce the architecture's dual policy: 100 requests/minute globally and 10 requests/minute on /api/core/auth endpoints, with Retry-After headers on 429 responses
- 2026-03-29T09:22:00Z added xUnit middleware coverage for auth routes, non-auth API routes, and SignalR hub negotiate routes so the rate limit policy is verified across the core endpoint surface
- 2026-03-29T09:22:00Z reran Atlas.Core build/test after the rate-limit hardening and passed build (0 warnings, 0 errors) plus tests (10 passed, 0 failed)
- 2026-03-29T09:27:00Z added FluentValidation.AspNetCore to Atlas.Core.API, registered automatic validation in Program.cs, and created validators for every request body plus the avatar upload form request
- 2026-03-29T09:27:00Z aligned request DTO data-annotation limits with the architecture/database schema (username/email/display name/bio/token/password bounds) so controller-level validation matches storage constraints
- 2026-03-29T09:27:00Z added xUnit coverage for canonical valid payloads plus invalid string, token, coordinate, and avatar-upload cases; reran build/test and passed build (0 warnings, 0 errors) plus tests (15 passed, 0 failed)
- 2026-03-29T09:40:00Z added a WebApplicationFactory-based API test host with in-memory CoreDbContext overrides plus startup configuration injection so JWT protection is verified against the real ASP.NET Core pipeline
- 2026-03-29T09:40:00Z added authorization integration tests covering all protected REST routes, all three SignalR hub negotiate endpoints, public auth/health routes, and invalid bearer-token handling to confirm JWT enforcement and anonymous exceptions
- 2026-03-29T09:40:00Z reran Atlas.Core build/test after the JWT audit and passed build (0 warnings, 0 errors) plus tests (49 passed, 0 failed)
- 2026-03-29T09:57:00Z replaced the permissive CORS policy with an explicit frontend-origin policy: only CORE_FRONTEND_ORIGIN is allowed outside Development, while Development additionally permits http://localhost:5173, with credentials plus GET/POST/PUT/DELETE/OPTIONS and Authorization/Content-Type restrictions
- 2026-03-29T09:57:00Z added preflight integration tests for configured production-style origin acceptance, unexpected-origin rejection, and localhost acceptance in Development using dedicated WebApplicationFactory hosts
- 2026-03-29T09:57:00Z reran Atlas.Core build/test after the CORS hardening and passed build (0 warnings, 0 errors) plus tests (52 passed, 0 failed)
- 2026-03-29T10:05:00Z added SecurityHeadersMiddleware to stamp Content-Security-Policy and X-XSS-Protection on every response via OnStarting, ensuring the headers survive normal API responses, auth challenges, hub negotiate challenges, rate limiting, and exception handling
- 2026-03-29T10:05:00Z centralized the CSP and X-XSS-Protection values in shared core constants and added integration tests for public API responses, unauthorized protected API responses, and unauthorized SignalR negotiate responses
- 2026-03-29T10:05:00Z reran Atlas.Core build/test after the XSS header hardening and passed build (0 warnings, 0 errors) plus tests (55 passed, 0 failed)
- 2026-03-29T10:26:00Z expanded Atlas.Core test coverage across controllers, AuthService, PasswordHasherService, S3Service, Kafka skip-path behavior, SignalR hubs, entities, exceptions, and shared API/domain contracts using isolated in-memory contexts plus reusable authenticated-controller helpers
- 2026-03-29T10:26:00Z measured line coverage with `dotnet test --collect:"XPlat Code Coverage"` and raised Atlas.Core from 41.90% to 95.37% overall line coverage (branch coverage 77.38%), with controllers at 96.34%, services at 95.06%, and hubs/entities/exceptions/models at 100%
- 2026-03-29T10:26:00Z reran Atlas.Core build/test after the coverage push and passed build (0 warnings, 0 errors), tests (113 passed, 0 failed), and XPlat coverage collection successfully
- 2026-03-29T11:04:00Z added full WebApplicationFactory-based REST integration coverage for all 31 Atlas.Core API endpoints: auth, users, friends, notifications, live, and health, with both happy-path and failure-path assertions through the real ASP.NET Core middleware/auth/validation pipeline
- 2026-03-29T11:04:00Z extended the shared API test factory with authenticated JWT clients, DB seeding helpers, stable per-factory in-memory database names, media-root configuration, and a Kafka-configured variant so endpoint tests exercise realistic startup configuration without external infrastructure
- 2026-03-29T11:04:00Z reran Atlas.Core build/test after the integration suite expansion and passed build (0 warnings, 0 errors) plus tests (131 passed, 0 failed)
- 2026-03-29T11:15:00Z closed the SignalR testing gap by adding authenticated negotiate integration coverage for TripHub, LocationHub, and NotificationHub so all three hub endpoints now prove real JWT-protected connection negotiation through the live ASP.NET Core pipeline
- 2026-03-29T11:15:00Z expanded hub unit coverage for the remaining subject-claim fallback branches in LocationHub and NotificationHub, and serialized password-reset-ticket tests to eliminate static-state flakiness uncovered while rerunning the full suite in parallel
- 2026-03-29T11:15:00Z reran Atlas.Core build/test after the hub test expansion and passed build (0 warnings, 0 errors) plus tests (136 passed, 0 failed)
- 2026-03-29T12:34:00Z centralized API error-envelope writing, hardened ExceptionHandlingMiddleware for malformed HTTP/JSON payloads plus already-started responses, and added API status-code fallback handling so bare 401/404 framework responses now return the Atlas standard error JSON shape
- 2026-03-29T12:34:00Z strengthened the shared HTTP integration helper to assert message/details/traceId on every error response and added targeted middleware + HTTP tests for unauthorized REST/hub negotiate requests, missing routes, malformed JSON, and internal exception handling branches
- 2026-03-29T12:34:00Z reran Atlas.Core build/test after the error-handling hardening and passed build (0 warnings, 0 errors) plus tests (145 passed, 0 failed)
- 2026-03-29T12:49:00Z expanded live HTTP edge-case coverage for blank auth payloads, invalid/empty refresh-reset flows, forbidden cross-user deletes, duplicate live-session starts, and invalid live-session payloads so the checklist categories (empty inputs, unauthorized/forbidden, not found, duplicates) are all exercised through the ASP.NET Core pipeline
- 2026-03-29T12:49:00Z confirmed a subtle API-boundary behavior: the non-nullable `q` query param on `/api/core/users/search` returns `400 VALIDATION_ERROR` for blank query-string input even though the controller method itself handles whitespace when invoked directly, so the edge-case integration suite now asserts the real HTTP contract
- 2026-03-29T12:49:00Z reran Atlas.Core build/test after the edge-case expansion and passed build (0 warnings, 0 errors) plus tests (154 passed, 0 failed)
- 2026-03-29T13:04:00Z refactored Serilog startup into a shared core logging configuration that keeps compact JSON console output while adding service-name enrichment plus `Enrich.FromLogContext()` for request-scoped structured properties
- 2026-03-29T13:04:00Z upgraded RequestLoggingMiddleware to preserve or generate `X-Correlation-Id`, align `HttpContext.TraceIdentifier` with that correlation ID, and enrich request logs with structured `CorrelationId` and `TraceId` properties so API headers, error envelopes, and logs share the same request identifier
- 2026-03-29T13:04:00Z added unit tests that capture real Serilog events plus HTTP integration tests for correlation-id header propagation/generation on success, unauthorized REST, and unauthorized hub negotiate responses; reran build/test and passed build (0 warnings, 0 errors) plus tests (159 passed, 0 failed)
- 2026-03-29T13:31:00Z replaced the placeholder Kafka-configured health check with a real broker probe via IKafkaHealthCheckService + Confluent AdminClient metadata lookup, while keeping the existing DB connectivity check and short per-dependency health timeouts
- 2026-03-29T13:31:00Z updated the health endpoint/controller and WebApplicationFactory hooks so health integration tests can deterministically verify both healthy and degraded outcomes without requiring a live Kafka broker in the test environment
- 2026-03-29T13:31:00Z reran Atlas.Core build/test after the health endpoint hardening and passed build (0 warnings, 0 errors) plus tests (159 passed, 0 failed)
- 2026-03-29T13:50:00Z added ResponseCachingMiddleware with SHA-256 ETag generation for successful JSON GET responses on the core API, excluding health and SignalR endpoints, and returning `304 Not Modified` when `If-None-Match` matches the current representation
- 2026-03-29T13:50:00Z configured safe private caching semantics for protected read endpoints (`Cache-Control: private, no-cache` and `Vary: Authorization`) so authenticated GET responses can use conditional revalidation without leaking across users or intermediaries
- 2026-03-29T13:50:00Z added middleware-level and HTTP integration coverage for ETag emission, conditional 304 responses, ETag invalidation after unread-count changes, and health-endpoint exclusion; reran build/test and passed build (0 warnings, 0 errors) plus tests (164 passed, 0 failed)
- 2026-03-29T14:01:00Z upgraded RequestLoggingMiddleware from a single completion log to true request/response logging: one safe request-start event and one response-complete event with structured method/path/status/duration plus content-type/content-length metadata, while preserving the existing correlation-id and trace-id enrichment
- 2026-03-29T14:01:00Z expanded log-capture tests to assert both emitted Serilog events and their required structured properties (service, correlation, trace, method, path, status, duration, request metadata, and response metadata) so the architecture logging contract is enforced at test time
- 2026-03-29T14:01:00Z reran Atlas.Core build/test after the request/response logging hardening and passed build (0 warnings, 0 errors) plus tests (164 passed, 0 failed)
- 2026-03-29T14:24:00Z completed a full Atlas.Core EF query audit and confirmed the remaining tracked-by-default query sites are all intentional write paths; the read-only controller/service query surface already uses `AsNoTracking()` where materialization could otherwise attach entities to the change tracker
- 2026-03-29T14:24:00Z added regression coverage that seeds data in one `CoreDbContext`, executes representative read-only controllers/services in fresh contexts, and asserts `ChangeTracker` stays empty, plus a source-audit test that locks the known read-only query roots to `AsNoTracking()` in production code
- 2026-03-29T14:24:00Z reran Atlas.Core build/test after the no-tracking audit and passed build (0 warnings, 0 errors) plus tests (167 passed, 0 failed)
- 2026-03-29T14:45:00Z configured production connection pooling in Atlas.Core by switching the service registration to `AddDbContextPool<CoreDbContext>(...)` and normalizing the SQL Server connection string with explicit pooling defaults for min/max pool size and connect timeout while preserving any user-specified connection-string overrides
- 2026-03-29T14:45:00Z added connection-pooling configuration tests that validate default option parsing, invalid pool-range rejection, default pooling parameter injection, and preservation of explicit connection-string pool settings, plus reran the full Atlas.Core validation cycle
- 2026-03-29T14:45:00Z reran Atlas.Core build/test after the connection-pooling configuration and passed build (0 warnings, 0 errors) plus tests (171 passed, 0 failed)

## Environment Notes
- .NET SDK: 8.0.419 at C:\Program Files\dotnet\dotnet.exe — USE IT
- Python: 3.14.3 at C:\Users\dongu\AppData\Local\Python\bin\python.exe — available
- Node.js: 24.14.0 at C:\Program Files\nodejs\ — available
- pip: 25.3 — available
- npm: 11.9.0 — available
- ALL RUNTIMES ARE INSTALLED. Do NOT report "no runtime" as a blocker.

### Phase 5: Recheck & Audit
- [x] Re-read agents.md and verify every endpoint matches atlas_architecture.tex
- [x] Run dotnet build and fix any issues
- [x] Run dotnet test and fix any failures
- [x] Check for broken imports, TODO comments, hardcoded values

### Phase 6: Security Hardening
- [x] Verify rate limiting middleware is applied to ALL endpoints
- [x] Add input validation (FluentValidation) on ALL request bodies
- [x] Verify JWT auth is enforced on all protected endpoints
- [x] Add CORS configuration (only allow frontend origin)
- [x] Add XSS protection headers (Content-Security-Policy, X-XSS-Protection)

### Phase 7: Test Coverage
- [x] Add unit tests until coverage exceeds 80%
- [x] Write integration tests for every API endpoint (happy path + error cases)
- [x] Add tests for all SignalR hubs
- [x] Add proper error handling with try/catch and standard error responses
- [x] Handle edge cases: empty inputs, unauthorized access, not found, duplicates

### Phase 9: Performance & Observability
- [x] Add Serilog with JSON output and correlation ID enrichment
- [x] Implement GET /api/core/health endpoint (checks DB + Kafka)
- [x] Add response caching middleware for read endpoints (ETag support)
- [x] Add request/response logging middleware with duration tracking
- [x] Add .AsNoTracking() to all read-only EF Core queries
- [x] Configure connection pooling
- [ ] Implement gzip/brotli response compression

### Phase 12: Final Boss Recheck
- [ ] Re-verify every endpoint matches atlas_architecture.tex spec
- [ ] Run full build and all tests — fix any failures
- [ ] Verify API response formats match Appendix B exactly
- [ ] Check for hardcoded secrets, debug statements, TODO comments, dead code
- [ ] Verify Kafka event schemas match Section 10
- [ ] Verify SignalR hubs accept connections
