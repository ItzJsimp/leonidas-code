# Shared by the dev launchers (dot-source it). Ports come from the descriptor the dev server writes
# at start (`<home>/userdata/server-runtime.json`), never from constants: the dev runner moves to
# the next free pair when its preferred ports are taken.

function Test-Listening([int]$Port) {
    $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

# $HomeDir is the dev home (the `.t3` folder). Returns $null when the descriptor is missing,
# malformed, not a dev stack (no devUrl) or its pid is gone; callers then treat the dev copy as not running.
function Get-DevRuntime([string]$HomeDir) {
    $file = Join-Path $HomeDir 'userdata/server-runtime.json'
    if (-not (Test-Path -LiteralPath $file)) { return $null }
    try {
        $d = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
        $web = [int]([uri]$d.devUrl).Port
        # ConvertFrom-Json already turns an ISO timestamp into a DateTime; re-parsing it as text shifts it by the UTC offset.
        $started = if ($d.startedAt -is [datetime]) { $d.startedAt.ToUniversalTime() } else { [DateTimeOffset]::Parse($d.startedAt).UtcDateTime }
        if (-not $d.pid -or -not $d.port -or $web -le 0) { return $null }
    } catch { return $null }
    if (-not (Get-Process -Id $d.pid -ErrorAction SilentlyContinue)) { return $null }
    [pscustomobject]@{ Pid = [int]$d.pid; ServerPort = [int]$d.port; WebPort = $web; StartedAt = $started }
}

# Healthy means both recorded ports answer, which also rejects a recycled pid.
function Test-DevHealthy($Runtime) {
    $null -ne $Runtime -and (Test-Listening $Runtime.ServerPort) -and (Test-Listening $Runtime.WebPort)
}
