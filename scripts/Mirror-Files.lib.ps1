# Shared by Mirror-Files.ps1 (desktop) and Receive-Mirror.ps1 (laptop).
# Keep this file valid for Windows PowerShell 5.1: the laptop runs it over SSH.

# Never mirrored, in any root. A root can add more patterns in its config.
$script:MirrorBaseDeny = @(
    '^\.git(/|$)', '(^|/)node_modules/', '(^|/)\.env($|\.)', '\.(key|pem|pfx)$', '(^|/)\.credentials',
    '\.conflict-(laptop|desktop)-\d{8}-\d{6}'
)

# Windows tar (bsdtar). A GNU tar earlier on PATH (Git for Windows) cannot read C: paths.
$tarExe = if (Test-Path -LiteralPath "$env:WINDIR/System32/tar.exe") { "$env:WINDIR/System32/tar.exe" } else { 'tar.exe' }

function ConvertTo-MirrorMap($Object) {
    $map = @{}
    if ($null -ne $Object) { foreach ($p in $Object.PSObject.Properties) { $map[$p.Name] = $p.Value } }
    return $map
}

function Read-MirrorJson([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $text = [IO.File]::ReadAllText($Path)
    if ($text.Trim().Length -eq 0) { return $null }
    return ($text | ConvertFrom-Json)
}

function Write-MirrorJson([string]$Path, $Object) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Path) | Out-Null
    [IO.File]::WriteAllText($Path, ($Object | ConvertTo-Json -Depth 6 -Compress))
}

function Test-MirrorDenied([string]$Rel, [string[]]$Deny) {
    foreach ($pattern in (@($script:MirrorBaseDeny) + @($Deny))) {
        if ($pattern -and $Rel -match $pattern) { return $true }
    }
    return $false
}

# A relative path from a request must stay inside the root.
function Test-MirrorSafePath([string]$Rel) {
    return ($Rel -and -not [IO.Path]::IsPathRooted($Rel) -and $Rel -notmatch '(^|[\\/])\.\.([\\/]|$)')
}

function Get-MirrorFileList([string]$Root, [string]$Mode) {
    if ($Mode -eq 'git') {
        # No -z: PowerShell splits native output on newlines. quotepath=false keeps names readable.
        return @(git -C $Root -c core.quotepath=false ls-files -co --exclude-standard)
    }
    $prefix = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\', '/').Length + 1
    return @(Get-ChildItem -LiteralPath $Root -Recurse -File -Force |
            ForEach-Object { $_.FullName.Substring($prefix).Replace('\', '/') })
}

# path -> @{ Hash; Mtime (UTC ticks) }. A file is hashed again only when its size or time changed.
function Get-MirrorManifest {
    param([string]$Root, [string]$Mode, [string[]]$Deny, [string]$CachePath, [long]$MaxBytes = 50MB)
    $cache = ConvertTo-MirrorMap (Read-MirrorJson $CachePath)
    $manifest = @{}
    $newCache = @{}
    foreach ($rel in (Get-MirrorFileList $Root $Mode)) {
        if (Test-MirrorDenied $rel $Deny) { continue }
        $file = New-Object IO.FileInfo (Join-Path $Root $rel)
        # A tracked file that was deleted is still listed by git; a folder entry (submodule) is not a file.
        if (-not $file.Exists -or $file.Length -gt $MaxBytes) { continue }
        $key = "$($file.Length)|$($file.LastWriteTimeUtc.Ticks)"
        $hash = $null
        if ($cache.ContainsKey($rel) -and $cache[$rel].Key -eq $key) { $hash = $cache[$rel].Hash }
        if (-not $hash) { $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash }
        $manifest[$rel] = @{ Hash = $hash; Mtime = $file.LastWriteTimeUtc.Ticks }
        $newCache[$rel] = @{ Key = $key; Hash = $hash }
    }
    Write-MirrorJson $CachePath $newCache
    return $manifest
}

<#
  One-way plan, desktop to laptop. Inputs are path -> hash maps (null hash = file absent):
  $Desktop (with Mtime), $Remote (laptop) and $Baseline (the state both sides had after the last tick).
  - Same content on both sides: settled.
  - Only the desktop changed since the baseline: push (or delete on the laptop).
  - Only the laptop changed: hold. The laptop edit is never overwritten.
  - Both changed to different content: save the laptop file aside, then apply the desktop state.
  Phase 2 (laptop to desktop) adds a branch for the "only the laptop changed" case.
#>
function Get-MirrorPlan {
    param($Desktop, $Remote, $Baseline, [int]$QuietSeconds = 2)
    $plan = @{ Push = @(); Delete = @(); Aside = @(); Held = 0; Settled = @{}; Unstable = 0 }
    $paths = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($map in @($Desktop, $Remote, $Baseline)) { foreach ($k in $map.Keys) { [void]$paths.Add($k) } }
    $nowTicks = [datetime]::UtcNow.Ticks
    foreach ($p in $paths) {
        $a = $null; if ($Desktop.ContainsKey($p)) { $a = $Desktop[$p].Hash }
        $l = $null; if ($Remote.ContainsKey($p)) { $l = $Remote[$p] }
        $b = $null; if ($Baseline.ContainsKey($p)) { $b = $Baseline[$p] }
        if ($a -eq $l) { $plan.Settled[$p] = $a; continue }
        if ($a -and $QuietSeconds -gt 0 -and (($nowTicks - $Desktop[$p].Mtime) / 1e7) -lt $QuietSeconds) { $plan.Unstable++; continue }
        if ($l -eq $b) {
            if ($a) { $plan.Push += $p } else { $plan.Delete += $p }
        } elseif ($a -eq $b) {
            $plan.Held++
        } else {
            if ($l) { $plan.Aside += $p }
            if ($a) { $plan.Push += $p } else { $plan.Delete += $p }
        }
    }
    return $plan
}
