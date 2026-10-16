#Requires -Version 7.0

<#
.SYNOPSIS
    Log-AuditFailureMode.ps1 - In-flight failure mode harvester for memory/observed/antifragile.md.
.DESCRIPTION
    Fulfills AGENTS.md Rule 12 by codifying audit-discovered failure modes into durable memory:
    - Finds highest FP-xxx sequence number in memory/observed/antifragile.md
    - Appends formatted failure patch with today's date
    - Verifies zero em-dash compliance (ADR-0012)
    - Automatically syncs memory/observed/antifragile.md into mem0 index
.PARAMETER Component
    The target file, folder, or subsystem that failed (e.g. "modes/03-peer.md").
.PARAMETER Title
    A concise title summarizing the operational defect.
.PARAMETER FailureMode
    The failure category: Poisoning, Bloat, Confusion, Clash, Regression, or BrokenContract.
.PARAMETER Failure
    Description of what failed or was broken.
.PARAMETER RootCause
    The technical underlying cause of the failure.
.PARAMETER PermanentRule
    The non-negotiable permanent rule or counter-rule that prevents recurrence.
.PARAMETER SkipMem0
    Suppress running scripts/Sync-Mem0Index.ps1 after logging.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Component,

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$Title,

    [Parameter(Mandatory = $true, Position = 2)]
    [ValidateSet("Poisoning", "Bloat", "Confusion", "Clash", "Regression", "BrokenContract")]
    [string]$FailureMode,

    [Parameter(Mandatory = $true)]
    [string]$Failure,

    [Parameter(Mandatory = $true)]
    [string]$RootCause,

    [Parameter(Mandatory = $true)]
    [string]$PermanentRule,

    [Parameter()]
    [switch]$SkipMem0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Zero Em-Dash Validation
$allInputs = @($Component, $Title, $FailureMode, $Failure, $RootCause, $PermanentRule)
foreach ($text in $allInputs) {
    if ($text.Contains([char]0x2014)) {
        throw "ADR-0012 Violation: Text contains Unicode character U+2014. Use colons, commas, hyphens, or parentheses."
    }
}

# Resolve paths
$coreModule = Join-Path $PSScriptRoot "..\..\..\..\scripts\modules\AIOSCore.psm1"
if (-not (Test-Path -LiteralPath $coreModule)) {
    $coreModule = Join-Path (Get-Location) "scripts\modules\AIOSCore.psm1"
}
if (Test-Path -LiteralPath $coreModule) {
    Import-Module -Name $coreModule -Force
}

$repoRoot = if (Get-Command -Name "Resolve-AIOSRepoRoot" -ErrorAction SilentlyContinue) {
    Resolve-AIOSRepoRoot -StartPath $PSScriptRoot
} else {
    (Get-Location).Path
}

$antifragilePath = Join-Path $repoRoot "memory\observed\antifragile.md"
if (-not (Test-Path -LiteralPath $antifragilePath)) {
    throw "Target antifragile log not found: $antifragilePath"
}

$content = [System.IO.File]::ReadAllText($antifragilePath, [System.Text.Encoding]::UTF8)

# Find highest FP-xxx sequence number
$matches = [regex]::Matches($content, "(?m)^###\s+FP-(\d+):")
$highestNum = 0
foreach ($m in $matches) {
    $val = [int]$m.Groups[1].Value
    if ($val -gt $highestNum) { $highestNum = $val }
}
$nextNum = $highestNum + 1
$fpId = "FP-{0:D3}" -f $nextNum

$today = (Get-Date).ToString("yyyy-MM-dd")

$entry = @"

### $($fpId): $Title (Logged $today)
- **Component:** ``$Component`` (Failure Mode: $FailureMode)
- **Failure:** $Failure
- **Root Cause:** $RootCause
- **Permanent Rule:** $PermanentRule
"@

[System.IO.File]::AppendAllText($antifragilePath, $entry, [System.Text.Encoding]::UTF8)
Write-Host "`n[LOGGED] $fpId appended to memory/observed/antifragile.md" -ForegroundColor Green
Write-Host "  Component: $Component" -ForegroundColor Gray
Write-Host "  Mode:      $FailureMode" -ForegroundColor Gray
Write-Host "  Title:     $Title" -ForegroundColor Gray

# Sync to mem0 index if script exists
if (-not $SkipMem0) {
    $syncScript = Join-Path $repoRoot "scripts\Sync-Mem0Index.ps1"
    if (Test-Path -LiteralPath $syncScript) {
        Write-Host "`n[MEM0] Syncing memory/observed/antifragile.md into mem0 index..." -ForegroundColor Cyan
        try {
            & pwsh -NoProfile -File $syncScript -File "memory/observed/antifragile.md"
        } catch {
            Write-Warning "mem0 sync encountered a non-fatal error: $_"
        }
    }
}

return [PSCustomObject]@{
    Id          = $fpId
    Component   = $Component
    FailureMode = $FailureMode
    Title       = $Title
    LoggedDate  = $today
    Status      = "HARVESTED"
}
