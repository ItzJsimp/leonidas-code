#Requires -Version 7.0
<#
.SYNOPSIS
    Deterministic footprint of a code change for the performance-gate skill.
.DESCRIPTION
    Measures the working-tree diff (staged + unstaged + untracked) against a base ref in any git repo:
    net lines, new dependencies, oversized or new files, debug leftovers. Prints a verdict line per check
    and exits 1 when a hard check fails. It measures bloat signals only; speed and memory still need a
    real before/after measurement (see references/measure-recipes.md).
    -Paths limits every check to the given repo-relative files or folders, so other work in a shared checkout is not counted.
.EXAMPLE
    pwsh scripts/Measure-ChangeFootprint.ps1 -Repo . -Paths apps/server/src/taskBoard/aiosCards.ts
.EXAMPLE
    pwsh scripts/Measure-ChangeFootprint.ps1 -Repo D:\Leonidas AIOS\projects\leonidas-scribe
#>
[CmdletBinding()]
param(
    [string]$Repo = (Get-Location).Path,
    [string]$Base = 'HEAD',
    [int]$MaxFileLines = 600,
    [int]$MaxNetLines = 400,
    [string[]]$Paths = @(),
    [switch]$Json
)
$ErrorActionPreference = 'Stop'
$git = @('-C', $Repo)
$null = & git @git rev-parse --show-toplevel 2>&1
if ($LASTEXITCODE) { throw "Not a git repository: $Repo" }

$srcExt = '\.(ts|tsx|js|jsx|mjs|cjs|py|cs|ps1|css|rs|go)$'
$skipPath = '(^|/)(node_modules|dist|build|release|\.venv|__pycache__|pnpm-lock\.yaml|package-lock\.json)(/|$)|\.lock$|\.min\.'

$spec = @(if ($Paths) { $Paths } else { '.' })
$stat = & git @git diff $Base --numstat --no-renames -- @spec
$untracked = & git @git ls-files --others --exclude-standard -- @spec
$files = @(foreach ($line in $stat) {
    $a, $d, $p = $line -split "`t", 3
    if ($p -match $skipPath -or $a -eq '-') { continue }
    [pscustomobject]@{ Path = $p; Added = [int]$a; Deleted = [int]$d; New = $false }
})
foreach ($p in $untracked) {
    if ($p -match $skipPath -or $p -notmatch $srcExt) { continue }
    $full = Join-Path $Repo $p
    $n = @(Get-Content -LiteralPath $full -ErrorAction SilentlyContinue).Count
    $files += [pscustomobject]@{ Path = $p; Added = $n; Deleted = 0; New = $true }
}
$files = @($files)
$added = ($files | Measure-Object Added -Sum).Sum
$deleted = ($files | Measure-Object Deleted -Sum).Sum
$net = [int]$added - [int]$deleted

# New dependencies: added lines in manifests that look like a package entry.
$depLines = @()
foreach ($m in 'package.json', 'pyproject.toml', 'requirements.txt', 'requirements-dev.txt') {
    $mSpec = if ($Paths) { @($Paths | Where-Object { (Split-Path $_ -Leaf) -eq $m }) } else { @("**/$m", $m) }
    if (-not $mSpec) { continue }
    $patch = & git @git diff $Base --unified=0 --no-renames -- @mSpec 2>$null
    $depLines += $patch | Where-Object { $_ -match '^\+\s*"[@A-Za-z0-9_./-]+"\s*:\s*"(\^|~|>=?|<=?|workspace:|catalog:|npm:|github:|\d)' -or $_ -match '^\+\s*[A-Za-z0-9_.-]+(\[[^\]]+\])?\s*(==|>=|<=|~=|!=)\s*[\d.]+' -or $_ -match '^\+\s*[A-Za-z0-9_.-]+\s*=\s*"[\^~><=\d*][^"]*"' }
}
# Oversized: changed source files that grew and end above the line budget (pre-existing giants that shrank are fine).
$big = foreach ($f in $files | Where-Object { $_.Path -match $srcExt -and $_.Added -gt $_.Deleted }) {
    $n = @(Get-Content -LiteralPath (Join-Path $Repo $f.Path) -ErrorAction SilentlyContinue).Count
    if ($n -gt $MaxFileLines) { "$($f.Path) ($n lines)" }
}
# Debug leftovers in added lines only.
$added_text = & git @git diff $Base --unified=0 --no-renames -- @spec ':!*.md' ':!*.lock' ':!*lock.yaml' 2>$null | Where-Object { $_ -match '^\+' -and $_ -notmatch '^\+\+\+' }
$debug = @($added_text | Where-Object { $_ -match '\bconsole\.(log|debug)\(|\bdebugger\b|^\+\s*print\(|\bbreakpoint\(\)|Write-Host\s+.*DEBUG|\bTODO\b|\bFIXME\b|\bXXX\b' })

$checks = @(
    [pscustomobject]@{ Check = 'net-lines'; Hard = $false; Pass = ($net -le $MaxNetLines); Detail = "+$added/-$deleted = net $net (budget $MaxNetLines)" }
    [pscustomobject]@{ Check = 'new-dependencies'; Hard = $true; Pass = ($depLines.Count -eq 0); Detail = "$($depLines.Count) added manifest line(s); each needs a written reason" }
    [pscustomobject]@{ Check = 'oversized-files'; Hard = $false; Pass = (@($big).Count -eq 0); Detail = $(if ($big) { $big -join '; ' } else { "none above $MaxFileLines lines" }) }
    [pscustomobject]@{ Check = 'debug-leftovers'; Hard = $true; Pass = ($debug.Count -eq 0); Detail = "$($debug.Count) added line(s) with debug or TODO markers" }
)
if ($Json) { $checks | ConvertTo-Json -Depth 3; }
else {
    foreach ($c in $checks) { '{0,-4} {1,-17} {2}' -f $(if ($c.Pass) { 'PASS' } else { 'FAIL' }), $c.Check, $c.Detail }
    if ($depLines) { $depLines | Select-Object -First 8 | ForEach-Object { "     dep> $_" } }
    if ($debug) { $debug | Select-Object -First 5 | ForEach-Object { "     dbg> $($_.Trim())" } }
}
exit ([int](@($checks | Where-Object { $_.Hard -and -not $_.Pass }).Count -gt 0))
