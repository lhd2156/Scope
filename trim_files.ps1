# Trim HEARTBEAT.md
$hb = Get-Content "C:\Users\dongu\atlas\HEARTBEAT.md.pretrim"
$n = @()
$n += $hb[0..52]
$n += "**All agents completed Phases 1-12. Only Phase 13+ work remains.**"
$n += "Use the Phase 13+ spawn prompts in the Phase Progression section below."
$n += $hb[82..138]
$n += "10. **Keep PROGRESS.md compact.** After updating the Log, if it exceeds 15 entries, delete the oldest to keep only the 15 most recent. This prevents context-window bloat."
$n += ""
$n += "## Phase Progression"
$n += ""
$n += "### Phases 4-12: ALL COMPLETE"
$n += "All service agents completed Phases 4 through 12. Docker-compose wiring, CI/CD, K8s manifests, Terraform baseline, and docs are in place."
$n += ""
$n += $hb[294..($hb.Length - 1)]
$n | Set-Content "C:\Users\dongu\atlas\HEARTBEAT.md" -Encoding UTF8
$hbChars = ($n | Out-String).Length
Write-Host "HEARTBEAT: $($hb.Length) -> $($n.Length) lines, $hbChars chars"

# Trim PROGRESS.md
$pg = Get-Content "C:\Users\dongu\atlas\PROGRESS.md.pretrim"
$p = @()
$p += $pg[0..51]
$p += "- [Phases 1-12] Log entries trimmed. All phases completed 2026-03-28 through 2026-03-29."
$p += ""
$p | Set-Content "C:\Users\dongu\atlas\PROGRESS.md" -Encoding UTF8
$pgChars = ($p | Out-String).Length
Write-Host "PROGRESS: $($pg.Length) -> $($p.Length) lines, $pgChars chars"
