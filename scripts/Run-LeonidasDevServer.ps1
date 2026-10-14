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

# An interrupted install can leave a patched package without its patch (pnpm still thinks it is
# current), which breaks the web page. Detect that and rebuild just that package.
function Repair-PatchedPackages {
    $pkg = Join-Path $repoRoot 'apps/web/node_modules/@pierre/diffs/package.json'
    if (-not (Test-Path -LiteralPath $pkg)) { return }
    if (Select-String -LiteralPath $pkg -Pattern 'utils/parsePatchFiles' -Quiet) { return }
    Add-Content -LiteralPath $log -Value "[supervisor] @pierre/diffs is missing its patch; rebuilding it"
    $link = Split-Path -Parent $pkg
    $target = (Get-Item -LiteralPath $link).Target | Select-Object -First 1
    if ($target) {
        $full = [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $link) $target))
        $dir = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $full))
        $store = [IO.Path]::GetFullPath((Join-Path $repoRoot 'node_modules/.pnpm'))
        if ($dir.StartsWith($store, [StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue }
    }
    $env:CI = 'true'
    & npx --yes pnpm@11.10.0 install --frozen-lockfile --prefer-offline *>> $log
}

while ($true) {
    Repair-PatchedPackages
    # The dev runner writes straight to its console, so capture it through file redirection.
    $proc = Start-Process -FilePath $pwsh -WindowStyle Hidden -PassThru -Wait `
        -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + (Join-Path $PSScriptRoot 'dev-isolated.ps1') + '"'), '-Mode', 'web') `
        -RedirectStandardOutput $log -RedirectStandardError (Join-Path $devHome 'dev-server.err.log')
    Add-Content -LiteralPath $log -Value "[supervisor] dev server exited ($($proc.ExitCode)) at $(Get-Date -Format o); restarting in 10 s"
    Start-Sleep -Seconds 10
}
