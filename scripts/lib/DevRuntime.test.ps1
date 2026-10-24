$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'DevRuntime.ps1')

function New-Home([string]$Json) {
    $home_ = Join-Path ([IO.Path]::GetTempPath()) ("devruntime-" + [guid]::NewGuid().ToString('N'))
    if ($null -ne $Json) {
        New-Item -ItemType Directory -Path (Join-Path $home_ 'userdata') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $home_ 'userdata/server-runtime.json') -Value $Json
    } else { New-Item -ItemType Directory -Path $home_ -Force | Out-Null }
    $home_
}
function New-Descriptor($ProcessId, [int]$ServerPort, [int]$WebPort) {
    @{ version = 1; pid = $ProcessId; port = $ServerPort; origin = "http://127.0.0.1:$ServerPort"; devUrl = "http://localhost:$WebPort/"; startedAt = '2026-10-20T19:10:08.775Z' } | ConvertTo-Json -Compress
}
function Assert-True($Condition, [string]$Message) { if (-not $Condition) { throw "FAIL: $Message" } }

# Absent, malformed and non-dev descriptors read as not running.
Assert-True ($null -eq (Get-DevRuntime (New-Home $null))) 'missing descriptor'
Assert-True ($null -eq (Get-DevRuntime (New-Home '{not json'))) 'malformed descriptor'
Assert-True ($null -eq (Get-DevRuntime (New-Home '{"pid":1,"port":2,"startedAt":"2026-10-20T19:10:08.775Z"}'))) 'no devUrl'

# A dead pid is stale.
$dead = Start-Process -FilePath (Get-Process -Id $PID).Path -ArgumentList '-NoProfile', '-Command', 'exit 0' -PassThru -WindowStyle Hidden
$dead.WaitForExit()
Assert-True ($null -eq (Get-DevRuntime (New-Home (New-Descriptor $dead.Id 23773 15733)))) 'dead pid'

# A live pid with listening ports is healthy, and the ports come from the descriptor.
$server = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0); $server.Start()
$web = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0); $web.Start()
try {
    $sp = $server.LocalEndpoint.Port; $wp = $web.LocalEndpoint.Port
    $rt = Get-DevRuntime (New-Home (New-Descriptor $PID $sp $wp))
    Assert-True ($rt.ServerPort -eq $sp -and $rt.WebPort -eq $wp) 'ports read from descriptor'
    Assert-True ($rt.StartedAt -eq [datetime]::Parse('2026-10-20T19:10:08.775Z').ToUniversalTime()) 'startedAt is not shifted by the UTC offset'
    Assert-True (Test-DevHealthy $rt) 'healthy stack'
    $web.Stop()
    Assert-True (-not (Test-DevHealthy $rt)) 'closed web port (recycled pid) is unhealthy'
} finally { $server.Stop(); try { $web.Stop() } catch { } }
Write-Output 'PASS: descriptor read, stale pid, malformed input, UTC start time, health by recorded ports'
