# Agent Lessons Learned

> **This file is read by ALL agents on every boot. It is the shared institutional memory.**
> After any failure, unexpected success, or important discovery, append a new entry below in the appropriate section.
> Format: `- [YYYY-MM-DD] ❌/✅/⚠️/💡 <description>`

---

## Environment & Runtime

- [2026-03-28] ⚠️ PowerShell on Windows — use `;` not `&&` for chaining commands
- [2026-03-28] ✅ Python 3.14.3 is at `C:\Users\dongu\AppData\Local\Python\bin\python.exe`
- [2026-03-28] ✅ .NET SDK 8.0.419 is at `C:\Program Files\dotnet\dotnet.exe`
- [2026-03-28] ✅ Node.js 24.14.0 is at `C:\Program Files\nodejs\node.exe`
- [2026-03-28] ⚠️ Never report "no runtime" — all runtimes are installed. See paths above.

## Package Compatibility

- [2026-03-28] ❌ scikit-learn==1.5.2 FAILS on Python 3.14 → use >=1.6 or latest
- [2026-03-28] ❌ Pinned old pyodbc versions may fail on Python 3.14 → use latest
- [2026-03-28] ⚠️ Always check Python package compatibility with 3.14 before pinning versions
- [2026-03-29] ✅ `scikit-learn==1.8.0` is published for Python 3.14.3 on this workstation, so Atlas Intel can safely move off the incompatible `1.5.2` pin.
- [2026-03-29] ✅ `numpy==2.4.3` and `confluent-kafka==2.13.2` install cleanly on this Windows/Python 3.14.3 workstation; older pins (`numpy==2.1.2`, `confluent-kafka==2.6.0`) fall back to source builds and fail without local compiler toolchains.
- [2026-03-28] ✅ mssql-django works with Django 5.x on Python 3.14

## Build & Test Results

- [2026-03-28] ✅ `dotnet build` + `dotnet test` pass on Atlas.Core (commit 59b78dc)
- [2026-03-28] ✅ Django `manage.py check` passes for Content Engine (commit 26e53ad)
- [2026-03-28] ⚠️ Always run `pip install -r requirements.txt` before pytest
- [2026-03-29] ⚠️ The local Python environment can drift from Atlas pins (`pytest`, `PyJWT`); rerun `pip install -r atlas_content/requirements.txt` before Django validation so checks/tests use the expected versions.
- [2026-03-28] ⚠️ DRF request auth in Content Engine needs explicit `REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES']`; middleware alone will not authenticate API views/tests that rely on `request.user`
- [2026-03-28] ⚠️ Intel dependencies need refresh for Python 3.14 compatibility at integration time
- [2026-03-29] ⚠️ Atlas health endpoints follow the architecture's bare JSON contract (`status`, `version`, `uptime`) instead of the usual `data` envelope; lock that shape in with endpoint contract tests.
- [2026-03-29] ⚠️ Content Engine settings should load `atlas_content/.env` and fail fast on missing `DJANGO_SECRET_KEY` / `CORE_JWT_SECRET`; keep pytest on `atlas_content.test_settings` so tests seed explicit non-production secrets instead of relying on runtime fallbacks.
- [2026-03-29] ⚠️ In Django middleware, return `JsonResponse` (or render the DRF response yourself) for early 429 throttles; handing `CommonMiddleware` an unrendered DRF `Response` triggers `ContentNotRenderedError` when it sets `Content-Length`.
- [2026-03-29] ⚠️ For DRF `DecimalField` inputs in Atlas Content, declare serializer fields with `Decimal('...')` min/max bounds explicitly; relying on float-backed model validators keeps validation working but emits noisy `min_value/max_value should be a Decimal instance` warnings in pytest.
- [2026-03-29] ⚠️ In Atlas Content, malformed bearer tokens raise DRF `AuthenticationFailed`; handle that explicitly in the custom exception handler or protected routes will leak as `500` instead of the expected `401 UNAUTHORIZED`.
- [2026-03-29] ✅ Atlas Intel `python -m pytest tests` passes from inside `atlas_intel/` on Python 3.14.3 once the dependency pins are refreshed and installed.
- [2026-03-29] ⚠️ Atlas Intel auth should read `JWT_SECRET`/issuer/audience from `app.config`, not module-level fallback secrets; make `create_app()` fail fast when `FLASK_SECRET_KEY` or `CORE_JWT_SECRET` is missing and inject explicit test secrets in pytest fixtures.
- [2026-03-29] ✅ Atlas Intel route-level rate limiting is easiest to verify by marking the decorator wrapper (for coverage across `app.url_map`) and adding one `429` test that asserts the `Retry-After` header from a low-limit test app.
- [2026-03-29] ⚠️ When Marshmallow validates nested request bodies (like route-optimizer spot lists), flatten `ValidationError.messages` into dot/bracket paths such as `spots[0].longitude`; otherwise generic `", ".join(...)` formatting breaks or loses nested field context.
- [2026-03-29] ✅ For Flask decorator coverage checks, set a marker attribute on the auth wrapper (`_atlas_require_auth`) and let `functools.wraps` propagate it through outer decorators like rate limiting; then assert every protected `/api/intel/*` rule has the marker while `/api/intel/health` does not.
- [2026-03-29] ✅ Atlas Intel CORS can stay strict and testable by reading `FRONTEND_ORIGIN`/`CORE_FRONTEND_ORIGIN`, allowing `http://localhost:5173` only in development/test, and asserting both preflight and real unauthorized responses carry the credentialed CORS headers.
- [2026-03-28] ✅ Frontend `npm run build` and tests pass in atlas-frontend/
- [2026-03-29] ⚠️ Vue Test Utils v2 exposes `findAll()` on wrappers for multi-match queries; `getAll()` is not available in this frontend test setup.
- [2026-03-29] ⚠️ Vitest hoists `vi.mock()` factories; when shared fixture data is needed inside the factory, define it with `vi.hoisted()` or inline it in the mock.
- [2026-03-29] ⚠️ Playwright browser binaries are not guaranteed to be preinstalled on this workstation; run `npx playwright install chromium` in `atlas-frontend/` before doing screenshot-based UI verification.
- [2026-03-29] ⚠️ Once a Vue view reads `useRoute()`/`useRouter()`, Vitest mounts need a real memory router plugin; stubbing `RouterLink` alone is not enough for route-query watchers or `router.replace()` flows.
- [2026-03-29] ⚠️ Frontend `npm.cmd run build` can pass while Vite still warns that the eagerly bundled `mapbox-gl` chunk exceeds 500 kB; treat that as a Phase 9 lazy-loading/tree-shaking follow-up, not a Phase 5.2 build failure.
- [2026-03-29] ⚠️ Vitest in this repo already runs in single-fork mode via the `npm.cmd run test` script; Jest-style `--runInBand` is not a supported CLI flag here.
- [2026-03-29] ⚠️ Frontend `npm.cmd run lint` currently fails because ESLint 9 expects an `eslint.config.*` flat-config file, but this repo still only has the scaffolded lint script; use build/test plus targeted code searches unless the lint setup is explicitly migrated.
- [2026-03-29] ⚠️ In Vitest, do not replace the global `URL` constructor with a plain object just to stub `createObjectURL`; override `URL.createObjectURL` instead, or axios imports can crash with `URL is not a constructor`.
- [2026-03-29] ⚠️ Frontend silent session hydration must disable mock auth fallbacks; otherwise a stale local session hint can make a fresh tab appear authenticated without a real refresh cookie.
- [2026-03-29] ⚠️ For frontend auth-guard verification, unit-test `resolveNavigationGuard()` with a mocked auth store and separately assert `router.getRoutes()` meta contracts; that is more stable than mounting full pages when only redirect/auth behavior matters.
- [2026-03-29] ⚠️ In this frontend dependency set, `useDebounceFn()` should not be assumed to expose a usable `.cancel()` method at runtime; for critical input flows like `SearchBar`, prefer explicit timeout cleanup or verify the helper API before calling `cancel()`.
- [2026-03-29] ⚠️ When page tests depend on store error banners, plain-object mocked stores are not reactive enough for “set error after mount” assertions; seed the error state before mount or wrap the mock in a reactive store-shaped object.
- [2026-03-29] ⚠️ Keep auth-service mock fallback opt-in only (`VITE_ENABLE_AUTH_MOCK_FALLBACK=true`); silent login/register fallback hides real network-failure and expired-session bugs during frontend hardening.
- [2026-03-29] ⚠️ For Vue Router lazy-load verification, `router.getRoutes()` exposes the wrapped route view as `route.components.default`; `defineAsyncComponent` wrappers can be asserted there via the internal `__asyncLoader` property without mounting every page.
- [2026-03-29] ⚠️ JSDOM may expose an `IntersectionObserver` stub that keeps lazy-image components in placeholder mode during tests; explicitly override or remove `window.IntersectionObserver` in image specs when you need deterministic eager/deferred assertions.
- [2026-03-29] ⚠️ Enforce the 300ms debounce floor inside the shared `SearchBar` itself rather than relying on every caller to pass the right prop; that guarantees future search surfaces inherit the performance rule automatically.

- [2026-03-29] ⚠️ Atlas.Core should fail fast when `CORE_JWT_SECRET` is missing; do not keep fallback JWT secrets in `appsettings.json`, and lock the behavior with JwtTokenService coverage.

## Git & Workflow

- [2026-03-28] ⚠️ Always commit after EACH task, never batch multiple tasks
- [2026-03-28] ⚠️ Use conventional commits: `feat(scope): description`
- [2026-03-28] ⚠️ Work on feature branches (feature/foundation, feature/core-platform, etc.), not main
- [2026-03-28] ⚠️ Use `git add . ; git commit -m "message"` (semicolons, not &&)
- [2026-03-28] ⚠️ If `atlas-frontend/` already has unrelated unstaged files from another milestone, stage only task-specific files so parallel frontend work does not get batched into the wrong commit.
- [2026-03-29] ⚠️ If the main workspace is on another feature branch with unrelated edits, use a separate git worktree for the target branch instead of switching branches and disturbing in-flight work.

## File & Path Rules

- [2026-03-28] ❌ Do NOT look in `.worktrees/` or `atlas-intel-wt/` for progress files
- [2026-03-28] ⚠️ Canonical progress files are at `C:\Users\dongu\atlas\{agent}\PROGRESS.md`
- [2026-03-28] ⚠️ Always re-read files before editing — never rely on cached/stale content
- [2026-03-28] ⚠️ The `.tex` file (`atlas_architecture.tex`) is the source of truth for all specs

## Orchestration

- [2026-03-28] ⚠️ When heartbeat respawns agents via `openclaw agent`, pass a fresh explicit `--session-id` per run to avoid `.jsonl.lock` session-collision failures on repeated background launches.
- [2026-03-28] ⚠️ Every heartbeat spawn prompt must tell agents to read `C:\Users\dongu\atlas\memory\LESSONS.md` before touching their own task files.
- [2026-03-28] ⚠️ On the heartbeat channel, thread-bound subagent sessions may be unavailable; use one-shot `sessions_spawn` runs instead of `thread=true` session mode.
- [2026-03-28] ⚠️ If `sessions_spawn` hits the max active child limit, list active subagents and kill stale duplicate runs before launching more work.
- [2026-03-28] ⚠️ Before re-spawning a long-running agent task, check whether the same agent already has an active child on that task; keep the in-flight worker and kill any new duplicate.
- [2026-03-29] ⚠️ After steering a suspected stuck subagent, inspect its recent session history before replacing it; long-running workers may resume productive file edits after a steer.
- [2026-03-29] ⚠️ After steering a suspected stuck subagent, inspect its recent session history before replacing it — long runtime alone can hide resumed productive file writes.
- [2026-03-29] ⚠️ If canonical progress advances to the next task while the same agent is still finishing validation/commit work, steer that in-flight worker into the new first unchecked task instead of spawning an overlapping duplicate on the shared workspace.
- [2026-03-29] ⚠️ When an agent finishes the last Phase 3 task and self-advances into Phase 5.x in its own PROGRESS.md, update lead progress to reflect the phase-sequencing drift and explicitly reconcile Phase 4/Phase 5 work rather than treating it as ordinary leftover frontend scope.
- [2026-03-29] ⚠️ If the same agent keeps self-advancing from Phase 5.x into Phase 6.x while Phase 4 integration and other services' Phase 5 audits are still pending, flag the compounded sequencing drift explicitly in lead progress and Telegram status instead of masking it as routine frontend progress.
- [2026-03-29] ⚠️ Some agent PROGRESS files can still say `Status: COMPLETE` while later-phase checklists remain unchecked; when that happens, treat the first unchecked phase task as canonical remaining work and respawn the agent instead of trusting the stale top-line status.
- [2026-03-29] ⚠️ If a subagent reports success from an isolated branch/worktree but the canonical `C:\Users\dongu\atlas\{agent}\PROGRESS.md` file in the main workspace is still stale, trust the canonical file and relaunch/repair from that state instead of trusting the completion message alone.

- [2026-03-29] ⚠️ `openclaw agent` launches can survive a local gateway closure by falling back to embedded execution; if spawned workers stay running after a `ws://127.0.0.1:18789` close, treat it as a control-plane issue to flag rather than assuming the worker died immediately.

- [2026-03-29] ⚠️ In Atlas.Core, middleware registered before `MapControllers()`/`MapHub()` also governs SignalR negotiate routes; when auditing cross-cutting policies like rate limiting, add hub-path tests instead of checking controllers only.
- [2026-03-29] ⚠️ On Windows heartbeats, when OpenClaw child-session metadata is unavailable, inspect `Win32_Process` for `openclaw.mjs agent` plus `--agent` / `--session-id` to confirm which workers are still alive before spawning replacements.
- [2026-03-29] ⚠️ Lead progress can say an agent is "running" even after that worker process exits; verify the actual `openclaw.mjs agent --session-id ...` process is still alive before you skip a needed respawn.
- [2026-03-29] ⚠️ A background `openclaw agent` exec can linger as a live `node.exe` even after `process log` shows a completed payload with `"stopReason": "stop"`; treat that as a stale worker, kill it, and relaunch with a fresh session ID instead of assuming it is still making progress.
- [2026-03-29] ⚠️ If a lone surviving worker has been alive for a long time but its latest payload only reports the *previous* checklist item while the canonical `PROGRESS.md` has not advanced further, treat it as stuck-after-handoff and respawn it instead of preserving it indefinitely.
- [2026-03-29] ⚠️ If Frontend self-advances into Phase 9 while Phase 4 integration is still pending and the backends are still in Phases 6-7, flag the widened sequencing drift explicitly in lead progress/Telegram and keep respawning lagging services from their first unchecked canonical task instead of following Frontend deeper.
- [2026-03-29] ⚠️ If the live process table shows a newer worker session than the lead dashboard mentions, trust the canonical service `PROGRESS.md` files plus `Win32_Process`, refresh the dashboard, and preserve the live worker when it matches the current first unchecked task instead of blindly respawning it.
- [2026-03-29] ⚠️ When the `Win32_Process` heartbeat check returns only the temporary PowerShell inspection command and no `openclaw.mjs agent` node processes, treat that as zero live workers and relaunch every non-COMPLETE service from its canonical current task.

- [2026-03-29] ✅ Atlas.Core request-body validation works cleanly on .NET 8 with `FluentValidation.AspNetCore`, `AddFluentValidationAutoValidation()`, and `AddValidatorsFromAssemblyContaining<...>()`; keep the shared `InvalidModelStateResponseFactory` so FluentValidation failures still return the standard Atlas error envelope.

- [2026-03-29] ⚠️ In Atlas.Core minimal-hosting integration tests, config values checked directly in `Program.cs` (like `CORE_JWT_SECRET`) must be present before `WebApplicationFactory` boots the app; process env vars are a reliable way to seed those early startup checks.

- [2026-03-29] ✅ Atlas.Core CORS can stay strict and testable by reading `CORE_FRONTEND_ORIGIN` at startup, adding `http://localhost:5173` only in Development, and verifying preflight behavior with `OPTIONS` integration tests instead of controller-only assertions.

- [2026-03-29] ✅ In Atlas.Core, register security-header middleware with `Response.OnStarting(...)` before auth/rate-limit/exception middleware so CSP and X-XSS-Protection still appear on 401, 429, exception, and SignalR negotiate responses.

- [2026-03-29] ✅ Atlas.Core coverage can be measured directly with `dotnet test --collect:"XPlat Code Coverage"`; a focused mix of controller, service, hub, and domain-contract tests can drive the Cobertura line rate above 80% quickly without needing extra coverage packages.

## Common Mistakes to Avoid

- [2026-03-28] ❌ Do NOT just read files and report status — actually DO the work
- [2026-03-28] ❌ Do NOT merge microservices — each service is independent
- [2026-03-28] ❌ Do NOT hardcode secrets — use `.env`
- [2026-03-28] ❌ Do NOT use `&&` in PowerShell — use `;`
- [2026-03-28] ❌ Do NOT skip security — rate limiting, validation, JWT on every endpoint

---

> **To add a new lesson:** Append to the appropriate section above. If no section fits, create a new one.
> Keep entries concise — one line per lesson with the date and emoji prefix.
- [2026-03-28] [SUCCESS] [orchestrator] complete-task.ps1 works on Windows PowerShell
