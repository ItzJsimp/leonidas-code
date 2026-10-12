<#
.SYNOPSIS
  Writes a plain-English status file of every branch in this repository.
.DESCRIPTION
  Answers "what is in progress, who has it, and is it behind main?" without any Git knowledge.
  Lists each local and origin branch other than main with its owner, the folder it is checked
  out in, how far it is ahead of or behind origin/main, whether it has unsaved or unpushed work,
  and one state: uncommitted, behind, stale, new, ready or merged. Read-only apart from one throttled
  `git fetch` and the output file, which sits inside the shared .git directory so it is never
  committed and every worktree of the repository reads the same copy.
  Prints one [branch-status] line. Pass -PassThru to also return the rows.
#>
[CmdletBinding()]
param(
  # Repository (or any of its worktrees). Defaults to the repository this script lives in.
  [string]$RepoPath,
  [string]$Remote = 'origin',
  [string]$Base = 'main',
  # Where the markdown goes. Defaults to <git common dir>/leonidas/branch-status.md.
  [string]$OutFile,
  # Skip the fetch and trust the remote-tracking refs already on disk.
  [switch]$NoFetch,
  # A branch with no commit for this many days is called stale.
  [int]$StaleDays = 3,
  # Branches that exist only on GitHub and have been idle longer than this are counted, not listed.
  [int]$RecentDays = 14,
  # Git author names of the people building this repo (Jake is ItzJsimp, Mob is Seth Moncada).
  [string[]]$Team = @('ItzJsimp', 'Seth Moncada'),
  [switch]$PassThru
)
$ErrorActionPreference = 'Stop'
if (Test-Path Variable:PSNativeCommandUseErrorActionPreference) { $PSNativeCommandUseErrorActionPreference = $false }

$root = if ($RepoPath) { (Resolve-Path -LiteralPath $RepoPath).Path } else { Split-Path -Parent $PSScriptRoot }
$baseRef = "$Remote/$Base"

function Invoke-Git {
  param([string]$Dir, [string[]]$GitArgs)
  $out = & git -C $Dir @GitArgs 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  return $out
}

$commonRaw = Invoke-Git $root @('rev-parse', '--git-common-dir')
if (-not $commonRaw) {
  Write-Host "[branch-status] Not a git repository: $root"
  return
}
$commonDir = ([string]$commonRaw).Trim()
if (-not [IO.Path]::IsPathRooted($commonDir)) { $commonDir = Join-Path $root $commonDir }
$commonDir = (Resolve-Path -LiteralPath $commonDir).Path
if (-not $OutFile) { $OutFile = Join-Path (Join-Path $commonDir 'leonidas') 'branch-status.md' }

# One fetch at most per five minutes (fetching every branch of a fork takes ~20 s), so every session start can call this cheaply.
$fetchNote = $null
if (-not $NoFetch) {
  $stamp = Join-Path $commonDir 'FETCH_HEAD'
  $fresh = (Test-Path -LiteralPath $stamp) -and (((Get-Date) - (Get-Item -LiteralPath $stamp).LastWriteTime).TotalSeconds -lt 300)
  if (-not $fresh) {
    $null = & git -C $root fetch --prune --no-tags $Remote 2>&1
    if ($LASTEXITCODE -ne 0) { $fetchNote = "Could not reach $Remote; the numbers below come from the last successful fetch." }
  }
}

if (-not (Invoke-Git $root @('rev-parse', '--verify', '--quiet', "refs/remotes/$baseRef"))) {
  Write-Host "[branch-status] $baseRef is missing; nothing to compare against."
  return
}

# Which folder holds which branch, and whether that folder has unsaved changes.
$checkouts = @{}
$current = $null
foreach ($line in (Invoke-Git $root @('worktree', 'list', '--porcelain'))) {
  if ($line -like 'worktree *') { $current = @{ Path = $line.Substring(9); Branch = $null } }
  elseif ($line -like 'branch refs/heads/*' -and $current) {
    $current.Branch = $line.Substring(18)
    $checkouts[$current.Branch] = $current
  }
}

# One for-each-ref answers ahead/behind, age, author and push state for every branch, so the
# cost does not grow with the number of branches (a fork inherits hundreds from upstream).
$format = '%(refname)|%(committerdate:unix)|%(authorname)|%(ahead-behind:' + $baseRef + ')|%(upstream:track)'
$mergedRefs = @{}
foreach ($m in (Invoke-Git $root @('for-each-ref', '--merged', $baseRef, '--format=%(refname)', 'refs/heads', "refs/remotes/$Remote"))) { $mergedRefs[$m] = $true }

$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$byName = [ordered]@{}
foreach ($ref in (Invoke-Git $root @('for-each-ref', "--format=$format", 'refs/heads', "refs/remotes/$Remote"))) {
  $p = $ref -split '\|', 5
  $isRemote = $p[0].StartsWith('refs/remotes/')
  $name = if ($isRemote) { $p[0].Substring("refs/remotes/$Remote/".Length) } else { $p[0].Substring('refs/heads/'.Length) }
  if ($name -eq $Base -or $name -eq 'HEAD') { continue }
  if (-not $byName.Contains($name)) { $byName[$name] = @{ Local = $null; Remote = $null } }
  $byName[$name][$(if ($isRemote) { 'Remote' } else { 'Local' })] = @{ Ref = $p[0]; Time = [int64]$p[1]; Owner = $p[2]; Counts = ($p[3] -split ' '); Track = $p[4] }
}

# Branches only on GitHub by anyone outside the team (the hundreds inherited from upstream) are
# counted, not listed.
$ownAuthors = @{}
foreach ($member in $Team) { $ownAuthors[$member] = $true }

$rows = @()
$hiddenOld = 0
$hiddenOthers = 0
foreach ($name in $byName.Keys) {
  $entry = $byName[$name]
  $hasLocal = $null -ne $entry.Local
  $tip = if ($hasLocal) { $entry.Local } else { $entry.Remote }
  $ageDays = [math]::Floor(($now - $tip.Time) / 86400)
  $folder = if ($checkouts.ContainsKey($name)) { $checkouts[$name].Path } else { $null }

  if (-not $hasLocal -and -not $folder -and -not $ownAuthors.ContainsKey($tip.Owner)) { $hiddenOthers++; continue }
  # Our own branches that only exist on GitHub and have gone quiet are counted, not listed.
  if (-not $hasLocal -and -not $folder -and $ageDays -gt $RecentDays) { $hiddenOld++; continue }

  $ahead = [int]$tip.Counts[0]
  $behind = [int]$tip.Counts[1]
  $merged = $mergedRefs.ContainsKey($tip.Ref)

  # Work on this machine that GitHub does not have yet.
  $unpushed = 0
  if ($hasLocal -and $entry.Remote) {
    if ($tip.Track -match 'ahead (\d+)') { $unpushed = [int]$Matches[1] }
  } elseif ($hasLocal) {
    $unpushed = $ahead
  }

  $rows += [pscustomobject]@{
    Branch = $name; Owner = $tip.Owner; Ahead = $ahead; Behind = $behind; Unpushed = $unpushed
    AgeDays = $ageDays; Folder = $folder; Merged = $merged; Unsaved = 0; State = $null; Meaning = $null
  }
}

# Unsaved changes need a status run inside each checked-out folder; run them side by side.
$withFolder = @($rows | Where-Object { $_.Folder })
if ($withFolder.Count -gt 0) {
  $dirtyCounts = $withFolder | ForEach-Object -ThrottleLimit 6 -Parallel {
    $n = @(& git -C $_.Folder status --porcelain 2>$null | Where-Object { $_ }).Count
    [pscustomobject]@{ Branch = $_.Branch; Count = $n }
  }
  foreach ($d in $dirtyCounts) { ($rows | Where-Object { $_.Branch -eq $d.Branch }).Unsaved = $d.Count }
}

foreach ($r in $rows) {
  $r.State = if ($r.Ahead -eq 0 -and $r.Behind -eq 0) { 'new' }
  elseif ($r.Merged) { 'merged' }
  elseif ($r.Unsaved -gt 0) { 'uncommitted' }
  elseif ($r.Behind -gt 0) { 'behind' }
  elseif ($r.AgeDays -ge $StaleDays) { 'stale' }
  else { 'ready' }

  $r.Meaning = switch ($r.State) {
    'new'         { 'Just started: no commits yet.' }
    'merged'      { 'Already in main. Safe to delete.' }
    'uncommitted' { "Has $($r.Unsaved) unsaved change(s) in its folder. Not safe to switch or delete." }
    'behind'      { "Main has $($r.Behind) newer change(s). Update this branch before merging." }
    'stale'       { "No activity for $($r.AgeDays) day(s). Finish it, merge it or delete it." }
    default       { 'Up to date with main. Ready to merge when the work is done.' }
  }
  if ($r.Unpushed -gt 0 -and $r.State -ne 'merged') { $r.Meaning += " $($r.Unpushed) commit(s) exist only on this computer, not on GitHub." }
}
$rows = @($rows | Sort-Object @{ Expression = { @('uncommitted', 'behind', 'stale', 'new', 'ready', 'merged').IndexOf($_.State) } }, Branch)

$mainTip = ([string](Invoke-Git $root @('rev-parse', '--short', "refs/remotes/$baseRef"))).Trim()
$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine('# Branch status')
[void]$sb.AppendLine()
[void]$sb.AppendLine("Generated $((Get-Date).ToString('yyyy-MM-dd HH:mm')) by scripts/Write-BranchStatus.ps1. Do not edit; it is rewritten at every session start.")
[void]$sb.AppendLine("Compared against $baseRef at $mainTip (the version both of you ship from).")
if ($fetchNote) { [void]$sb.AppendLine(); [void]$sb.AppendLine("> $fetchNote") }
[void]$sb.AppendLine()
if ($rows.Count -eq 0) {
  [void]$sb.AppendLine('No branches in progress.')
} else {
  [void]$sb.AppendLine('| Branch | State | Owner | Ahead / behind main | Folder | What it means |')
  [void]$sb.AppendLine('| --- | --- | --- | --- | --- | --- |')
  foreach ($r in $rows) {
    $folder = if ($r.Folder) { "``$($r.Folder)``" } else { 'none' }
    [void]$sb.AppendLine("| ``$($r.Branch)`` | $($r.State) | $($r.Owner) | $($r.Ahead) / $($r.Behind) | $folder | $($r.Meaning) |")
  }
}
[void]$sb.AppendLine()
if ($hiddenOthers -gt 0) { [void]$sb.AppendLine("$hiddenOthers branch(es) on GitHub by people outside the team (mostly inherited from upstream) are not listed."); [void]$sb.AppendLine() }
if ($hiddenOld -gt 0) { [void]$sb.AppendLine("$hiddenOld older branch(es) that exist only on GitHub (no activity for more than $RecentDays days) are not listed."); [void]$sb.AppendLine() }
[void]$sb.AppendLine('States: uncommitted (unsaved changes), behind (main moved on), stale (idle), new (no commits yet), ready, merged (done). A branch squash-merged on GitHub can still show as ready until it is deleted.')

New-Item -ItemType Directory -Path (Split-Path -Parent $OutFile) -Force | Out-Null
[IO.File]::WriteAllText($OutFile, $sb.ToString(), [Text.UTF8Encoding]::new($false))

$counts = $rows | Group-Object State | ForEach-Object { "$($_.Count) $($_.Name)" }
$summary = if ($rows.Count -eq 0) { 'no branches in progress' } else { "$($rows.Count) branch(es): $($counts -join ', ')" }
Write-Host "[branch-status] $summary. Details: $OutFile"
if ($PassThru) { $rows }
