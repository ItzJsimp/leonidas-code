$ErrorActionPreference = 'Stop'
$fixture = Join-Path $env:TEMP "leonidas-health-test-$([Guid]::NewGuid())"
New-Item -ItemType Directory -Path (Join-Path $fixture 'logs') -Force | Out-Null
function Invoke-RestMethod { @{ tag_name = 'v0.2.1'; published_at = '2026-10-11T01:00:00Z' } }
@'
{"at":"2026-10-11T01:00:30Z","status":"available","version":"0.2.1"}
{"at":"2026-10-11T01:00:40Z","status":"downloaded","version":"0.2.1"}
{"at":"2026-10-11T01:02:40Z","status":"installing","version":"0.2.1"}
{"at":"2026-10-11T01:02:50Z","status":"started","version":"0.2.1"}
{"at":"2026-10-11T01:03:50Z","status":"available","version":"0.2.1"}
broken last line
'@ | Set-Content -LiteralPath (Join-Path $fixture 'logs/update-delivery.ndjson')
$reportDir = Join-Path $fixture 'reports'
& "$PSScriptRoot/leonidas-update-health.ps1" -DeviceLabel Fixture -StateDirectory $fixture -ReportDirectory $reportDir | Out-Null
$report = Get-Content -LiteralPath (Join-Path $reportDir 'latest.json') -Raw | ConvertFrom-Json
if ($report.detectionSeconds -ne 30 -or $report.downloadSeconds -ne 10 -or
    $report.restartWaitSeconds -ne 120 -or $report.installSeconds -ne 10 -or $report.error) {
  throw "Incorrect delivery timings: $($report | ConvertTo-Json -Compress)"
}
& "$PSScriptRoot/leonidas-update-health.ps1" -StateDirectory $fixture -ReportDirectory $reportDir | Out-Null
if (@(Get-Content -LiteralPath (Join-Path $reportDir 'history.ndjson')).Count -ne 1) { throw 'Unchanged reports must not duplicate history.' }
Write-Host 'Delivery timing and history regression checks passed.'
