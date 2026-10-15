<#
.SYNOPSIS
  Copies the uncommitted work of the main checkout into the fast C: dev copy (C:/lcw/dev-live),
  so the permanent dev server shows your latest edits. Hot reload picks the files up.
#>
$ErrorActionPreference = 'Stop'
$src = Split-Path -Parent $PSScriptRoot
$dst = 'C:/lcw/dev-live'
if (-not (Test-Path -LiteralPath $dst)) { throw "Missing $dst. Create it with: git worktree add $dst HEAD" }
$files = git -C $src status --porcelain=v1 -uall | Where-Object { $_ -notmatch '^( D|D )' } | ForEach-Object { $_.Substring(3).Trim('"') }
foreach ($f in $files) {
    $to = Join-Path $dst $f
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $to) | Out-Null
    Copy-Item -LiteralPath (Join-Path $src $f) -Destination $to -Recurse -Force
}
Write-Output "Synced $(@($files).Count) changed paths to $dst"
