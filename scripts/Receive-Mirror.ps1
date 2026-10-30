<#
.SYNOPSIS
  Laptop side of Mirror-Files.ps1. Copied to the laptop by the sender; do not run it by hand.
.DESCRIPTION
  -Mode Manifest  lists every mirrored file of each root with its hash (plus git head and state).
  -Mode Apply     saves conflict copies aside, deletes files, then unpacks the tar into the root.
  -Mode Head      moves the git head of a root forward to the desktop commit. Files stay as they are.
  Input is a JSON request file. Output is a JSON file. Valid for Windows PowerShell 5.1.
#>
param(
    [Parameter(Mandatory)][ValidateSet('Manifest', 'Apply', 'Head')][string]$Mode,
    [Parameter(Mandatory)][string]$Request,
    [Parameter(Mandatory)][string]$Output
)
$ErrorActionPreference = 'Continue'   # native tools write progress to stderr; check exit codes instead
. (Join-Path $PSScriptRoot 'Mirror-Files.lib.ps1')
$req = Read-MirrorJson $Request

if ($Mode -eq 'Manifest') {
    $result = @{}
    foreach ($r in @($req.Roots)) {
        New-Item -ItemType Directory -Force -Path $r.Root | Out-Null
        $files = @{}
        $manifest = Get-MirrorManifest -Root $r.Root -Mode $r.Mode -Deny @($r.Deny) -CachePath $r.Cache
        foreach ($k in $manifest.Keys) { $files[$k] = $manifest[$k].Hash }
        $entry = @{ Files = $files; Head = $null; Branch = $null; Clean = $false; HeadTime = 0; Known = @() }
        if ($r.IsGit) {
            $entry.Head = "$(git -C $r.Root rev-parse -q --verify HEAD 2>$null)".Trim()
            $entry.Branch = "$(git -C $r.Root symbolic-ref --short -q HEAD 2>$null)".Trim()
            $entry.HeadTime = [long]("0$(git -C $r.Root log -1 --format=%ct 2>$null)")
            $entry.Known = @(git -C $r.Root for-each-ref --format='%(objectname)' refs/heads refs/remotes/origin 2>$null)
            if ($r.NeedClean) { $entry.Clean = -not (git -C $r.Root status --porcelain 2>$null) }
        }
        $result[$r.Name] = $entry
    }
    Write-MirrorJson $Output $result
    return
}

if ($Mode -eq 'Apply') {
    $failed = New-Object System.Collections.ArrayList
    $root = $req.Root
    New-Item -ItemType Directory -Force -Path $root | Out-Null
    foreach ($rel in @($req.Aside)) {
        if (-not (Test-MirrorSafePath $rel)) { [void]$failed.Add($rel); continue }
        $from = Join-Path $root $rel
        if (Test-Path -LiteralPath $from) { Move-Item -LiteralPath $from -Destination "$from.conflict-laptop-$($req.Stamp)" -Force }
    }
    foreach ($rel in @($req.Delete)) {
        if (-not (Test-MirrorSafePath $rel)) { [void]$failed.Add($rel); continue }
        Remove-Item -LiteralPath (Join-Path $root $rel) -Force -ErrorAction SilentlyContinue
    }
    if ($req.Tar -and (Test-Path -LiteralPath $req.Tar)) {
        & $tarExe -xf $req.Tar -C $root 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { foreach ($rel in @($req.Push)) { [void]$failed.Add($rel) } }
    }
    Write-MirrorJson $Output @{ Failed = @($failed) }
    return
}

# Head: a fast-forward, or (Force) a replacement of a laptop commit that is older than the desktop head.
# A replaced laptop head stays on a backup branch.
$message = 'not applied'
git -C $req.Root fetch --no-tags -q $req.Bundle 'HEAD:refs/desk-sync/mirror-head' 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    $message = 'bundle fetch failed'
} else {
    git -C $req.Root merge-base --is-ancestor HEAD $req.Sha 2>&1 | Out-Null
    $forward = ($LASTEXITCODE -eq 0)
    if (-not $forward -and -not $req.Force) {
        $message = 'laptop head is not behind the desktop head: history needs a rule'
    } else {
        if (-not $forward) { git -C $req.Root branch -f $req.Backup HEAD 2>&1 | Out-Null }
        git -C $req.Root reset --mixed -q $req.Sha 2>&1 | Out-Null
        $message = if ($LASTEXITCODE -ne 0) { 'reset failed' } elseif ($forward) { 'moved' } else { "moved; the older laptop commit is kept on branch $($req.Backup)" }
    }
}
Write-MirrorJson $Output @{ Message = $message }
