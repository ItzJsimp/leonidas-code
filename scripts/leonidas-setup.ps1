<#
.SYNOPSIS
  One-shot setup for a Leonidas Code builder machine (Jake or Mob). Safe to re-run.
.DESCRIPTION
  1. Git: pull.rebase + rebase.autoStash so `git pull` never makes merge noise; disables a copied
     AIOS pre-commit hook that does not exist in this repo.
  2. Identity (optional): writes CLAUDE.local.md importing your own AIOS and keeps it out of git.
  3. App: installs the latest Leonidas Code release from GitHub (upgrades an old T3 Code install
     in place, same app id) and removes every leftover T3 Code shortcut.
  The repo's .claude/settings.json pulls main at every Claude session start, and the installed
  app's updater shows a toast for every new release, so after this nothing needs managing.
.EXAMPLE
  pwsh -File scripts/leonidas-setup.ps1 -AiosClaudeMd "D:/Mob AIOS/CLAUDE.md"
#>
[CmdletBinding()]
param(
  [string]$AiosClaudeMd,
  [switch]$SkipApp,
  [string]$Repository = "ItzJsimp/t3code"
)
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot

# 1. Git
git -C $repo config pull.rebase true
git -C $repo config rebase.autoStash true
git -C $repo config fetch.prune true
$hook = Join-Path $repo ".git/hooks/pre-commit"
if ((Test-Path -LiteralPath $hook) -and (Select-String -LiteralPath $hook -Pattern "AIOS|Leonidas AIOS" -Quiet)) {
  Move-Item -LiteralPath $hook -Destination "$hook.aios-disabled" -Force
  Write-Host "Disabled copied AIOS pre-commit hook."
}
git -C $repo pull --rebase --autostash --quiet origin main
Write-Host "Git: rebase pulls on, up to date with origin/main."

# 2. Identity
if ($AiosClaudeMd) {
  $import = "@" + ($AiosClaudeMd -replace "\\", "/" -replace " ", "\ ")
  Set-Content -LiteralPath (Join-Path $repo "CLAUDE.local.md") -Value $import -Encoding utf8
  $exclude = Join-Path $repo ".git/info/exclude"
  if (-not (Select-String -LiteralPath $exclude -Pattern "^CLAUDE.local.md$" -Quiet -ErrorAction SilentlyContinue)) {
    Add-Content -LiteralPath $exclude -Value "CLAUDE.local.md"
  }
  Write-Host "Identity: CLAUDE.local.md -> $import. Run 'claude' once in this folder and approve the import dialog."
}

if ($SkipApp) { return }

# 3. App
$release = Invoke-RestMethod "https://api.github.com/repos/$Repository/releases/latest"
$asset = $release.assets | Where-Object name -like "*.exe" | Select-Object -First 1
if (-not $asset) { throw "No .exe asset on release $($release.tag_name)." }
$installer = Join-Path $env:TEMP $asset.name
Invoke-WebRequest $asset.browser_download_url -OutFile $installer
Get-Process -Name "T3 Code*", "Leonidas Code*" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Start-Process -FilePath $installer -ArgumentList "/S", "/currentuser" -Wait
Write-Host "Installed Leonidas Code $($release.tag_name)."

# Leftover T3 Code: other uninstall entries, then shortcuts anywhere a launch could start it.
Get-ChildItem "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall" |
  Get-ItemProperty | Where-Object { $_.DisplayName -like "T3 Code*" -and $_.UninstallString } |
  ForEach-Object {
    $exe = ($_.UninstallString -split '"')[1]
    if ($exe -and (Test-Path -LiteralPath $exe)) { Start-Process $exe -ArgumentList "/S", "/currentuser" -Wait }
  }
$shortcutDirs = @(
  [Environment]::GetFolderPath("Desktop"),
  [Environment]::GetFolderPath("Programs"),
  "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar",
  "$env:PUBLIC\Desktop"
)
Get-ChildItem -LiteralPath $shortcutDirs -Filter "T3 Code*.lnk" -ErrorAction SilentlyContinue |
  ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force; Write-Host "Removed $($_.FullName)" }

$exePath = Join-Path $env:LOCALAPPDATA "Programs\t3code\Leonidas Code.exe"
if (-not (Test-Path -LiteralPath $exePath)) { throw "Expected $exePath after install." }
Start-Process -FilePath $exePath
Write-Host "Launched Leonidas Code. Right-click its taskbar icon > Pin to taskbar (Windows blocks scripted pins)."
