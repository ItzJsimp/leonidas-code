$ErrorActionPreference = 'Stop'
if (Test-Path Variable:PSNativeCommandUseErrorActionPreference) { $PSNativeCommandUseErrorActionPreference = $false }

$Script = Join-Path $PSScriptRoot 'Sync-LeonidasSource.ps1'
$Root = Join-Path $env:TEMP ("leonidas-source-sync-test-" + [Guid]::NewGuid().ToString('N'))

function Assert-Equal {
  param($Actual, $Expected, [string]$Label)
  if ($Actual -ne $Expected) { throw "FAIL [$Label]: expected '$Expected', got '$Actual'" }
}
function Assert-True {
  param($Condition, [string]$Label)
  if (-not $Condition) { throw "FAIL [$Label]" }
}
function Get-Sha {
  param([string]$Repo)
  return ([string](& git -C $Repo rev-parse HEAD)).Trim()
}
function Add-Commit {
  param([string]$Repo, [string]$File, [string]$Content, [string]$Message)
  Set-Content -LiteralPath (Join-Path $Repo $File) -Value $Content
  & git -C $Repo add -- $File | Out-Null
  & git -C $Repo commit -q -m $Message | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "fixture commit failed: $Message" }
}

# Bare origin plus a clean working clone on main, one base commit each.
function Initialize-Repo {
  param([string]$Name)
  $dir = Join-Path $Root $Name
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  $origin = Join-Path $dir 'origin.git'
  $work = Join-Path $dir 'work'
  & git init --bare -q -b main $origin | Out-Null
  & git clone -q $origin $work 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "fixture clone failed: $Name" }
  & git -C $work config user.email 'fixture@example.com' | Out-Null
  & git -C $work config user.name 'Fixture' | Out-Null
  & git -C $work config commit.gpgsign false | Out-Null
  & git -C $work config core.autocrlf false | Out-Null
  Add-Commit $work 'file.txt' 'base' 'base'
  & git -C $work branch -M main | Out-Null
  & git -C $work push -q -u origin main | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "fixture push failed: $Name" }
  return [pscustomobject]@{ Origin = $origin; Work = $work }
}

# Second clone pushes a commit to origin, optionally as a merge commit.
function Push-RemoteCommit {
  param([string]$Origin, [string]$Message, [switch]$MergeCommit)
  $other = Join-Path (Split-Path -Parent $Origin) ("other-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
  & git clone -q $Origin $other 2>$null | Out-Null
  & git -C $other config user.email 'other@example.com' | Out-Null
  & git -C $other config user.name 'Other' | Out-Null
  & git -C $other config commit.gpgsign false | Out-Null
  & git -C $other config core.autocrlf false | Out-Null
  if ($MergeCommit) {
    & git -C $other checkout -q -b feature | Out-Null
    Add-Commit $other 'feature.txt' 'feature' 'feature commit'
    & git -C $other checkout -q main | Out-Null
    Add-Commit $other 'main.txt' 'main' 'main commit'
    & git -C $other merge -q --no-ff -m 'merge feature' feature | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'fixture merge failed' }
  } else {
    Add-Commit $other 'remote.txt' 'remote' $Message
  }
  & git -C $other push -q origin main | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'fixture remote push failed' }
}

try {
  # 1. Already current.
  $fx = Initialize-Repo 'up-to-date'
  $r = & $Script -RepoPath $fx.Work -PassThru
  Assert-Equal $r.Status 'up-to-date' 'up-to-date status'
  Write-Host 'PASS up-to-date is a no-op'

  # 2. Strictly behind: fast-forwards.
  $fx = Initialize-Repo 'behind'
  $before = Get-Sha $fx.Work
  Push-RemoteCommit -Origin $fx.Origin -Message 'remote change'
  $r = & $Script -RepoPath $fx.Work -PassThru
  Assert-Equal $r.Status 'synced' 'behind status'
  $after = Get-Sha $fx.Work
  Assert-True ($after -ne $before) 'behind advanced'
  Assert-Equal $after (([string](& git -C $fx.Work rev-parse origin/main)).Trim()) 'behind equals remote'
  Write-Host 'PASS behind fast-forwards to remote'

  # 3. Behind across a merge commit still fast-forwards.
  $fx = Initialize-Repo 'behind-merge'
  Push-RemoteCommit -Origin $fx.Origin -Message 'ignored' -MergeCommit
  $r = & $Script -RepoPath $fx.Work -PassThru
  Assert-Equal $r.Status 'synced' 'merge status'
  $merges = ([string](& git -C $fx.Work rev-list --merges --count HEAD)).Trim()
  Assert-True ([int]$merges -ge 1) 'merge commit present after sync'
  Write-Host 'PASS behind across a merge commit fast-forwards'

  # 4. Ahead: local commits are retained, nothing rebased.
  $fx = Initialize-Repo 'ahead'
  Add-Commit $fx.Work 'local.txt' 'local' 'local commit'
  $before = Get-Sha $fx.Work
  $r = & $Script -RepoPath $fx.Work -PassThru
  Assert-Equal $r.Status 'ahead' 'ahead status'
  Assert-Equal (Get-Sha $fx.Work) $before 'ahead retained'
  Write-Host 'PASS ahead commits are retained'

  # 5. Diverged: skipped, never auto-merged.
  $fx = Initialize-Repo 'diverged'
  Add-Commit $fx.Work 'local.txt' 'local' 'local commit'
  Push-RemoteCommit -Origin $fx.Origin -Message 'remote change'
  $before = Get-Sha $fx.Work
  $r = & $Script -RepoPath $fx.Work -PassThru
  Assert-Equal $r.Status 'diverged' 'diverged status'
  Assert-Equal (Get-Sha $fx.Work) $before 'diverged unchanged'
  Assert-True (-not (Test-Path -LiteralPath (Join-Path $fx.Work '.git/MERGE_HEAD'))) 'diverged created no merge'
  Write-Host 'PASS diverged history is skipped, not merged'

  # 6. Dirty tracked file: skipped before any fetch.
  $fx = Initialize-Repo 'dirty-tracked'
  $base = Get-Sha $fx.Work
  Push-RemoteCommit -Origin $fx.Origin -Message 'remote change'
  Add-Content -LiteralPath (Join-Path $fx.Work 'file.txt') -Value 'edited'
  $r = & $Script -RepoPath $fx.Work -PassThru
  Assert-Equal $r.Status 'dirty' 'dirty tracked status'
  Assert-Equal (([string](& git -C $fx.Work rev-parse origin/main)).Trim()) $base 'dirty skipped fetch'
  Write-Host 'PASS dirty tracked state is skipped before fetch'

  # 7. Untracked file: skipped before any fetch.
  $fx = Initialize-Repo 'untracked'
  $base = Get-Sha $fx.Work
  Push-RemoteCommit -Origin $fx.Origin -Message 'remote change'
  Set-Content -LiteralPath (Join-Path $fx.Work 'untracked.txt') -Value 'new'
  $r = & $Script -RepoPath $fx.Work -PassThru
  Assert-Equal $r.Status 'dirty' 'untracked status'
  Assert-Equal (([string](& git -C $fx.Work rev-parse origin/main)).Trim()) $base 'untracked skipped fetch'
  Write-Host 'PASS untracked state is skipped before fetch'

  # 8. Merge in progress: skipped.
  $fx = Initialize-Repo 'merge-in-progress'
  Push-RemoteCommit -Origin $fx.Origin -Message 'remote change'
  Set-Content -LiteralPath (Join-Path $fx.Work '.git/MERGE_HEAD') -Value '0000000000000000000000000000000000000000'
  $r = & $Script -RepoPath $fx.Work -PassThru
  Assert-Equal $r.Status 'in-progress' 'merge guard status'
  Write-Host 'PASS an in-progress merge is skipped'

  # 9. Rebase in progress: skipped.
  $fx = Initialize-Repo 'rebase-in-progress'
  Push-RemoteCommit -Origin $fx.Origin -Message 'remote change'
  New-Item -ItemType Directory -Path (Join-Path $fx.Work '.git/rebase-merge') -Force | Out-Null
  $r = & $Script -RepoPath $fx.Work -PassThru
  Assert-Equal $r.Status 'in-progress' 'rebase guard status'
  Write-Host 'PASS an in-progress rebase is skipped'

  # 10. Non-main branch: skipped.
  $fx = Initialize-Repo 'feature-branch'
  Push-RemoteCommit -Origin $fx.Origin -Message 'remote change'
  $before = Get-Sha $fx.Work
  & git -C $fx.Work checkout -q -b feature | Out-Null
  $r = & $Script -RepoPath $fx.Work -PassThru
  Assert-Equal $r.Status 'not-main' 'non-main status'
  Assert-Equal (Get-Sha $fx.Work) $before 'non-main unchanged'
  Write-Host 'PASS a non-main branch is skipped'

  # 11. Fetch failure: reported visibly, work tree untouched.
  $fx = Initialize-Repo 'fetch-failure'
  $before = Get-Sha $fx.Work
  & git -C $fx.Work remote set-url origin (Join-Path $fx.Origin 'missing.git') | Out-Null
  $r = & $Script -RepoPath $fx.Work -PassThru
  Assert-Equal $r.Status 'fetch-failed' 'fetch failure status'
  Assert-True ([bool]$r.Error) 'fetch failure carries an error message'
  Assert-Equal (Get-Sha $fx.Work) $before 'fetch failure unchanged'
  Write-Host 'PASS a failed fetch is reported and changes nothing'

  Write-Host 'All Leonidas source sync checks passed.'
} finally {
  # Only ever remove our own generated fixture: the leaf carries our prefix and the parent is TEMP.
  $leaf = if ($Root) { Split-Path -Leaf $Root } else { '' }
  $parent = if ($Root) { [IO.Path]::GetFullPath((Split-Path -Parent $Root)).TrimEnd('\') } else { '' }
  $temp = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
  if ($Root -and (Test-Path -LiteralPath $Root) -and $leaf -like 'leonidas-source-sync-test-*' -and $parent -eq $temp) {
    try {
      Get-ChildItem -LiteralPath $Root -Recurse -Force -ErrorAction SilentlyContinue |
        ForEach-Object { try { $_.Attributes = 'Normal' } catch { } }
      Remove-Item -LiteralPath $Root -Recurse -Force -ErrorAction Stop
      Write-Host "Cleaned temp fixture $Root"
    } catch {
      Write-Warning "Left temp fixture in place: $Root. $($_.Exception.Message)"
    }
  }
}
