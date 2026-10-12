#Requires -Version 7.0
$ErrorActionPreference = 'Stop'
# Codex hooks consume JSON; keep the installer's console report inside additional context.
$report = & {
    & (Join-Path $PSScriptRoot 'Sync-LeonidasSource.ps1')
    & (Join-Path $PSScriptRoot 'Install-NextAction.ps1')
} *>&1 | Out-String
@{ hookSpecificOutput = @{ hookEventName = 'SessionStart'; additionalContext = $report.Trim() } } |
    ConvertTo-Json -Compress
