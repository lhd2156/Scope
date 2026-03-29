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

## Current Task: Add input validation (FluentValidation) on ALL request bodies
## Last Updated: 2026-03-29T09:22:00Z

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
- [ ] Add input validation (FluentValidation) on ALL request bodies
- [ ] Verify JWT auth is enforced on all protected endpoints
- [ ] Add CORS configuration (only allow frontend origin)
- [ ] Add XSS protection headers (Content-Security-Policy, X-XSS-Protection)

### Phase 7: Test Coverage
- [ ] Add unit tests until coverage exceeds 80%
- [ ] Write integration tests for every API endpoint (happy path + error cases)
- [ ] Add tests for all SignalR hubs
- [ ] Add proper error handling with try/catch and standard error responses
- [ ] Handle edge cases: empty inputs, unauthorized access, not found, duplicates

### Phase 9: Performance & Observability
- [ ] Add Serilog with JSON output and correlation ID enrichment
- [ ] Implement GET /api/core/health endpoint (checks DB + Kafka)
- [ ] Add response caching middleware for read endpoints (ETag support)
- [ ] Add request/response logging middleware with duration tracking
- [ ] Add .AsNoTracking() to all read-only EF Core queries
- [ ] Configure connection pooling
- [ ] Implement gzip/brotli response compression

### Phase 12: Final Boss Recheck
- [ ] Re-verify every endpoint matches atlas_architecture.tex spec
- [ ] Run full build and all tests — fix any failures
- [ ] Verify API response formats match Appendix B exactly
- [ ] Check for hardcoded secrets, debug statements, TODO comments, dead code
- [ ] Verify Kafka event schemas match Section 10
- [ ] Verify SignalR hubs accept connections
