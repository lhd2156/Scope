# Heartbeat

Every time you wake up, execute this loop:

## Step 0: Load Lessons (MANDATORY — DO NOT SKIP)
Run this command FIRST and read ALL output:
```powershell
powershell -File C:\Users\dongu\atlas\scripts\load-lessons.ps1 -Agent frontend
```
Also read `atlas_architecture.tex` and `atlas-assets/design-tokens.css` for specifications. You CANNOT proceed without doing this step.

## Step 1: Read Progress
Read `frontend/PROGRESS.md` in C:\Users\dongu\atlas. Find your current status and the first unchecked task (`- [ ]`).

## Step 2: Check Prerequisites
Core, Content, and Intel must ALL be `COMPLETE` before you start. Check their PROGRESS.md files. If any are not COMPLETE, reply `HEARTBEAT_OK — waiting for backends` and stop.

## Step 3: Execute Next Task
Read `frontend/agents.md` for the detailed task instructions for that task number. Also read `atlas-assets/design-tokens.css` for the design system. Then DO the work. Actually create files, run commands, build things inside `atlas-frontend/`.

## Step 4: Update Progress
- Mark the completed task as `- [x]` in `frontend/PROGRESS.md`
- Update `Current Task` to the next number
- Update `Last Updated` with the current timestamp
- Add a one-line summary to the `## Log` section

## Step 5: Complete Task (MANDATORY — replaces raw git)
Do NOT run `git add` and `git commit` manually. Use the completion script:

**If task succeeded:**
```powershell
powershell -File C:\Users\dongu\atlas\scripts\complete-task.ps1 -Message "feat(frontend): your description" -Result "success" -Lesson "what you learned, if anything" -Agent "frontend"
```

**If task failed:**
```powershell
powershell -File C:\Users\dongu\atlas\scripts\complete-task.ps1 -Message "fix(frontend): attempted description" -Result "failure" -Lesson "what went wrong and why" -Agent "frontend"
```

The `-Lesson` parameter is REQUIRED on failure. On success, include it if you learned something new. The script handles git commit AND lesson logging automatically.

## Step 6: Self-Check
- Am I in scope? Only modify files inside `atlas-frontend/`. If editing anything else, STOP.
- Am I following `atlas_architecture.tex`?
- Did I run tests? (`npm run test`)
- Does it build? (`npm run build`)
- Is the UI premium? Dark mode by default, micro-animations, glassmorphism?
- Did I use the completion script (not raw git)?

## Step 7: Continue or Stop
- If there are more unchecked tasks → go back to Step 1.
- If ALL tasks are done → set `## Status` to `COMPLETE`, push branch: `git push origin feature/frontend`, then stop.

## If Blocked
If a task fails or you cannot proceed:
- Update `## Status` to `BLOCKED`
- Add the error details to `## Log`
- Run the completion script with `-Result "failure"` to log the lesson
- Reply with the blocker details so the orchestrator can see it

## CRITICAL RULES
1. You must actually DO the work. Read files, create files, run commands. Do NOT just report status.
2. You MUST run `load-lessons.ps1` at the start of every heartbeat. No exceptions.
3. You MUST use `complete-task.ps1` instead of raw `git add/commit`. No exceptions.
4. On failure, the `-Lesson` parameter is MANDATORY.
