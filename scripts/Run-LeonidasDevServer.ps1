<#
.SYNOPSIS
  Keeps the isolated Leonidas Code dev server (server + web, no window) running. Started at
  sign-in by the "Leonidas Code Dev Server" scheduled task; restarts the server if it exits.
  Output goes to .t3/dev-server.log and dev-server.err.log (git-ignored, replaced each start).
#>
$ErrorActionPreference = 'Continue'
$repoRoot = Split-Path -Parent $PSScriptRoot
$devHome = Join-Path $repoRoot '.t3'
$log = Join-Path $devHome 'dev-server.log'
New-Item -ItemType Directory -Force -Path $devHome | Out-Null
$pwsh = (Get-Process -Id $PID).Path
$serverPort = 23773
$startGraceSeconds = 180   # first start can take a while (install repair, cold caches)
$downRestartSeconds = 60  # longer than a normal hot-reload restart

# An interrupted install can leave a patched package without its patch (pnpm still thinks it is
# current), which breaks the web page. For every entry in pnpm-workspace.yaml patchedDependencies,
# check that one added line from each file in the patch is present in each installed copy; rebuild
# the copies that are not. Packages that are not installed on this machine (mobile only) are skipped.
function Get-UnpatchedPackageDirs {
    $store = [IO.Path]::GetFullPath((Join-Path $repoRoot 'node_modules/.pnpm'))
    $yaml = Join-Path $repoRoot 'pnpm-workspace.yaml'
    $bad = [System.Collections.Generic.List[string]]::new()
    $inBlock = $false
    foreach ($line in Get-Content -LiteralPath $yaml) {
        if ($line -match '^patchedDependencies:') { $inBlock = $true; continue }
        if ($inBlock -and $line -match '^\S') { break }
        if (-not ($inBlock -and $line -match '^\s+"?(?<spec>[^":\s]+)"?:\s*(?<patch>\S+\.patch)\s*$')) { continue }
        $spec = $Matches['spec']; $patchFile = Join-Path $repoRoot $Matches['patch']
        $at = $spec.LastIndexOf('@'); $name = $spec.Substring(0, $at); $version = $spec.Substring($at + 1)
        if (-not (Test-Path -LiteralPath $patchFile)) { continue }
        $dirs = Get-ChildItem -LiteralPath $store -Directory -Filter ("{0}@{1}_*" -f $name.Replace('/', '+'), $version) -ErrorAction SilentlyContinue
        if (-not $dirs) { continue }
        # One marker per patched file: its first added line with real content.
        $markers = @{}; $current = $null
        foreach ($p in Get-Content -LiteralPath $patchFile) {
            if ($p -match '^diff --git a/(?<f>\S+) b/') { $current = $Matches['f']; continue }
            if ($current -and -not $markers.ContainsKey($current) -and $p -match '^\+(?!\+\+)(?<t>.*\S.*)$' -and $Matches['t'].Trim().Length -ge 6) {
                $markers[$current] = $Matches['t']
            }
        }
        foreach ($d in $dirs) {
            $root = Join-Path $d.FullName "node_modules/$name"
            foreach ($f in $markers.Keys) {
                $file = Join-Path $root $f
                if (-not (Test-Path -LiteralPath $file) -or -not (Select-String -LiteralPath $file -SimpleMatch -Pattern $markers[$f] -Quiet)) {
                    $bad.Add($d.FullName); break
                }
            }
        }
    }
    return $bad
}

function Repair-PatchedPackages {
    $bad = @(Get-UnpatchedPackageDirs)
    if ($bad.Count -eq 0) { return }
    Add-Content -LiteralPath $log -Value "[supervisor] $($bad.Count) patched package copies are missing their patch; rebuilding: $(($bad | Split-Path -Leaf) -join ', ')"
    foreach ($d in $bad) { Remove-Item -LiteralPath $d -Recurse -Force -ErrorAction SilentlyContinue }
    $env:CI = 'true'
    & npx --yes pnpm@11.10.0 install --frozen-lockfile --prefer-offline *>> $log
}

while ($true) {
    Repair-PatchedPackages
    # Leftover watchers and searches slow the whole machine; name them in the log (report only).
    $runaway = (& (Join-Path $PSScriptRoot 'Find-RunawayProcesses.ps1') 2>&1) -join "`n"
    if ($runaway -notmatch '^No runaway') { Add-Content -LiteralPath $log -Value "[supervisor] $runaway" }
    # The dev runner writes straight to its console, so capture it through file redirection.
    $proc = Start-Process -FilePath $pwsh -WindowStyle Hidden -PassThru `
        -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + (Join-Path $PSScriptRoot 'dev-isolated.ps1') + '"'), '-Mode', 'web') `
        -RedirectStandardOutput $log -RedirectStandardError (Join-Path $devHome 'dev-server.err.log')
    # When the server crashes on a half-written file (a merge or checkout in progress), the dev runner
    # stays alive printing "Waiting for file changes" and nothing restarts it, so the web page shows a
    # 502 until someone edits a file. Watch the server port and restart the runner we started
    # (by its captured PID only) when the server stays down.
    $startedAt = Get-Date
    $downSince = $null
    while (-not $proc.HasExited) {
        Start-Sleep -Seconds 5
        $up = $null -ne (Get-NetTCPConnection -LocalPort $serverPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
        if ($up) { $downSince = $null; continue }
        if (((Get-Date) - $startedAt).TotalSeconds -lt $startGraceSeconds) { continue }
        if (-not $downSince) { $downSince = Get-Date; continue }
        if (((Get-Date) - $downSince).TotalSeconds -ge $downRestartSeconds) {
            Add-Content -LiteralPath $log -Value "[supervisor] server port $serverPort down for $downRestartSeconds s while the dev runner is alive; restarting it at $(Get-Date -Format o)"
            & taskkill.exe /PID $proc.Id /T /F *> $null
            break
        }
    }
    $proc.WaitForExit(15000) | Out-Null
    Add-Content -LiteralPath $log -Value "[supervisor] dev server exited ($(if ($proc.HasExited) { $proc.ExitCode } else { 'killed' })) at $(Get-Date -Format o); restarting in 10 s"
    Start-Sleep -Seconds 10
}
