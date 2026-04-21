<#
.SYNOPSIS
    Task completion wrapper - commits work AND forces lesson logging.
    Agents MUST use this instead of raw git commands.

.PARAMETER Message
    Commit message (conventional commit format)

.PARAMETER Result
    "success" or "failure"

.PARAMETER Lesson
    What was learned (required if Result is "failure", optional for success)

.PARAMETER Agent
    Agent name (foundation, core, content, intel, frontend)

.EXAMPLE
    .\scripts\complete-task.ps1 -Message "feat(core): add auth controller" -Result "success" -Lesson "EF Core migrations need --project flag on Windows" -Agent "core"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Message,

    [Parameter(Mandatory=$true)]
    [ValidateSet("success", "failure")]
    [string]$Result,

    [Parameter(Mandatory=$false)]
    [string]$Lesson = "",

    [Parameter(Mandatory=$true)]
    [ValidateSet("foundation", "core", "content", "intel", "frontend", "polish", "orchestrator")]
    [string]$Agent
)

$ErrorActionPreference = "Continue"
$lessonsFile = "C:\Users\dongu\atlas\memory\LESSONS.md"
$completedFile = "C:\Users\dongu\atlas\memory\COMPLETED-TASKS.md"
$date = Get-Date -Format "yyyy-MM-dd"
$ts = Get-Date -Format "yyyy-MM-ddTHH:mmZ"

# Step 1: Git add and commit
Write-Host ">>> Committing: $Message" -ForegroundColor Cyan
git add .
git commit -m $Message

if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> Git commit failed!" -ForegroundColor Red
    $Lesson = "Git commit failed for agent $Agent with message: $Message. Error code: $LASTEXITCODE"
    $Result = "failure"
}

# Step 1.5: Append to COMPLETED-TASKS.md (lightweight done ledger)
if ($Result -eq "success") {
    $taskEntry = "- [$ts] $Agent $Message ✅"
    if (Test-Path $completedFile) {
        Add-Content -Path $completedFile -Value $taskEntry
    } else {
        New-Item -Path $completedFile -ItemType File -Force | Out-Null
        Set-Content -Path $completedFile -Value "# Completed Tasks Ledger`n`n$taskEntry"
    }
    Write-Host ">>> Logged to COMPLETED-TASKS.md" -ForegroundColor Green
}

# Step 2: Force-log lesson if provided or if failure
if ($Result -eq "failure") {
    if ([string]::IsNullOrWhiteSpace($Lesson)) {
        $Lesson = "Task failed for agent $Agent - commit message was: $Message (no specific lesson provided)"
    }
}

if (-not [string]::IsNullOrWhiteSpace($Lesson)) {
    if ($Result -eq "success") {
        $emoji = "[SUCCESS]"
    } else {
        $emoji = "[FAILURE]"
    }
    $entry = "- [$date] $emoji [$Agent] $Lesson"

    Write-Host ">>> Logging lesson: $entry" -ForegroundColor Yellow

    # Append to LESSONS.md
    if (Test-Path $lessonsFile) {
        Add-Content -Path $lessonsFile -Value $entry
        Write-Host ">>> Lesson appended to LESSONS.md" -ForegroundColor Green
    } else {
        Write-Host ">>> LESSONS.md not found at $lessonsFile! Creating it..." -ForegroundColor Red
        New-Item -Path $lessonsFile -ItemType File -Force | Out-Null
        Set-Content -Path $lessonsFile -Value "# Agent Lessons Learned`n`n$entry"
        Write-Host ">>> Created LESSONS.md with first lesson" -ForegroundColor Green
    }
} else {
    Write-Host ">>> No new lesson to log (task succeeded with no new insights)" -ForegroundColor Gray
}

# Step 3: Report
Write-Host ""
Write-Host "=== Task Complete ===" -ForegroundColor Green
Write-Host "Agent:   $Agent"
Write-Host "Result:  $Result"
Write-Host "Commit:  $Message"
if (-not [string]::IsNullOrWhiteSpace($Lesson)) {
    Write-Host "Lesson:  $Lesson"
}
