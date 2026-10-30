<#
.SYNOPSIS
  Mirrors files from this machine to the laptop over SSH: AIOS files, unsaved edits in the Leonidas
  Code checkout, and Claude skills. Phase 1: one way, desktop to laptop. Run -DryRun first.

.DESCRIPTION
  Config (JSON, kept outside the repo because it holds personal paths):
    { "roots": [ { "name": "aios", "desktop": "D:/AIOS", "laptop": "D:/AIOS", "mode": "git",
                   "deny": ["^projects/", "^logs/"] },
                 { "name": "skills", "desktop": "C:/Users/me/.claude-x/skills",
                   "laptop": "C:/Users/me/.claude/skills", "mode": "dir" } ] }
  mode "git" mirrors the files git knows (tracked, or new and not ignored). mode "dir" mirrors a whole folder.
  Per file it compares desktop, laptop and the state after the last tick (see Get-MirrorPlan).
  A laptop edit is never overwritten. When both sides changed, the laptop file is saved aside as
  <name>.conflict-laptop-<time>. For a git root the laptop git head then follows the desktop head
  (only forward; files stay as they are).
  Safety stops: more than -MaxDeletes (50) deletions or more than 500 MB in one tick stop that root.
  shortcut: tar names must be plain text and empty folders stay behind, until someone needs more.
#>
[CmdletBinding()]
param(
    [string]$Config,
    [string]$StateDir,
    [string]$Laptop = 'jakeslaptop',
    [string]$RemoteDir = 'C:/lcw/dev-sync/mirror',
    [switch]$DryRun,
    [switch]$Local,            # test mode: the "laptop" is this machine, see Mirror-Files.test.ps1
    [int]$QuietSeconds = 2,
    [int]$MaxDeletes = 50,     # raise it once, after reading a dry run, for the first sync of a stale laptop copy
    [int]$LoopSeconds = 0,     # 0 = one tick. The scheduled task starts this script every minute.
    [int]$IntervalSeconds = 10,
    [int]$Show = 15            # how many files each list prints in a dry run
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Mirror-Files.lib.ps1')

$common = (git -C $PSScriptRoot rev-parse --path-format=absolute --git-common-dir).Trim()
if (-not $Config) { $Config = Join-Path $common 'leonidas-mirror-roots.json' }
if (-not $StateDir) { $StateDir = Join-Path $common 'leonidas-mirror' }
$stage = Join-Path $StateDir 'stage'
$logFile = Join-Path $StateDir 'mirror.log'
New-Item -ItemType Directory -Force -Path $stage | Out-Null
$maxBytes = 500MB

function Write-MirrorLog([string]$Text) {
    Write-Host $Text
    Add-Content -LiteralPath $logFile -Value "$(Get-Date -Format s) $Text"
    $tail = @(Get-Content -LiteralPath $logFile -Tail 300)
    Set-Content -LiteralPath $logFile -Value $tail
}

# Transport. SSH in real use; plain file copies in test mode.
function Find-Tool([string]$Name) {
    $found = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { return $found.Source }
    foreach ($dir in 'C:/Windows/System32/OpenSSH', 'C:/Program Files/Git/usr/bin') {
        if (Test-Path -LiteralPath "$dir/$Name.exe") { return "$dir/$Name.exe" }
    }
    throw "$Name not found"
}
if (-not $Local) { $ssh = Find-Tool 'ssh'; $scp = Find-Tool 'scp' }
$sshOptions = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10')
function Copy-ToLaptop([string]$From, [string]$To) {
    if ($Local) { New-Item -ItemType Directory -Force -Path (Split-Path -Parent $To) | Out-Null; Copy-Item -LiteralPath $From -Destination $To -Force; return }
    & $scp -q @sshOptions $From "${Laptop}:$To"
    if ($LASTEXITCODE -ne 0) { throw "scp to laptop failed: $To" }
}
function Copy-FromLaptop([string]$From, [string]$To) {
    if ($Local) { Copy-Item -LiteralPath $From -Destination $To -Force; return }
    & $scp -q @sshOptions "${Laptop}:$From" $To
    if ($LASTEXITCODE -ne 0) { throw "scp from laptop failed: $From" }
}
function Invoke-Receiver([string]$Mode, [string]$Name) {
    $line = "-Mode $Mode -Request $RemoteDir/$Name-req.json -Output $RemoteDir/$Name-out.json"
    if ($Local) {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'Receive-Mirror.ps1') -Mode $Mode -Request "$RemoteDir/$Name-req.json" -Output "$RemoteDir/$Name-out.json" | Out-Null
    } else {
        & $ssh @sshOptions $Laptop "powershell -NoProfile -ExecutionPolicy Bypass -File $RemoteDir/Receive-Mirror.ps1 $line" | Out-Null
    }
    if ($LASTEXITCODE -ne 0) { throw "receiver $Mode failed" }
}
# Sends a request file, runs the receiver, brings the answer back.
function Invoke-Remote([string]$Mode, [string]$Name, $Request) {
    Write-MirrorJson "$stage/$Name-req.json" $Request
    Copy-ToLaptop "$stage/$Name-req.json" "$RemoteDir/$Name-req.json"
    Invoke-Receiver $Mode $Name
    Copy-FromLaptop "$RemoteDir/$Name-out.json" "$stage/$Name-out.json"
    return (Read-MirrorJson "$stage/$Name-out.json")
}

function Sync-MirrorHead($Root, $Answer) {
    $headFile = Join-Path $StateDir "head-$($Root.name).txt"
    $desktopHead = "$(git -C $Root.desktop rev-parse -q --verify HEAD)".Trim()
    $branch = "$(git -C $Root.desktop symbolic-ref --short -q HEAD)".Trim()
    if (-not $desktopHead -or $desktopHead -eq $Answer.Head) { return }
    if ($branch -ne $Answer.Branch) { Write-MirrorLog "$($Root.name): git branches differ (desktop '$branch', laptop '$($Answer.Branch)'); head not moved"; return }
    $attempt = "$desktopHead|$($Answer.Head)"
    if ((Test-Path -LiteralPath $headFile) -and ((Get-Content -LiteralPath $headFile -Raw).Trim() -eq $attempt) -and
        ((Get-Date) - (Get-Item -LiteralPath $headFile).LastWriteTime).TotalMinutes -lt 5) { return }
    Set-Content -LiteralPath $headFile -Value $attempt

    # Last committer wins. A laptop head that the desktop lacks is replaced only when it is older than the desktop head.
    git -C $Root.desktop cat-file -e "$($Answer.Head)^{commit}" 2>$null
    $force = $false
    if ($LASTEXITCODE -ne 0) {
        $desktopTime = [long]"$(git -C $Root.desktop log -1 --format=%ct)".Trim()
        if ([long]$Answer.HeadTime -gt $desktopTime) { Write-MirrorLog "$($Root.name): the laptop commit is newer than the desktop head; waiting for phase 2"; return }
        $force = $true
    }
    # The bundle leaves out every commit the laptop already holds and the desktop knows.
    $known = @(@($Answer.Known) | Where-Object { $_ } | git -C $Root.desktop cat-file --batch-check='%(objectname) %(objecttype)' |
            Where-Object { $_ -match ' commit$' } | ForEach-Object { $_.Split(' ')[0] })
    $bundle = Join-Path $stage "head-$($Root.name).bundle"
    (@('HEAD') + @($known | ForEach-Object { "^$_" })) | git -C $Root.desktop bundle create $bundle --stdin 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-MirrorLog "$($Root.name): head bundle not created"; return }
    Copy-ToLaptop $bundle "$RemoteDir/head-$($Root.name).bundle"
    $backup = "laptop/$branch-$(([string]$Answer.Head).Substring(0, 8))"
    $result = Invoke-Remote 'Head' "head-$($Root.name)" @{ Root = $Root.laptop; Sha = $desktopHead; Bundle = "$RemoteDir/head-$($Root.name).bundle"; Force = $force; Backup = $backup }
    Write-MirrorLog "$($Root.name): git head $($result.Message)"
    Remove-Item -LiteralPath $bundle -Force -ErrorAction SilentlyContinue
}

function Invoke-MirrorRoot($Root, $Answer) {
    $name = $Root.name
    $baselinePath = Join-Path $StateDir "baseline-$name.json"
    $haveBaseline = Test-Path -LiteralPath $baselinePath
    $remote = ConvertTo-MirrorMap $Answer.Files
    # First run on a git root whose laptop copy is clean: every difference is a desktop change, not a laptop edit.
    $baseline = if ($haveBaseline) { ConvertTo-MirrorMap (Read-MirrorJson $baselinePath) }
    elseif ($Root.mode -eq 'git' -and $Answer.Clean) { $remote.Clone() } else { @{} }
    $deny = @($Root.deny)
    $desktop = Get-MirrorManifest -Root $Root.desktop -Mode $Root.mode -Deny $deny -CachePath (Join-Path $StateDir "cache-$name.json")
    $plan = Get-MirrorPlan -Desktop $desktop -Remote $remote -Baseline $baseline -QuietSeconds $QuietSeconds

    $bytes = 0L
    foreach ($p in $plan.Push) { $bytes += (Get-Item -LiteralPath (Join-Path $Root.desktop $p)).Length }
    $summary = "$name`: push $($plan.Push.Count), delete $($plan.Delete.Count), conflict copies $($plan.Aside.Count), laptop edits kept $($plan.Held), skipped (still being written) $($plan.Unstable)"
    $tooMuch = $plan.Delete.Count -gt $MaxDeletes -or $bytes -gt $maxBytes
    if ($DryRun) {
        $note = if ($tooMuch) { ' WOULD STOP: raise -MaxDeletes to allow it' } else { '' }
        Write-MirrorLog "$summary (dry run, nothing copied).$note"
        foreach ($p in ($plan.Push | Select-Object -First $Show)) { Write-Host "  push   $p" }
        foreach ($p in ($plan.Delete | Select-Object -First $Show)) { Write-Host "  delete $p" }
        foreach ($p in ($plan.Aside | Select-Object -First $Show)) { Write-Host "  aside  $p" }
        return
    }
    if ($tooMuch) { Write-MirrorLog "$summary. STOPPED: more than $MaxDeletes deletions or more than 500 MB in one tick"; return }

    $failed = @()
    if ($plan.Push.Count -or $plan.Delete.Count -or $plan.Aside.Count) {
        $tar = ''
        if ($plan.Push.Count) {
            $list = Join-Path $stage "$name-files.txt"
            $tar = Join-Path $stage "$name.tar"
            Remove-Item -LiteralPath $tar -Force -ErrorAction SilentlyContinue
            [IO.File]::WriteAllText($list, (($plan.Push -join "`n") + "`n"))
            & $tarExe -cf $tar -C $Root.desktop -T $list
            if ($LASTEXITCODE -ne 0) { throw "tar failed for $name" }
            Copy-ToLaptop $tar "$RemoteDir/$name.tar"
        }
        $applied = Invoke-Remote 'Apply' "apply-$name" @{
            Root = $Root.laptop; Tar = $(if ($tar) { "$RemoteDir/$name.tar" } else { '' })
            Push = @($plan.Push); Delete = @($plan.Delete); Aside = @($plan.Aside); Stamp = (Get-Date -Format 'yyyyMMdd-HHmmss')
        }
        $failed = @($applied.Failed)
    }

    # The baseline moves only for files that arrived. A failed file is tried again next tick.
    $next = $baseline.Clone()
    foreach ($p in $plan.Settled.Keys) { if ($plan.Settled[$p]) { $next[$p] = $plan.Settled[$p] } else { $next.Remove($p) } }
    foreach ($p in $plan.Push) { if ($failed -notcontains $p) { $next[$p] = $desktop[$p].Hash } }
    foreach ($p in $plan.Delete) { if ($failed -notcontains $p) { $next.Remove($p) } }
    foreach ($p in $plan.Aside) { if ($failed -notcontains $p -and -not $desktop.ContainsKey($p)) { $next.Remove($p) } }
    Write-MirrorJson $baselinePath $next
    if ($plan.Push.Count -or $plan.Delete.Count -or $plan.Aside.Count -or $plan.Unstable -or $failed.Count) { Write-MirrorLog "$summary, failed $($failed.Count)" }
    if ($Root.mode -eq 'git' -and $failed.Count -eq 0) { Sync-MirrorHead $Root $Answer }
}

function Invoke-MirrorTick {
    $roots = @((Read-MirrorJson $Config).roots)
    $request = @{ Roots = @(foreach ($r in $roots) {
                @{ Name = $r.name; Root = $r.laptop; Mode = $r.mode; Deny = @($r.deny); Cache = "$RemoteDir/cache-$($r.name).json"
                   IsGit = ($r.mode -eq 'git'); NeedClean = -not (Test-Path -LiteralPath (Join-Path $StateDir "baseline-$($r.name).json")) }
            }) }
    $manifest = Invoke-Remote 'Manifest' 'manifest' $request
    foreach ($r in $roots) {
        try { Invoke-MirrorRoot $r $manifest.PSObject.Properties[$r.name].Value }
        catch { Write-MirrorLog "$($r.name): failed: $($_.Exception.Message)" }
    }
}

$mutex = New-Object System.Threading.Mutex($false, 'Global\LeonidasMirrorFiles')
if (-not $mutex.WaitOne(0)) { return }
try {
    # The receiver and its library go to the laptop first, so a script update reaches it without a manual step.
    if (-not $Local) {
        & $ssh @sshOptions $Laptop "powershell -NoProfile -Command New-Item -ItemType Directory -Force $RemoteDir" *> $null
        if ($LASTEXITCODE -ne 0) { return }   # laptop asleep or off the network: try again next minute
    }
    foreach ($f in 'Receive-Mirror.ps1', 'Mirror-Files.lib.ps1') { Copy-ToLaptop (Join-Path $PSScriptRoot $f) "$RemoteDir/$f" }
    $deadline = (Get-Date).AddSeconds($LoopSeconds)
    do {
        try { Invoke-MirrorTick } catch { Write-MirrorLog "tick failed: $($_.Exception.Message)" }
        if ((Get-Date).AddSeconds($IntervalSeconds) -gt $deadline) { break }
        Start-Sleep -Seconds $IntervalSeconds
    } while ($true)
} finally { $mutex.ReleaseMutex() }
