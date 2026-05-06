# Heartbeat

Every time you wake up, execute this loop:

## Step 0: Load Context (MANDATORY)
1. Run: `powershell -File C:\Users\dongu\scope\scripts\load-lessons.ps1 -Agent frontend`
2. Read `C:\Users\dongu\scope\memory\COMPLETED-TASKS.md` — check what's already done
3. Read `scope-assets/DESIGN-SPEC.md` and `scope-assets/design-tokens.css`
4. Study ALL mockup images in `scope-assets/mockups/` (00-08) — your pixel-perfect reference

## Step 1: Read Progress
Read `frontend/PROGRESS.md` in `C:\Users\dongu\scope`. Find first unchecked task (`- [ ]`).

## Step 2: Check Prerequisites
Core, Content, and Intel must ALL be `COMPLETE`. If not: `HEARTBEAT_OK — waiting for backends`.

## Step 3: Execute Next Task
Read `frontend/agents.md` for task instructions. DO the work — create files, run commands, build inside `scope-frontend/`.

**Phase 13 reminder**: Match the mockup images pixel-for-pixel. Use glassmorphism, design tokens, Unsplash photos.

## Step 4: Update Progress
- Mark task `- [x]` in `frontend/PROGRESS.md`
- Update `Current Task` + `Last Updated`
- Add one-line summary to `## Log`

## Step 5: Complete Task (MANDATORY)
Do NOT run raw `git add/commit`. Use:

**Success:**
```powershell
powershell -File C:\Users\dongu\scope\scripts\complete-task.ps1 -Message "feat(frontend): desc" -Result "success" -Lesson "what you learned" -Agent "frontend"
```

**Failure:**
```powershell
powershell -File C:\Users\dongu\scope\scripts\complete-task.ps1 -Message "fix(frontend): desc" -Result "failure" -Lesson "what went wrong" -Agent "frontend"
```

The script handles git commit, LESSONS.md, AND COMPLETED-TASKS.md logging automatically.

## Step 6: Self-Check
- Scope: only `scope-frontend/` (+ PROGRESS.md + LESSONS.md)
- Following `scope_architecture.tex`?
- Tests pass? (`npm run test`)
- Builds? (`npm run build`)
- Premium UI? Dark mode, animations, glassmorphism?
- Used completion script (not raw git)?
- Matches mockup images?

## Step 7: Continue or Stop
- More unchecked tasks → back to Step 1
- ALL done → `Status: COMPLETE`, push: `git push origin feature/frontend`

## If Blocked
- Status → `BLOCKED`, log error, run completion script with `-Result "failure"`, reply with details

## Critical Rules
1. Actually DO the work — create files, run commands
2. Run `load-lessons.ps1` every heartbeat
3. Use `complete-task.ps1` instead of raw git
4. Check `COMPLETED-TASKS.md` to avoid redoing finished work
5. On failure, `-Lesson` is MANDATORY
6. Always study mockup images before visual changes
