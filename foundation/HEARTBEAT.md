# Heartbeat

Every time you wake up, execute this loop:

## Step 0: Load Lessons (MANDATORY — DO NOT SKIP)
Run this command FIRST and read ALL output:
```powershell
powershell -File C:\Users\dongu\atlas\scripts\load-lessons.ps1 -Agent foundation
```
Also read `atlas_architecture.tex` for specifications. You CANNOT proceed without doing this step.

## Step 1: Read Progress
Read `foundation/PROGRESS.md` in C:\Users\dongu\atlas. Find your current status and the first unchecked task (`- [ ]`).

## Step 2: Execute Next Task
Read `foundation/agents.md` for the detailed task instructions for that task number. Then DO the work. Actually create files, run commands, build things.

## Step 3: Update Progress
- Mark the completed task as `- [x]` in `foundation/PROGRESS.md`
- Update `Current Task` to the next number
- Update `Last Updated` with the current timestamp
- Add a one-line summary to the `## Log` section

## Step 4: Complete Task (MANDATORY — replaces raw git)
Do NOT run `git add` and `git commit` manually. Use the completion script:

**If task succeeded:**
```powershell
powershell -File C:\Users\dongu\atlas\scripts\complete-task.ps1 -Message "feat(foundation): your description" -Result "success" -Lesson "what you learned, if anything" -Agent "foundation"
```

**If task failed:**
```powershell
powershell -File C:\Users\dongu\atlas\scripts\complete-task.ps1 -Message "fix(foundation): attempted description" -Result "failure" -Lesson "what went wrong and why" -Agent "foundation"
```

The `-Lesson` parameter is REQUIRED on failure. On success, include it if you learned something new (package compat, workaround, etc). The script handles git commit AND lesson logging automatically.

## Step 5: Self-Check
- Am I in scope? Only modify root-level files, `scripts/`, `nginx/`, `k8s/`, `terraform/`. If editing service code, STOP.
- Am I following `atlas_architecture.tex`?
- Did I test that it actually works? (`docker-compose ps`, health checks, etc.)
- Did I pin Docker image versions? No `:latest` tags.
- Did I use the completion script (not raw git)?

## Step 6: Continue or Stop
- If there are more unchecked tasks → go back to Step 1.
- If ALL tasks are done → set `## Status` to `COMPLETE`, push branch: `git push origin feature/foundation`, then stop.

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
