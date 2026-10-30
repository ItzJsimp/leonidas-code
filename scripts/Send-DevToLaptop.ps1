<#
.SYNOPSIS
  Sends this machine's work-in-progress branches to the laptop by git bundle, so the laptop dev
  app builds the same `dev` branch. Private: nothing goes to GitHub. Runs every minute from the
  "Leonidas Dev Laptop Sync" scheduled task (see Install-LaptopSyncTask.ps1).

.DESCRIPTION
  Picks the same branches Update-DevBranch.ps1 merges (recent, ahead of origin/main, not skipped).
  Does nothing when none changed since the last good send, or when the laptop is not reachable.
  Covers committed work only. Uncommitted edits and files outside this repo (AIOS skills) do not travel.
  The laptop keeps a branch it changed itself; see Receive-DevBundle.ps1.
#>
[CmdletBinding()]
param(
    [string]$Laptop = 'jakeslaptop',
    [int]$MaxAgeDays = 21,
    [switch]$Force
)
$ErrorActionPreference = 'Stop'
$common = (git -C $PSScriptRoot rev-parse --path-format=absolute --git-common-dir).Trim()
$repo = Split-Path -Parent $common
$sigFile = Join-Path $common 'leonidas-laptop-sync.txt'
$logFile = Join-Path $common 'leonidas-laptop-sync.log'
function Write-SyncLog([string]$Text) {
    Add-Content -LiteralPath $logFile -Value "$(Get-Date -Format s) $Text"
    $tail = @(Get-Content -LiteralPath $logFile -Tail 200)
    Set-Content -LiteralPath $logFile -Value $tail
}

# Same branch filter as Update-DevBranch.ps1.
$extra = @(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'dev-branch-exclude.txt') -ErrorAction SilentlyContinue |
        Where-Object { $_ -and $_ -notmatch '^\s*#' })
$skip = (@('^(dev|rebase/|backup/|snapshot/|upstream-review/|archive/)') + $extra) -join '|'
$base = (git -C $repo rev-parse --verify -q origin/main).Trim()
$cutoff = (Get-Date).AddDays(-$MaxAgeDays)
$sources = @(foreach ($line in (git -C $repo for-each-ref refs/heads --format='%(refname:short)|%(objectname)|%(committerdate:iso-strict)')) {
        $name, $sha, $date = $line -split '\|', 3
        if ($name -match $skip -or [datetime]$date -lt $cutoff) { continue }
        if ($name -ne 'main' -and [int](git -C $repo rev-list --count "$base..$sha") -eq 0) { continue }
        [pscustomobject]@{ Name = $name; Sha = $sha }
    })
if ($sources.Count -eq 0) { return }
$signature = ($sources | ForEach-Object { "$($_.Name)=$($_.Sha)" }) -join "`n"
if (-not $Force -and (Test-Path -LiteralPath $sigFile) -and ((Get-Content -LiteralPath $sigFile -Raw) -eq $signature)) { return }

$sshOptions = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10')
$remoteDir = 'C:/lcw/dev-sync'
$receiver = "powershell -NoProfile -ExecutionPolicy Bypass -File $remoteDir/Receive-DevBundle.ps1"
$bundle = Join-Path ([IO.Path]::GetTempPath()) 'leonidas-dev-sync.bundle'
try {
    & ssh @sshOptions $Laptop "powershell -NoProfile -Command New-Item -ItemType Directory -Force $remoteDir" *> $null
    if ($LASTEXITCODE -ne 0) { return }   # laptop asleep or off the network: try again next minute
    & scp -q @sshOptions (Join-Path $PSScriptRoot 'Receive-DevBundle.ps1') "${Laptop}:$remoteDir/Receive-DevBundle.ps1"
    if ($LASTEXITCODE -ne 0) { Write-SyncLog 'could not copy the receiver'; return }

    # The bundle leaves out every commit the laptop already holds, so it stays small.
    $held = @(& ssh @sshOptions $Laptop "$receiver -Mode List" | Where-Object { $_ -match '^[0-9a-f]{40}$' })
    $known = @($held | git -C $repo cat-file --batch-check='%(objectname) %(objecttype)' | Where-Object { $_ -match ' commit$' } |
            ForEach-Object { $_.Split(' ')[0] })
    $spec = @($sources | ForEach-Object { "refs/heads/$($_.Name)" }) + @($known | ForEach-Object { "^$_" })
    $spec | git -C $repo bundle create $bundle --stdin 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-SyncLog 'bundle not created: the laptop already holds every commit'
        Set-Content -LiteralPath $sigFile -Value $signature -NoNewline
        return
    }

    & scp -q @sshOptions $bundle "${Laptop}:$remoteDir/in.bundle"
    if ($LASTEXITCODE -ne 0) { Write-SyncLog 'could not copy the bundle'; return }
    $result = @(& ssh @sshOptions $Laptop "$receiver -Mode Apply")
    if ($LASTEXITCODE -ne 0) { Write-SyncLog "laptop refused the bundle: $($result -join ' ')"; return }
    Set-Content -LiteralPath $sigFile -Value $signature -NoNewline
    Write-SyncLog "sent $($sources.Count) branches: $($result -join '; ')"
} catch {
    Write-SyncLog "failed: $($_.Exception.Message)"
} finally {
    Remove-Item -LiteralPath $bundle -Force -ErrorAction SilentlyContinue
}
