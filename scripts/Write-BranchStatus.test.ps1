$ErrorActionPreference = 'Stop'
if (Test-Path Variable:PSNativeCommandUseErrorActionPreference) { $PSNativeCommandUseErrorActionPreference = $false }

$Script = Join-Path $PSScriptRoot 'Write-BranchStatus.ps1'
$Root = Join-Path $env:TEMP ("leonidas-branch-status-test-" + [Guid]::NewGuid().ToString('N'))

function Assert-Equal {
  param($Actual, $Expected, [string]$Label)
  if ($Actual -ne $Expected) { throw "FAIL [$Label]: expected '$Expected', got '$Actual'" }
}
# --template= keeps a machine-wide git template (hooks) out of the fixture repos.
function Invoke-TestGit {
  param([string]$Repo, [string[]]$GitArgs)
  $null = & git -C $Repo @GitArgs 2>&1
  if ($LASTEXITCODE -ne 0) { throw "git $($GitArgs -join ' ') failed in $Repo" }
}
function Add-Commit {
  param([string]$Repo, [string]$File, [string]$Message, [string]$Date)
  Set-Content -LiteralPath (Join-Path $Repo $File) -Value $Message
  Invoke-TestGit $Repo @('add', '--', $File)
  if ($Date) { $env:GIT_COMMITTER_DATE = $Date; $env:GIT_AUTHOR_DATE = $Date }
  Invoke-TestGit $Repo @('commit', '-q', '-m', $Message)
  Remove-Item Env:GIT_COMMITTER_DATE, Env:GIT_AUTHOR_DATE -ErrorAction SilentlyContinue
}

try {
  New-Item -ItemType Directory -Path $Root -Force | Out-Null
  $origin = Join-Path $Root 'origin.git'
  $work = Join-Path $Root 'work'
  Invoke-TestGit $Root @('init', '--bare', '-q', '--template=', '-b', 'main', $origin)
  Invoke-TestGit $Root @('clone', '-q', '--template=', $origin, $work)
  foreach ($kv in @('user.email=fixture@example.com', 'user.name=Fixture', 'commit.gpgsign=false', 'core.autocrlf=false')) {
    $k, $v = $kv -split '=', 2
    Invoke-TestGit $work @('config', $k, $v)
  }
  Add-Commit $work 'base.txt' 'base'
  Invoke-TestGit $work @('branch', '-M', 'main')
  Invoke-TestGit $work @('push', '-q', '-u', 'origin', 'main')

  # behind: branched from the base, then main moved on.
  Invoke-TestGit $work @('checkout', '-q', '-b', 'feature/behind', 'main')
  Add-Commit $work 'behind.txt' 'behind work'
  Invoke-TestGit $work @('push', '-q', 'origin', 'feature/behind')

  # merged: fully contained in main after the next main commit.
  Invoke-TestGit $work @('checkout', '-q', '-b', 'feature/merged', 'main')
  Add-Commit $work 'merged.txt' 'merged work'
  Invoke-TestGit $work @('checkout', '-q', 'main')
  Invoke-TestGit $work @('merge', '-q', '--no-ff', '-m', 'merge feature/merged', 'feature/merged')
  Add-Commit $work 'main2.txt' 'main moves on'
  Invoke-TestGit $work @('push', '-q', 'origin', 'main')

  # ready: one commit on top of the current main, pushed.
  Invoke-TestGit $work @('checkout', '-q', '-b', 'feature/ready', 'main')
  Add-Commit $work 'ready.txt' 'ready work'
  Invoke-TestGit $work @('push', '-q', 'origin', 'feature/ready')

  # stale: last commit weeks old.
  Invoke-TestGit $work @('checkout', '-q', '-b', 'feature/stale', 'main')
  Add-Commit $work 'stale.txt' 'old work' '2020-01-01T00:00:00'
  Invoke-TestGit $work @('push', '-q', 'origin', 'feature/stale')

  # new: created from main with nothing on it yet.
  Invoke-TestGit $work @('branch', 'feature/fresh', 'main')

  # uncommitted: checked out in its own worktree with a loose file.
  Invoke-TestGit $work @('checkout', '-q', 'main')
  $wt = Join-Path $Root 'wt-dirty'
  Invoke-TestGit $work @('worktree', 'add', '-q', '-b', 'feature/dirty', $wt, 'main')
  Add-Commit $wt 'dirty.txt' 'dirty work'
  Set-Content -LiteralPath (Join-Path $wt 'loose.txt') -Value 'unsaved'

  $out = Join-Path $Root 'status.md'
  $rows = & $Script -RepoPath $work -OutFile $out -NoFetch -PassThru 6>$null
  $by = @{}
  foreach ($r in $rows) { $by[$r.Branch] = $r }

  Assert-Equal $by['feature/ready'].State 'ready' 'ready state'
  Assert-Equal $by['feature/ready'].Ahead 1 'ready ahead'
  Assert-Equal $by['feature/behind'].State 'behind' 'behind state'
  Assert-Equal $by['feature/behind'].Behind 3 'behind count'
  Assert-Equal $by['feature/merged'].State 'merged' 'merged state'
  Assert-Equal $by['feature/stale'].State 'stale' 'stale state'
  Assert-Equal $by['feature/fresh'].State 'new' 'branch with no commits is new, not merged'
  Assert-Equal $by['feature/dirty'].State 'uncommitted' 'dirty state'
  Assert-Equal $by['feature/dirty'].Unsaved 1 'dirty count'
  Assert-Equal $by['feature/dirty'].Unpushed 1 'dirty unpushed'
  Assert-Equal $by['feature/ready'].Unpushed 0 'pushed branch has nothing unpushed'
  Assert-Equal ($by.ContainsKey('main')) $false 'main is not listed'

  # Ordering puts work that needs attention first and finished work last.
  Assert-Equal $rows[0].State 'uncommitted' 'first row'
  Assert-Equal $rows[-1].State 'merged' 'last row'

  $text = Get-Content -LiteralPath $out -Raw
  if ($text -notmatch 'feature/dirty') { throw 'FAIL [markdown lists branches]' }
  if ($text -notmatch 'Do not edit') { throw 'FAIL [markdown header]' }

  # The status file must never leave a repo dirty.
  Assert-Equal (@(& git -C $work status --porcelain | Where-Object { $_ }).Count) 0 'main checkout stays clean'
  # Default location is inside the shared .git directory.
  $null = & $Script -RepoPath $work -NoFetch 6>$null
  if (-not (Test-Path -LiteralPath (Join-Path $work '.git/leonidas/branch-status.md'))) { throw 'FAIL [default output path]' }

  Write-Host 'Write-BranchStatus: all checks passed'
} finally {
  if (Test-Path -LiteralPath $Root) { Remove-Item -LiteralPath $Root -Recurse -Force -ErrorAction SilentlyContinue }
}
