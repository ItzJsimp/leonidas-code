#Requires -Version 7.0
<#
.SYNOPSIS
  One session-start routine for every engine (Claude settings.json, Codex hooks.json).
.DESCRIPTION
  Guarded source sync, AIOS task view (only when nested in an AIOS), next-action install,
  adapter drift check, then branch status in the background. -Json wraps the report for Codex.
#>
param([switch]$Json)

$ErrorActionPreference = 'Continue'
$aios = Join-Path $PSScriptRoot '../../..'
# Each step is isolated: one failing helper must not hide the rest of the report.
function Step([string]$Name, [scriptblock]$Body) {
    try { & $Body } catch { "[WARN] ${Name}: $($_.Exception.Message)" }
}
$report = & {
    Step 'source sync' { & (Join-Path $PSScriptRoot 'Sync-LeonidasSource.ps1') | Select-Object -Last 3 }
    if (Test-Path -LiteralPath (Join-Path $aios 'tasks')) {
        Step 'task view' { & (Join-Path $PSScriptRoot 'Sync-ProjectTaskViews.ps1') -RepoPath $aios -Project leonidas-code | Select-Object -Last 2 }
    }
    Step 'next action' { & (Join-Path $PSScriptRoot 'Install-NextAction.ps1') | Select-Object -Last 3 }
    Step 'adapters' { & (Join-Path $PSScriptRoot 'Build-AgentAdapters.ps1') -Check }
    Step 'branch status' { Start-Process pwsh -WindowStyle Hidden -ArgumentList '-NoProfile', '-File', (Join-Path $PSScriptRoot 'Write-BranchStatus.ps1') }
} *>&1 | Out-String

if ($Json) {
    @{ hookSpecificOutput = @{ hookEventName = 'SessionStart'; additionalContext = $report.Trim() } } | ConvertTo-Json -Compress
} else {
    $report.Trim()
}
exit 0
