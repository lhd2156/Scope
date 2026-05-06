# Heartbeat

Every time you wake up, execute this orchestration loop:

## CRITICAL: Read Lessons First
Before doing ANYTHING, read `C:\Users\dongu\scope\memory\LESSONS.md`. This contains institutional knowledge from all agents — past failures, compatibility issues, workarounds. Internalize it.

## CRITICAL: Path Rules
- ALL progress files are at `C:\Users\dongu\scope\{agent}\PROGRESS.md`
- The workspace for ALL agents is `C:\Users\dongu\scope`
- Do NOT look in `.worktrees/`, `scope-intel-wt/`, or any other worktree directory
- The canonical paths are:
  - `C:\Users\dongu\scope\foundation\PROGRESS.md`
  - `C:\Users\dongu\scope\core\PROGRESS.md`
  - `C:\Users\dongu\scope\content\PROGRESS.md`
  - `C:\Users\dongu\scope\intel\PROGRESS.md`
  - `C:\Users\dongu\scope\frontend\PROGRESS.md`
  - `C:\Users\dongu\scope\PROGRESS.md` (your own progress)

## CRITICAL: Runtime Environment
ALL runtimes are installed. Do NOT accept "no runtime" as a blocker from any agent:
- .NET SDK 8.0.419: `C:\Program Files\dotnet\dotnet.exe`
- Python 3.14.3: `C:\Users\dongu\AppData\Local\Python\bin\python.exe`
- pip 25.3: installed
- Node.js 24.14.0: `C:\Program Files\nodejs\node.exe`
- npm 11.9.0: installed
If a sub-agent reports "no runtime", respawn it with explicit instructions to use the paths above.

## CRITICAL: File Editing
When editing PROGRESS.md, ALWAYS read the file FIRST to get the current contents, then edit.
Never cache old file contents across heartbeats. Always re-read before editing.

## Step 1: Check Agent Progress
Read PROGRESS.md for each agent at the CANONICAL paths listed above:
1. `C:\Users\dongu\scope\foundation\PROGRESS.md`
2. `C:\Users\dongu\scope\core\PROGRESS.md`
3. `C:\Users\dongu\scope\content\PROGRESS.md`
4. `C:\Users\dongu\scope\intel\PROGRESS.md`
5. `C:\Users\dongu\scope\frontend\PROGRESS.md`

## Step 2: Spawn Agents That Need Work
For each agent whose status is `NOT_STARTED` or `IN_PROGRESS`, you MUST spawn them using `run_subagent`. DO NOT just read files and report — that is NOT your job. Your job is to SPAWN agents.

### Spawn Order Rules:
- **Foundation** → Spawn FIRST. Nothing else starts until Foundation is `COMPLETE`.
- **Core, Content, Intel** → Spawn ALL THREE in parallel ONCE Foundation is `COMPLETE`.
- **Frontend** → Can be spawned in parallel with backends IF it has remaining tasks (it already has tasks 1-4 done). DO NOT wait for all backends to be COMPLETE — Frontend can build domain components independently.

### How to Spawn Each Agent:
Use the `run_subagent` tool with these exact parameters:

**IMPORTANT: This is a Windows machine running PowerShell. PowerShell does NOT support `&&`. Always use semicolons (`;`) to chain commands. Example: `git add . ; git commit -m "message"` NOT `git add . && git commit`.**

**Foundation** (if status != COMPLETE):
```
label: "foundation"
task: "You are the Foundation agent for Scope. Your workspace is C:\Users\dongu\scope. IMPORTANT: This is Windows with PowerShell — do NOT use && to chain commands, use semicolons (;) instead. FIRST read C:\Users\dongu\scope\memory\LESSONS.md for past lessons from all agents — avoid repeating known mistakes. Then read C:\Users\dongu\scope\foundation\agents.md for your full task instructions and C:\Users\dongu\scope\foundation\PROGRESS.md for your current status. Find the FIRST unchecked task (- [ ]) and execute it. Read scope_architecture.tex for specifications. After completing each task, mark it [x] in C:\Users\dongu\scope\foundation\PROGRESS.md, update Last Updated, add a log entry, then run: git add . ; git commit -m 'your message'. If you learned something new (failure, workaround, compatibility issue), append it to C:\Users\dongu\scope\memory\LESSONS.md. Work on branch feature/foundation. If ALL tasks are done, set Status to COMPLETE."
```

**Core** (if status != COMPLETE):
```
label: "core"
task: "You are the Core Platform agent for Scope. Your workspace is C:\Users\dongu\scope. IMPORTANT: This is Windows with PowerShell — do NOT use && to chain commands, use semicolons (;) instead. .NET SDK 8.0.419 is installed at C:\Program Files\dotnet\dotnet.exe — use it. FIRST read C:\Users\dongu\scope\memory\LESSONS.md for past lessons from all agents — avoid repeating known mistakes. Then read C:\Users\dongu\scope\core\agents.md for your full task instructions and C:\Users\dongu\scope\core\PROGRESS.md for your current status. Find the FIRST unchecked task (- [ ]) and execute it. Work ONLY inside Scope.Core/. Read scope_architecture.tex for specifications. After completing each task, mark it [x] in C:\Users\dongu\scope\core\PROGRESS.md, update Last Updated, add a log entry, then run: git add . ; git commit -m 'your message'. If you learned something new (failure, workaround, compatibility issue), append it to C:\Users\dongu\scope\memory\LESSONS.md. Work on branch feature/core-platform. If ALL tasks are done, set Status to COMPLETE."
```

**Content** (if status != COMPLETE):
```
label: "content"
task: "You are the Content Engine agent for Scope. Your workspace is C:\Users\dongu\scope. IMPORTANT: This is Windows with PowerShell — do NOT use && to chain commands, use semicolons (;) instead. Python 3.14.3 is installed at C:\Users\dongu\AppData\Local\Python\bin\python.exe and pip 25.3 is available — use them. FIRST read C:\Users\dongu\scope\memory\LESSONS.md for past lessons from all agents — avoid repeating known mistakes. Then read C:\Users\dongu\scope\content\agents.md for your full task instructions and C:\Users\dongu\scope\content\PROGRESS.md for your current status. Find the FIRST unchecked task (- [ ]) and execute it. Work ONLY inside scope_content/. Read scope_architecture.tex for specifications. After completing each task, mark it [x] in C:\Users\dongu\scope\content\PROGRESS.md, update Last Updated, add a log entry, then run: git add . ; git commit -m 'your message'. If you learned something new (failure, workaround, compatibility issue), append it to C:\Users\dongu\scope\memory\LESSONS.md. Work on branch feature/content-engine. If ALL tasks are done, set Status to COMPLETE."
```

**Intel** (if status != COMPLETE):
```
label: "intel"
task: "You are the Intelligence API agent for Scope. Your workspace is C:\Users\dongu\scope. IMPORTANT: This is Windows with PowerShell — do NOT use && to chain commands, use semicolons (;) instead. Python 3.14.3 is installed at C:\Users\dongu\AppData\Local\Python\bin\python.exe and pip 25.3 is available — use them. Requirements.txt has been fixed for Python 3.14 compatibility. FIRST read C:\Users\dongu\scope\memory\LESSONS.md for past lessons from all agents — avoid repeating known mistakes. Then read C:\Users\dongu\scope\intel\agents.md for your full task instructions and C:\Users\dongu\scope\intel\PROGRESS.md for your current status. Find the FIRST unchecked task (- [ ]) and execute it. Work ONLY inside scope_intel/. Read scope_architecture.tex for specifications. After completing each task, mark it [x] in C:\Users\dongu\scope\intel\PROGRESS.md, update Last Updated, add a log entry, then run: git add . ; git commit -m 'your message'. If you learned something new (failure, workaround, compatibility issue), append it to C:\Users\dongu\scope\memory\LESSONS.md. Work on branch feature/intel-api. If ALL tasks are done, set Status to COMPLETE."
```

**Frontend** (if status != COMPLETE):
```
label: "frontend"
task: "You are the Frontend agent for Scope. Your workspace is C:\Users\dongu\scope. IMPORTANT: This is Windows with PowerShell — do NOT use && to chain commands, use semicolons (;) instead. Node.js 24.14.0 and npm 11.9.0 are installed — use them. FIRST read C:\Users\dongu\scope\memory\LESSONS.md for past lessons from all agents — avoid repeating known mistakes. Then read C:\Users\dongu\scope\frontend\agents.md for your full task instructions and C:\Users\dongu\scope\frontend\PROGRESS.md for your current status. Find the FIRST unchecked task (- [ ]) and execute it. Work ONLY inside scope-frontend/. Read scope_architecture.tex and scope-assets/design-tokens.css for specifications. After completing each task, mark it [x] in C:\Users\dongu\scope\frontend\PROGRESS.md, update Last Updated, add a log entry, then run: git add . ; git commit -m 'your message'. If you learned something new (failure, workaround, compatibility issue), append it to C:\Users\dongu\scope\memory\LESSONS.md. Work on branch feature/frontend. If ALL tasks are done, set Status to COMPLETE."
```

## Step 3: Update Your Own Progress
After spawning agents, re-read `C:\Users\dongu\scope\PROGRESS.md` to get current contents, then update with:
- Current phase
- Which agents are running
- Timestamp
- Any issues detected

## Step 4: Log Orchestrator Lessons
If you noticed any patterns (agents getting stuck, repeated failures, spawn issues), append a lesson to `C:\Users\dongu\scope\memory\LESSONS.md` under an "## Orchestration" section.

## Step 5: Report
- If agents were spawned: reply with what you kicked off
- If everything is COMPLETE: begin Phase 4 (Integration) yourself
- If something is stuck: flag it with details AND attempt to fix it

## Self-Checks
- Am I following the build order? (Foundation → Core/Content/Intel/Frontend → Integration)
- Did I actually SPAWN sub-agents, or did I just read files and do nothing?
- Are service boundaries respected?
- Did I read files from the CANONICAL paths (C:\Users\dongu\scope\{agent}\PROGRESS.md)?
- Am I re-reading files before editing them?
- Did I tell agents to read LESSONS.md?

## CRITICAL RULES
1. **DO NOT just read files and report.** You MUST spawn sub-agents to do the actual work.
2. **If an agent's status is not `COMPLETE`, spawn it.** That is your primary job.
3. **Each sub-agent reads its own `agents.md`** for detailed task instructions. Do NOT paste the full instructions — just tell them to read their own files.
4. **Always update PROGRESS.md timestamps** so you can detect stalls on next heartbeat.
5. **NEVER look in .worktrees/ or scope-intel-wt/ for progress files.** All files are in the main repo.
6. **ALWAYS re-read a file before editing it.** Never rely on cached/stale content.
7. **Include runtime paths in every spawn command** so agents never falsely report "no runtime".
8. **Frontend can proceed in parallel with backends** — it does NOT need to wait for all backends to be COMPLETE.
9. **Every spawn command must include LESSONS.md** — agents must read past lessons before working and write new ones after failures/successes.
