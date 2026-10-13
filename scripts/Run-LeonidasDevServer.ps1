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
while ($true) {
    # The dev runner writes straight to its console, so capture it through file redirection.
    $proc = Start-Process -FilePath $pwsh -WindowStyle Hidden -PassThru -Wait `
        -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + (Join-Path $PSScriptRoot 'dev-isolated.ps1') + '"'), '-Mode', 'web') `
        -RedirectStandardOutput $log -RedirectStandardError (Join-Path $devHome 'dev-server.err.log')
    Add-Content -LiteralPath $log -Value "[supervisor] dev server exited ($($proc.ExitCode)) at $(Get-Date -Format o); restarting in 10 s"
    Start-Sleep -Seconds 10
}
