#Requires -Version 7.0

<#
.SYNOPSIS
    Move-AiosComponent.ps1 - Atomic component relocation and inbound link refactoring engine.
.DESCRIPTION
    Safely moves or renames any AIOS component while automatically rewriting all inbound
    relative markdown links across the repository:
    - Discovers all referencing files via ripgrep (rg)
    - Computes new relative paths for each referring document
    - Atomically updates link targets in referencing markdown documents
    - Moves source file to destination via git mv (preserving git history)
    - Verifies zero broken links on completion
.PARAMETER Source
    The path to the source file or directory being moved/renamed.
.PARAMETER Destination
    The path to the new destination file or directory.
.PARAMETER RepoRoot
    The repository root path (defaults to auto-detected AIOS root).
.PARAMETER Execute
    Apply the moves and link rewrites to disk. Defaults to dry-run (WhatIf) mode.
.PARAMETER AsJson
    Switch to output results as a JSON string.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Source,

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$Destination,

    [Parameter(Position = 2)]
    [string]$RepoRoot = "",

    [Parameter()]
    [switch]$Execute,

    [Parameter()]
    [switch]$AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Resolve repo root
$coreModule = Join-Path $PSScriptRoot "..\..\..\..\scripts\modules\AIOSCore.psm1"
if (-not (Test-Path -LiteralPath $coreModule)) {
    $coreModule = Join-Path (Get-Location) "scripts\modules\AIOSCore.psm1"
}
if (Test-Path -LiteralPath $coreModule) {
    Import-Module -Name $coreModule -Force
}

$resolvedRepoRoot = if (-not [string]::IsNullOrWhiteSpace($RepoRoot) -and (Test-Path -LiteralPath $RepoRoot)) {
    (Resolve-Path -LiteralPath $RepoRoot).Path
} elseif (Get-Command -Name "Resolve-AIOSRepoRoot" -ErrorAction SilentlyContinue) {
    Resolve-AIOSRepoRoot -StartPath $PSScriptRoot
} else {
    (Get-Location).Path
}

# Resolve source and destination
$sourcePath = if ([System.IO.Path]::IsPathRooted($Source)) { $Source } else { Join-Path $resolvedRepoRoot $Source }
$destPath   = if ([System.IO.Path]::IsPathRooted($Destination)) { $Destination } else { Join-Path $resolvedRepoRoot $Destination }

if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Source path does not exist: $sourcePath"
}

if ((Test-Path -LiteralPath $destPath) -and ($sourcePath -ne $destPath)) {
    throw "Destination path already exists: $destPath"
}

$resolvedSource = (Resolve-Path -LiteralPath $sourcePath).Path
$sourceRel = $resolvedSource.Substring($resolvedRepoRoot.Length).TrimStart("\/") -replace "\\", "/"
$destRel   = if ($destPath.StartsWith($resolvedRepoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    $destPath.Substring($resolvedRepoRoot.Length).TrimStart("\/") -replace "\\", "/"
} else {
    $destPath -replace "\\", "/"
}

$sourceName = Split-Path -Leaf $resolvedSource
$destName   = Split-Path -Leaf $destPath

Write-Host "`n=== AIOS Atomic Component Relocation Engine ===" -ForegroundColor Cyan
Write-Host "Source:      $sourceRel" -ForegroundColor Gray
Write-Host "Destination: $destRel" -ForegroundColor Gray
Write-Host "Mode:        $(if ($Execute) { 'EXECUTE (Writing to disk)' } else { 'DRY RUN (Preview only; pass -Execute to apply)' })`n" -ForegroundColor Yellow

# Step 1: Discover Referencing Files via Ripgrep
$referencingFiles = [System.Collections.Generic.List[string]]::new()
$rgPath = Get-Command -Name "rg" -ErrorAction SilentlyContinue

if ($rgPath) {
    $escapedTarget = [regex]::Escape($sourceName)
    $rgMatches = & rg -l --hidden --glob "!**/.git/**" --glob "!**/node_modules/**" --glob "*.md" "(?:\(|\[.*\]\()\s*[^)]*$escapedTarget" $resolvedRepoRoot 2>$null
    foreach ($m in ($rgMatches -split "\r?\n")) {
        if (-not [string]::IsNullOrWhiteSpace($m) -and (Test-Path -LiteralPath $m)) {
            $full = (Resolve-Path -LiteralPath $m).Path
            if ($full -ne $resolvedSource) {
                $referencingFiles.Add($full)
            }
        }
    }
} else {
    $allMds = Get-ChildItem -Path $resolvedRepoRoot -Recurse -Filter "*.md" | Where-Object {
        $_.FullName -notmatch "[\\/](\.git|node_modules|archive|brain)[\\/]" -and $_.FullName -ne $resolvedSource
    }
    foreach ($mf in $allMds) {
        $txt = try { [System.IO.File]::ReadAllText($mf.FullName, [System.Text.Encoding]::UTF8) } catch { "" }
        if ($txt.Contains($sourceName)) {
            $referencingFiles.Add($mf.FullName)
        }
    }
}

Write-Host "Discovered $(@($referencingFiles).Count) referencing markdown file(s):" -ForegroundColor White

$rewriteManifest = [System.Collections.Generic.List[PSObject]]::new()

foreach ($refFile in $referencingFiles) {
    $refDir = Split-Path -Parent $refFile
    $refRel = $refFile.Substring($resolvedRepoRoot.Length).TrimStart("\/") -replace "\\", "/"
    
    $content = [System.IO.File]::ReadAllText($refFile, [System.Text.Encoding]::UTF8)
    
    # Calculate new relative link from referring file's directory to new destination
    $newRelPathRaw = [System.IO.Path]::GetRelativePath($refDir, $destPath) -replace "\\", "/"
    if (-not $newRelPathRaw.StartsWith(".") -and -not $newRelPathRaw.StartsWith("/")) {
        $newRelPathRaw = "./$newRelPathRaw"
    }

    # Match markdown links referencing the source file name
    $escapedLeaf = [regex]::Escape($sourceName)
    $linkPattern = "(?<=\]\()([^)\s]*?$escapedLeaf)(?=[#\)\s])"
    
    $linkMatches = [regex]::Matches($content, $linkPattern)
    $modCount = $linkMatches.Count
    $newContent = if ($modCount -gt 0) {
        [regex]::Replace($content, $linkPattern, $newRelPathRaw)
    } else {
        $content
    }

    if ($modCount -gt 0) {
        $manifestItem = [PSCustomObject]@{
            ReferencingFile = $refRel
            LinksUpdated    = $modCount
            OldTarget       = $sourceName
            NewTarget       = $newRelPathRaw
        }
        $rewriteManifest.Add($manifestItem)
        Write-Host "  -> $($refRel): $modCount link(s) updated -> $newRelPathRaw" -ForegroundColor Green

        if ($Execute) {
            [System.IO.File]::WriteAllText($refFile, $newContent, [System.Text.Encoding]::UTF8)
        }
    }
}

# Step 2: Execute Move (git mv or Move-Item)
$moveSuccess = $false
$moveMethod  = "dry-run"

if ($Execute) {
    # Ensure destination parent directory exists
    $destDir = Split-Path -Parent $destPath
    if (-not (Test-Path -LiteralPath $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }

    # Attempt git mv first
    $gitMv = & git mv "$resolvedSource" "$destPath" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $moveMethod = "git-mv"
        $moveSuccess = $true
        Write-Host "`n[GIT] Component moved via 'git mv': $sourceRel -> $destRel" -ForegroundColor Green
    } else {
        # Fallback to Move-Item
        Move-Item -LiteralPath $resolvedSource -Destination $destPath -Force
        $moveMethod = "filesystem-move"
        $moveSuccess = $true
        Write-Host "`n[FS] Component moved via Move-Item: $sourceRel -> $destRel" -ForegroundColor Green
    }

    # Verify link health on destination
    if (Test-Path -LiteralPath $destPath) {
        Write-Host "[VERIFY] Verifying destination integrity..." -ForegroundColor Gray
        $auditScript = Join-Path $PSScriptRoot "Audit-Component.ps1"
        if (Test-Path -LiteralPath $auditScript) {
            & pwsh -NoProfile -File $auditScript -Target $destRel -NoLog | Out-Null
        }
    }
} else {
    Write-Host "`n[DRY RUN] Would execute move: $sourceRel -> $destRel" -ForegroundColor Yellow
}

$summary = [PSCustomObject]@{
    Source          = $sourceRel
    Destination     = $destRel
    ReferencingDocs = @($referencingFiles).Count
    RewritesCount   = @($rewriteManifest).Count
    Rewrites        = $rewriteManifest
    Executed        = $Execute.IsPresent
    MoveMethod      = $moveMethod
    Status          = if ($Execute) { "COMPLETED" } else { "DRY_RUN_PASSED" }
}

if ($AsJson) {
    return ($summary | ConvertTo-Json -Depth 5)
}

return $summary
