# GENERATED from AIOS_PRESET (apps/web/src/onboarding/leonidasSetup.logic.ts). Do not edit by hand.
# To change it: edit the preset, then run: node scripts/generate-aios-folders.ts
# Creates the starter AIOS folders and empty files without a chat. Existing files are kept.

[CmdletBinding()]
param(
  [string]$Path = (Join-Path $HOME 'AIOS')
)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($Path)
New-Item -ItemType Directory -Force -Path $root | Out-Null

$entries = @(
  'CLAUDE.md'
  'AGENTS.md'
  'memory/'
  'tasks/'
  'projects/'
  '.claude/skills/'
)
foreach ($entry in $entries) {
  $target = Join-Path $root $entry
  if ($entry.EndsWith('/')) {
    New-Item -ItemType Directory -Force -Path $target | Out-Null
  } elseif (-not (Test-Path -LiteralPath $target)) {
    New-Item -ItemType File -Path $target | Out-Null
  }
}
Write-Host "AIOS folders ready at $root"
