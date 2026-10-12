[CmdletBinding()]
param(
    [ValidateRange(1, 2147483647)][int]$Projects = 1000,
    [ValidateRange(1, 2147483647)][int]$ThreadsPerProject = 100
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$devHome = Join-Path $repoRoot '.t3'
$destination = Join-Path $devHome 'userdata'
$source = Join-Path $env:USERPROFILE '.t3/userdata'
$node = (Get-Command node -ErrorAction Stop).Source
foreach ($target in @($devHome, $destination)) {
    if ([IO.Path]::GetFullPath($target) -notlike ([IO.Path]::GetFullPath($repoRoot) + [IO.Path]::DirectorySeparatorChar + '*')) {
        throw 'Snapshot destination must stay inside this checkout.'
    }
    if ((Test-Path -LiteralPath $target) -and ((Get-Item -LiteralPath $target).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Snapshot destination must not be a symlink or junction.'
    }
}

function Assert-DevStopped {
    $descriptor = Join-Path $destination 'server-runtime.json'
    if (Test-Path -LiteralPath $descriptor) {
        $runtime = Get-Content -LiteralPath $descriptor -Raw | ConvertFrom-Json
        if ($runtime.pid -and (Get-Process -Id $runtime.pid -ErrorAction SilentlyContinue)) {
            throw 'Stop the preview copy before refreshing its snapshot. The installed app can stay open.'
        }
    }
}

# Build beside the current copy; a failed migration never replaces dev data.
Assert-DevStopped
$stage = Join-Path $devHome ('snapshot-' + [guid]::NewGuid().ToString('N'))
$backup = Join-Path $devHome ('backup-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage -Force | Out-Null
& $node (Join-Path $repoRoot 'apps/server/scripts/migrate-dev-db.ts') --base-dir $stage --source (Join-Path $source 'statev2.sqlite') --projects $Projects --threads-per-project $ThreadsPerProject
if ($LASTEXITCODE -ne 0) {
    throw "Snapshot failed. Existing dev data is unchanged; staging data remains at $stage."
}
$stagedData = Join-Path $stage 'userdata'
foreach ($name in @('settings.json', 'client-settings.json', 'desktop-settings.json', 'keybindings.json', 'themes', 'attachments')) {
    $item = Join-Path $source $name
    if (Test-Path -LiteralPath $item) {
        Copy-Item -LiteralPath $item -Destination $stagedData -Recurse -Force
    }
}
# Keep dev signing keys independent; provider CLI logins already live on this machine.
$devSecrets = Join-Path $destination 'secrets'
if (Test-Path -LiteralPath $devSecrets) {
    Copy-Item -LiteralPath $devSecrets -Destination $stagedData -Recurse
}
Assert-DevStopped
if (Test-Path -LiteralPath $destination) {
    Move-Item -LiteralPath $destination -Destination $backup
}
try {
    Move-Item -LiteralPath $stagedData -Destination $destination
} catch {
    if (Test-Path -LiteralPath $backup) {
        Move-Item -LiteralPath $backup -Destination $destination
    }
    throw
}
Write-Host "Dev snapshot refreshed. Previous dev data: $backup"
Write-Host 'Pair the browser with dev again. Browser-only preferences retain their own profile settings.'
