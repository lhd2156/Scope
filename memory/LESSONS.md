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
- [2026-04-19] ⚠️ `winget` can report `Microsoft.VisualStudio.2022.BuildTools` as found while `C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC` and `VsDevCmd.bat` are still missing; for native Atlas work, verify the actual VC toolchain paths before assuming `cl.exe` is usable.
- [2026-04-19] ⚠️ On this workstation, `winget install Microsoft.VisualStudio.2022.BuildTools --force --override "--add Microsoft.VisualStudio.Workload.VCTools"` and `winget install Kitware.CMake` can block indefinitely on `Waiting for another install/uninstall to complete`; native CMake validation stays blocked until that global installer lock clears and `cmake.exe` actually appears.

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
- [2026-03-28] ⚠️ DRF request auth in Content Engine needs explicit `REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES']`; middleware alone will not authenticate API views/tests that rely on `request.user`
- [2026-03-28] ⚠️ Intel dependencies need refresh for Python 3.14 compatibility at integration time
- [2026-03-29] ⚠️ Atlas health endpoints follow the architecture's bare JSON contract (`status`, `version`, `uptime`) instead of the usual `data` envelope; lock that shape in with endpoint contract tests.
- [2026-03-29] ✅ Atlas Intel `python -m pytest tests` passes from inside `atlas_intel/` on Python 3.14.3 once the dependency pins are refreshed and installed.
- [2026-03-29] ⚠️ Atlas Intel auth should read `JWT_SECRET`/issuer/audience from `app.config`, not module-level fallback secrets; make `create_app()` fail fast when `FLASK_SECRET_KEY` or `CORE_JWT_SECRET` is missing and inject explicit test secrets in pytest fixtures.
- [2026-03-29] ✅ Atlas Intel route-level rate limiting is easiest to verify by marking the decorator wrapper (for coverage across `app.url_map`) and adding one `429` test that asserts the `Retry-After` header from a low-limit test app.
- [2026-03-29] ⚠️ When Marshmallow validates nested request bodies (like route-optimizer spot lists), flatten `ValidationError.messages` into dot/bracket paths such as `spots[0].longitude`; otherwise generic `", ".join(...)` formatting breaks or loses nested field context.
- [2026-03-29] ✅ For Flask decorator coverage checks, set a marker attribute on the auth wrapper (`_atlas_require_auth`) and let `functools.wraps` propagate it through outer decorators like rate limiting; then assert every protected `/api/intel/*` rule has the marker while `/api/intel/health` does not.
- [2026-03-29] ✅ Atlas Intel CORS can stay strict and testable by reading `FRONTEND_ORIGIN`/`CORE_FRONTEND_ORIGIN`, allowing `http://localhost:5173` only in development/test, and asserting both preflight and real unauthorized responses carry the credentialed CORS headers.
- [2026-03-29] ✅ For SQLAlchemy ORM-only guarantees in Atlas Intel, an AST-based safety test over `app/` catches future raw-SQL regressions (`execute`, `text`, cursors, `from_statement`, and literal `SELECT/INSERT/UPDATE/DELETE` strings) better than a one-time grep.
- [2026-03-29] ✅ If `coverage`/`pytest-cov` is unavailable in Atlas Intel, `python -m trace --count --missing --coverdir .tracecov --module pytest tests` plus a small app-only parser is enough to measure line coverage honestly without adding a new dependency; make sure previously unimported modules (Kafka/ML) have explicit tests so they are counted.
- [2026-03-29] ✅ The cleanest way to satisfy the Intel endpoint-integration milestone is one dedicated pytest module with a happy-path and an error-path assertion for every route; use route-specific errors where available (400/404/429) and fall back to the existing auth contract (`401 UNAUTHORIZED`) for query endpoints that do not yet normalize malformed params.
- [2026-03-29] ✅ In Atlas Intel, register `BadRequestKeyError`, `BadRequest`, and `ValueError` handlers ahead of the generic `HTTPException`/`Exception` handlers so missing query params, malformed JSON, and float/date parsing failures return `400 VALIDATION_ERROR` instead of leaking as generic `500` responses.
- [2026-03-29] ✅ Atlas Intel query endpoints are safer and easier to test when weather/geocode params use Marshmallow schemas too: validate lat/lng ranges and blank `q` values there, and let the shared error handler flatten the resulting `ValidationError` details into field-specific `400 VALIDATION_ERROR` responses.
- [2026-03-29] ✅ For shared Flask observability in Atlas Intel, configure one structured handler on the parent `app` logger, clear Flask’s default app logger handlers, and set `app.logger.propagate = True`; that lets both `app.logger` and module loggers like `app.kafka.*` emit the same JSON shape with correlation IDs via a request-context logging filter.
- [2026-03-29] ✅ Atlas Intel health can satisfy both the architecture contract and the readiness-check requirement by keeping the bare `{"status","version","uptime"}` response shape, performing DB + ML checks in a small health service, and expressing failures via `status: "unhealthy"` plus HTTP 503 instead of adding extra payload fields.
- [2026-03-29] ✅ For Atlas Intel itinerary caching, do the request-hash lookup *before* weather/model work in `POST /api/intel/itinerary/generate`, and treat expired `ItineraryCache` rows as misses that get deleted on read; normalize naive SQLite datetimes to UTC before comparing `ExpiresAt` against `utcnow()` or cache-expiry tests will fail under Python/SQLite.
- [2026-03-29] ✅ Atlas Intel ML timeouts are easiest to keep cross-platform by wrapping scikit-learn calls in a shared `ThreadPoolExecutor` helper keyed off `ML_REQUEST_TIMEOUT_SECONDS`; expose timeout failures as a dedicated Flask error (`503 ML_TIMEOUT`) and use tiny per-app timeout overrides plus short `sleep()` monkeypatches in tests instead of trying to hang the real models.
- [2026-03-29] ✅ For authenticated Atlas Intel weather/geocoding responses, use `Cache-Control: private, max-age=...` with `Vary: Authorization` rather than `public` caching; the payloads are reusable per user request, but shared intermediaries should not cache one bearer-authenticated response for another user.
- [2026-03-29] ✅ The safest way to keep Atlas Intel endpoint parity with `atlas_architecture.tex` is a dedicated route-map audit test that asserts the exact `/api/intel/*` rule set, verbs, and public-vs-protected split; this catches silent blueprint drift without waiting for higher-level integration failures.
- [2026-03-29] ⚠️ On this workstation, `python -m pip install -r atlas_intel/requirements.txt` can emit `Ignoring invalid distribution ~jango` warnings from the global Python 3.14 site-packages state, but Atlas Intel installs and `python -m pytest tests` still pass; treat it as an environment warning unless it starts breaking dependency resolution.
- [2026-04-19] ✅ Atlas native-geo can still be validated on this Windows host without admin installs by using user-space `cmake.exe` / `ctest.exe` from `C:\Users\dongu\AppData\Roaming\Python\Python314\Scripts\` plus the existing `C:\Users\dongu\llvm-mingw-20260407-ucrt-x86_64\bin` toolchain on `PATH`; the repo-root `atlas_geo/__init__.py` loader must search both `atlas_geo/build` and repo-root `build` and register Windows DLL search directories before importing `_atlas_geo`, or pytest can fail with `ModuleNotFoundError` / `DLL load failed` even after a successful native build.
- [2026-03-29] ✅ For exact Appendix B response parity in Atlas Intel, disable Flask JSON key sorting (`app.json.sort_keys = False`) so payload keys stay in documented order, and cast rounded itinerary cost values back to `float` because Python’s `round()` can collapse whole-dollar amounts like `190.00` to integer `190`.
- [2026-03-29] ✅ During Atlas Intel hygiene audits, naive unused-import scans will false-positive on `from __future__ import annotations` and export-only imports, but real cleanup still matters: remove genuinely unused imports like `asdict`, and import `JsonFormatter` from `pythonjsonlogger.json` (not `pythonjsonlogger.jsonlogger`) to avoid deprecation warnings in the Phase 12 suite.
- [2026-03-29] ✅ Treat Atlas Intel “model loading works” as a shared code path, not a one-off smoke test: put TF-IDF construction behind an `MlModelLoader`, have recommendation/vibe services depend on it, and point health readiness at the same loader so the app’s ML verification exercises the exact runtime path used in production.
- [2026-03-29] ✅ Atlas Intel itinerary caching should stay user-scoped end-to-end: cache lookup on generate already keys by `user_id + request_hash`, and `GET /api/intel/itinerary/{id}` should also filter by `user_id` so one user cannot resolve another user’s cached itinerary ID. Lock that in with tests proving same-payload requests from different users create distinct cache rows.
- [2026-03-28] ✅ Frontend `npm run build` and tests pass in atlas-frontend/
- [2026-03-29] ⚠️ Vue Test Utils v2 exposes `findAll()` on wrappers for multi-match queries; `getAll()` is not available in this frontend test setup.
- [2026-03-29] ⚠️ Vitest hoists `vi.mock()` factories; when shared fixture data is needed inside the factory, define it with `vi.hoisted()` or inline it in the mock.
- [2026-03-29] ⚠️ Playwright browser binaries are not guaranteed to be preinstalled on this workstation; run `npx playwright install chromium` in `atlas-frontend/` before doing screenshot-based UI verification.
- [2026-03-29] ⚠️ Once a Vue view reads `useRoute()`/`useRouter()`, Vitest mounts need a real memory router plugin; stubbing `RouterLink` alone is not enough for route-query watchers or `router.replace()` flows.
- [2026-03-29] ⚠️ Frontend `npm.cmd run build` can pass while Vite still warns that the eagerly bundled `mapbox-gl` chunk exceeds 500 kB; treat that as a Phase 9 lazy-loading/tree-shaking follow-up, not a Phase 5.2 build failure.
- [2026-03-29] ⚠️ Vitest in this repo already runs in single-fork mode via the `npm.cmd run test` script; Jest-style `--runInBand` is not a supported CLI flag here.
- [2026-03-29] ⚠️ Frontend `npm.cmd run lint` currently fails because ESLint 9 expects an `eslint.config.*` flat-config file, but this repo still only has the scaffolded lint script; use build/test plus targeted code searches unless the lint setup is explicitly migrated.
- [2026-03-29] ⚠️ In Vitest, do not replace the global `URL` constructor with a plain object just to stub `createObjectURL`; override `URL.createObjectURL` instead, or axios imports can crash with `URL is not a constructor`.

## Git & Workflow

- [2026-03-28] ⚠️ Always commit after EACH task, never batch multiple tasks
- [2026-03-28] ⚠️ Use conventional commits: `feat(scope): description`
- [2026-03-28] ⚠️ Work on feature branches (feature/foundation, feature/core-platform, etc.), not main
- [2026-03-28] ⚠️ Use `git add . ; git commit -m "message"` (semicolons, not &&)
- [2026-03-28] ⚠️ If `atlas-frontend/` already has unrelated unstaged files from another milestone, stage only task-specific files so parallel frontend work does not get batched into the wrong commit.

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
