<#
.SYNOPSIS
  Safe source sync for the session-start hook: fetch origin and fast-forward main only.
.DESCRIPTION
  Replaces the old `git pull --rebase --autostash` that could recreate a rebase or
  clobber another session's work. This helper never rebases, never autostashes, never
  resets and never merges divergent history. It only fast-forwards a clean `main`
  checkout that is strictly behind the remote, and only after checking for an in-progress
  git operation and a dirty work tree both before and after the fetch. Anything else is
  reported and skipped so the session can start without touching the work tree.
  Prints one [source-sync] line. Pass -PassThru to also return a result object whose
  Status is one of: synced, up-to-date, ahead, diverged, dirty, in-progress, not-main,
  not-a-repo, fetch-failed, state-changed.
#>
[CmdletBinding()]
param(
  # Directory to sync. Defaults to the repository this script lives in (parent of scripts/).
  [string]$RepoPath,
  [string]$Remote = 'origin',
  [string]$Branch = 'main',
  # Return the result object in addition to printing the status line.
  [switch]$PassThru
)
$ErrorActionPreference = 'Stop'
# Let native git exit codes be inspected instead of throwing.
if (Test-Path Variable:PSNativeCommandUseErrorActionPreference) { $PSNativeCommandUseErrorActionPreference = $false }

$root = if ($RepoPath) { (Resolve-Path -LiteralPath $RepoPath).Path } else { Split-Path -Parent $PSScriptRoot }
$remoteRef = "$Remote/$Branch"
$script:Result = $null

function Set-Result {
  param([string]$Status, [string]$Message, [string]$Error, [string]$Before, [string]$After)
  Write-Host "[source-sync] $Message"
  $script:Result = [pscustomobject]@{
    Status  = $Status
    Message = $Message
    Error   = $Error
    Branch  = $null
    Before  = $Before
    After   = $After
    Repo    = $root
  }
}

function Get-GitDir {
  $raw = (& git -C $root rev-parse --git-dir 2>$null)
  if ($LASTEXITCODE -ne 0 -or -not $raw) { return $null }
  $raw = ([string]$raw).Trim()
  if ([IO.Path]::IsPathRooted($raw)) { return $raw }
  return (Join-Path $root $raw)
}

# Any of these markers means another git operation owns the index/HEAD right now.
function Get-ActiveOperation {
  param([string]$GitDir)
  if (-not $GitDir) { return $null }
  $markers = [ordered]@{
    rebase        = @('rebase-merge', 'rebase-apply')
    merge         = @('MERGE_HEAD')
    'cherry-pick' = @('CHERRY_PICK_HEAD')
    revert        = @('REVERT_HEAD')
    sequencer     = @('sequencer')
    bisect        = @('BISECT_LOG')
  }
  foreach ($operation in $markers.Keys) {
    foreach ($marker in $markers[$operation]) {
      if (Test-Path -LiteralPath (Join-Path $GitDir $marker)) { return $operation }
    }
  }
  return $null
}

# Tracked and untracked changes both make the work tree unsafe to fast-forward into.
function Test-Dirty {
  $porcelain = (& git -C $root status --porcelain --untracked-files=normal 2>$null)
  if ($LASTEXITCODE -ne 0) { return $true }
  return [bool]($porcelain | Where-Object { $_ -and $_.Trim() })
}

# Returns a skip-status string when syncing is unsafe, otherwise $null.
function Test-SyncSafe {
  $gitDir = Get-GitDir
  if (-not $gitDir) { return 'not-a-repo' }
  $operation = Get-ActiveOperation -GitDir $gitDir
  if ($operation) { return "in-progress:$operation" }
  if (Test-Dirty) { return 'dirty' }
  $current = ([string](& git -C $root rev-parse --abbrev-ref HEAD 2>$null)).Trim()
  if ($LASTEXITCODE -ne 0) { return 'not-a-repo' }
  if ($current -ne $Branch) { return "not-main:$current" }
  return $null
}

function Invoke-Sync {
  if (-not (Get-GitDir)) {
    Set-Result 'not-a-repo' "Not a git repository: $root"
    return
  }

  # All guards run before the fetch so unsafe state never reaches the network.
  $guard = Test-SyncSafe
  if ($guard) {
    switch -Regex ($guard) {
      '^not-a-repo$'  { Set-Result 'not-a-repo' "Not a git repository: $root"; return }
      '^in-progress:' { Set-Result 'in-progress' "Skipped: a $($guard.Substring(12)) operation is already in progress. Resolve it first."; return }
      '^dirty$'       { Set-Result 'dirty' 'Skipped: tracked or untracked changes are present. Commit or stash them yourself; this helper never stashes.'; return }
      '^not-main:'    { Set-Result 'not-main' "Skipped: currently on '$($guard.Substring(9))', not '$Branch'. Sync only runs on $Branch."; return }
    }
  }

  $before = ([string](& git -C $root rev-parse HEAD 2>$null)).Trim()

  # The only network operation. Failures are reported, never thrown, so the session still starts.
  $fetchOutput = (& git -C $root fetch --no-tags $Remote $Branch 2>&1)
  if ($LASTEXITCODE -ne 0) {
    $detail = (($fetchOutput | Out-String).Trim())
    Set-Result 'fetch-failed' "Fetch of $remoteRef failed; the work tree is unchanged. $detail" -Error $detail -Before $before
    return
  }

  # Recheck after the fetch so work that landed in this window is not clobbered.
  $guardAfter = Test-SyncSafe
  $headAfterFetch = ([string](& git -C $root rev-parse HEAD 2>$null)).Trim()
  if ($guardAfter -or $LASTEXITCODE -ne 0 -or $headAfterFetch -ne $before) {
    Set-Result 'state-changed' "State changed during fetch ($guardAfter). Skipped to avoid clobbering concurrent work." -Before $before
    return
  }

  if (-not (& git -C $root rev-parse --verify --quiet "refs/remotes/$remoteRef" 2>$null)) {
    Set-Result 'fetch-failed' "Remote-tracking ref refs/remotes/$remoteRef is missing after fetch." -Before $before
    return
  }

  $counts = ([string](& git -C $root rev-list --left-right --count "$remoteRef...HEAD" 2>$null)).Trim() -split '\s+'
  if ($LASTEXITCODE -ne 0 -or $counts.Count -ne 2 -or $counts[0] -notmatch '^\d+$' -or $counts[1] -notmatch '^\d+$') {
    Set-Result 'state-changed' 'Could not compare local and remote history; skipped safely.' -Before $before
    return
  }
  $behind = [int]$counts[0]
  $ahead = [int]$counts[1]

  if ($behind -eq 0 -and $ahead -eq 0) {
    Set-Result 'up-to-date' "Already up to date with $remoteRef." -Before $before -After $before
    return
  }
  if ($ahead -gt 0 -and $behind -eq 0) {
    Set-Result 'ahead' "Local $Branch has $ahead commit(s) not on $remoteRef; keeping them. Push when ready." -Before $before -After $before
    return
  }
  if ($ahead -gt 0 -and $behind -gt 0) {
    Set-Result 'diverged' "Local $Branch and $remoteRef have diverged ($ahead ahead, $behind behind). Skipped; never rebasing or auto-merging." -Before $before -After $before
    return
  }

  # Strictly behind: fast-forward only. `--ff-only` refuses any non-fast-forward case.
  $mergeOutput = (& git -C $root -c merge.autoStash=false merge --ff-only --no-overwrite-ignore "$remoteRef" 2>&1)
  if ($LASTEXITCODE -ne 0) {
    Set-Result 'diverged' "Fast-forward of $remoteRef was refused; nothing was merged. $(($mergeOutput | Out-String).Trim())" -Error (($mergeOutput | Out-String).Trim()) -Before $before -After $before
    return
  }
  $after = ([string](& git -C $root rev-parse HEAD 2>$null)).Trim()
  $short = $after.Substring(0, [Math]::Min(12, $after.Length))
  Set-Result 'synced' "Fast-forwarded $Branch by $behind commit(s) to $short." -Before $before -After $after
}

Invoke-Sync
if ($PassThru -and $script:Result) { $script:Result }
