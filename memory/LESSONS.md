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
- [2026-03-28] ✅ mssql-django works with Django 5.x on Python 3.14

## Build & Test Results

- [2026-03-28] ✅ `dotnet build` + `dotnet test` pass on Atlas.Core (commit 59b78dc)
- [2026-03-28] ✅ Django `manage.py check` passes for Content Engine (commit 26e53ad)
- [2026-03-28] ⚠️ Always run `pip install -r requirements.txt` before pytest
- [2026-03-28] ⚠️ DRF request auth in Content Engine needs explicit `REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES']`; middleware alone will not authenticate API views/tests that rely on `request.user`
- [2026-03-28] ⚠️ Intel dependencies need refresh for Python 3.14 compatibility at integration time
- [2026-03-29] ⚠️ Atlas health endpoints follow the architecture's bare JSON contract (`status`, `version`, `uptime`) instead of the usual `data` envelope; lock that shape in with endpoint contract tests.
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
