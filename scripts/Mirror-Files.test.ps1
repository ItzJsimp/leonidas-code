$ErrorActionPreference = 'Stop'
# Scenario tests for Mirror-Files.ps1 and Receive-Mirror.ps1. The "laptop" is a second folder (-Local).
# The receiver runs under Windows PowerShell 5.1, like on the laptop.
# Run: pwsh -NoProfile -File scripts/Mirror-Files.test.ps1

function Fail([string]$m) { throw "FAIL: $m" }
function Assert([bool]$c, [string]$m) { if (-not $c) { Fail $m } }
function G([string]$dir) { git -C $dir @args 2>&1 | Out-Null; if ($LASTEXITCODE -ne 0) { Fail "git $($args -join ' ')" } }
function Put([string]$path, [string]$text) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $path) | Out-Null
    [IO.File]::WriteAllText($path, $text)
}
function Text([string]$path) { [IO.File]::ReadAllText($path) }

$root = Join-Path $env:TEMP ("mirror-test-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
$desk = Join-Path $root 'desk'; $lap = Join-Path $root 'lap'
$skillsDesk = Join-Path $root 'skills-desk'; $skillsLap = Join-Path $root 'skills-lap'
$manyDesk = Join-Path $root 'many-desk'; $manyLap = Join-Path $root 'many-lap'
$state = Join-Path $root 'state'; $remote = Join-Path $root 'remote'; $config = Join-Path $root 'roots.json'

New-Item -ItemType Directory -Force -Path $desk | Out-Null
git -C $desk init -q -b main; git -C $desk config core.autocrlf false; git -C $desk config user.name test; git -C $desk config user.email test@example.com
Put "$desk/.gitignore" "ignored.txt`n"
Put "$desk/notes.md" 'one'; Put "$desk/keep.md" 'keep'
G $desk add -A; G $desk commit -q -m base
git clone -q -c core.autocrlf=false $desk $lap
Put "$skillsDesk/same.md" 'desktop version'; Put "$skillsLap/same.md" 'laptop version'; Put "$skillsLap/only-laptop.md" 'mine'
1..60 | ForEach-Object { Put "$manyDesk/f$_.txt" "$_"; Put "$manyLap/f$_.txt" "$_" }
@{ roots = @(
        @{ name = 'aios'; desktop = $desk; laptop = $lap; mode = 'git'; deny = @() },
        @{ name = 'skills'; desktop = $skillsDesk; laptop = $skillsLap; mode = 'dir'; deny = @() },
        @{ name = 'many'; desktop = $manyDesk; laptop = $manyLap; mode = 'dir'; deny = @() }) } |
    ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $config

function Tick([string[]]$Extra = @(), [int]$Quiet = 0) {
    $out = (pwsh -NoProfile -File (Join-Path $PSScriptRoot 'Mirror-Files.ps1') -Local -Config $config -StateDir $state -RemoteDir $remote -QuietSeconds $Quiet @Extra 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) { Fail "tick exited $LASTEXITCODE`n$out" }
    return $out
}

try {
    # 1. Dry run copies nothing. The first real run seeds the baseline and copies only what git knows.
    Put "$desk/notes.md" 'two'; Put "$desk/new.md" 'new'; Put "$desk/ignored.txt" 'x'; Put "$desk/.env" 'SECRET=1'
    Put "$desk/node_modules/p/i.js" 'x'; Put "$desk/.credentials.json" '{}'; Put "$desk/key.pem" 'x'
    $out = Tick @('-DryRun')
    Assert ($out -match 'aios: push 2') "dry run should plan 2 pushes, got: $out"
    Assert (-not (Test-Path "$lap/new.md")) 'dry run copied a file'
    $out = Tick
    Assert ((Text "$lap/notes.md") -eq 'two') "modified tracked file did not arrive, got: $out"
    Assert ((Text "$lap/new.md") -eq 'new') 'new file did not arrive'
    foreach ($never in 'ignored.txt', '.env', 'node_modules/p/i.js', '.credentials.json', 'key.pem') { Assert (-not (Test-Path "$lap/$never")) "$never must not be mirrored" }

    # 2. A laptop edit is kept while the desktop file is unchanged.
    Put "$lap/keep.md" 'laptop edit'
    $out = Tick
    Assert ((Text "$lap/keep.md") -eq 'laptop edit') 'laptop edit was overwritten'
    Assert ($out -notmatch 'push 1') 'nothing should be pushed'

    # 3. Both sides changed: the desktop wins, the laptop file is saved aside.
    Put "$desk/keep.md" 'desktop edit'
    $out = Tick
    Assert ((Text "$lap/keep.md") -eq 'desktop edit') 'desktop version did not land'
    $aside = @(Get-ChildItem $lap -Filter 'keep.md.conflict-laptop-*')
    Assert ($aside.Count -eq 1 -and (Text $aside[0].FullName) -eq 'laptop edit') 'laptop version was not kept aside'
    Tick | Out-Null
    Assert (@(Get-ChildItem $lap -Filter 'keep.md.conflict-laptop-*').Count -eq 1) 'a conflict copy must not be mirrored or repeated'

    # 4. A delete on the desktop reaches the laptop.
    Remove-Item "$desk/new.md"
    Tick | Out-Null
    Assert (-not (Test-Path "$lap/new.md")) 'delete did not arrive'

    # 5. A file still being written is skipped. A failed copy is tried again on the next tick.
    Put "$desk/fresh.md" 'fresh'
    $out = Tick -Quiet 60
    Assert ($out -match 'skipped \(still being written\) 1' -and -not (Test-Path "$lap/fresh.md")) 'fresh file should be skipped'
    Put "$desk/blocked.md" 'v1'
    Tick | Out-Null
    $lock = [IO.File]::Open("$lap/blocked.md", 'Open', 'ReadWrite', 'None')
    try {
        Put "$desk/blocked.md" 'v2'
        $out = Tick
        Assert ($out -match 'failed [1-9]') "a locked file should be reported, got: $out"
    } finally { $lock.Close() }
    Tick | Out-Null
    Assert ((Text "$lap/blocked.md") -eq 'v2' -and (Text "$lap/fresh.md") -eq 'fresh') 'locked file did not arrive on retry'

    # 6. The laptop git head follows a desktop commit. Files already match, so the laptop tree is clean.
    G $desk add notes.md keep.md fresh.md blocked.md; G $desk commit -q -m 'desktop commit'
    $out = Tick
    Assert ((git -C $lap rev-parse HEAD) -eq (git -C $desk rev-parse HEAD)) "laptop head did not follow, got: $out"
    Assert (-not (git -C $lap status --porcelain | Where-Object { $_ -notmatch 'conflict-laptop' })) 'laptop tree should be clean after the head moved'

    # 7. A dir root: a same-name file is kept aside on the first run. A laptop-only file stays.
    Tick | Out-Null
    Assert ((Text "$skillsLap/same.md") -eq 'desktop version') 'skill did not arrive'
    Assert ((Text (@(Get-ChildItem $skillsLap -Filter 'same.md.conflict-laptop-*')[0].FullName)) -eq 'laptop version') 'laptop skill was not kept aside'
    Assert ((Text "$skillsLap/only-laptop.md") -eq 'mine') 'laptop-only skill was touched'

    # 8. More than 50 deletions in one tick stop that root.
    Tick | Out-Null
    1..60 | ForEach-Object { Remove-Item "$manyDesk/f$_.txt" }
    $out = Tick
    Assert ($out -match 'STOPPED' -and (Test-Path "$manyLap/f1.txt")) 'mass delete should be stopped'

    # 9. Last committer wins: an older laptop-only commit is replaced and kept on a backup branch.
    Put "$lap/laptop-only.md" 'from the laptop'
    G $lap add laptop-only.md; G $lap commit -q -m 'laptop commit'
    $oldLap = (git -C $lap rev-parse HEAD).Trim()
    Start-Sleep -Seconds 2
    Put "$desk/later.md" 'later'
    G $desk add later.md; G $desk commit -q -m 'newer desktop commit'
    $out = Tick
    Assert ((git -C $lap rev-parse HEAD) -eq (git -C $desk rev-parse HEAD)) "laptop head should follow the newer desktop commit, got: $out"
    Assert ((git -C $lap rev-parse "laptop/main-$($oldLap.Substring(0, 8))") -eq $oldLap) 'the replaced laptop commit must stay on a backup branch'

    Write-Host 'PASS: all Mirror-Files scenarios' -ForegroundColor Green
} finally {
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}
