<#
.SYNOPSIS
    Pre-task loader — MUST be run before starting any task.
    Reads LESSONS.md and outputs it so the agent's context is loaded.

.PARAMETER Agent
    Agent name

.EXAMPLE
    .\scripts\load-lessons.ps1 -Agent "core"
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("foundation", "core", "content", "intel", "frontend", "polish", "orchestrator")]
    [string]$Agent
)

$lessonsFile = "C:\Users\dongu\atlas\memory\LESSONS.md"

Write-Host "=== Loading Lessons for Agent: $Agent ===" -ForegroundColor Cyan
Write-Host ""

if (Test-Path $lessonsFile) {
    $content = Get-Content $lessonsFile -Raw
    $lineCount = (Get-Content $lessonsFile).Count
    Write-Host $content
    Write-Host ""
    Write-Host "=== $lineCount lessons loaded. Do NOT repeat past mistakes. ===" -ForegroundColor Green
} else {
    Write-Host ">>> WARNING: LESSONS.md not found at $lessonsFile" -ForegroundColor Red
    Write-Host ">>> Creating empty LESSONS.md..." -ForegroundColor Yellow
    New-Item -Path $lessonsFile -ItemType File -Force | Out-Null
    Set-Content -Path $lessonsFile -Value "# Agent Lessons Learned`n`n> No lessons yet.`n"
    Write-Host ">>> Created. Proceeding with no prior lessons." -ForegroundColor Yellow
}
