<#
.SYNOPSIS
  One-time setup on the desktop: registers the "Leonidas Dev Laptop Sync" scheduled task, which runs
  Send-DevToLaptop.ps1 every minute so the laptop dev app follows this machine's branches.
.DESCRIPTION
  Runs as the current user, no admin, hidden. Needs `ssh <laptop>` to work without a password.
  Uses the dev-live copy of the script when it exists, like the dev server task does.
  Remove it with: Unregister-ScheduledTask -TaskName 'Leonidas Dev Laptop Sync' -Confirm:$false
#>
[CmdletBinding()]
param([string]$Laptop = 'jakeslaptop')

$ErrorActionPreference = 'Stop'
$taskName = 'Leonidas Dev Laptop Sync'
$root = if (Test-Path -LiteralPath 'C:/lcw/dev-live/scripts/Send-DevToLaptop.ps1') { 'C:/lcw/dev-live' } else { Split-Path -Parent $PSScriptRoot }
$pwsh = (Get-Command pwsh -ErrorAction Stop).Source
# Store updates change the versioned path; the WindowsApps alias survives them.
if ($pwsh -match 'WindowsApps\\Microsoft\.PowerShell_') { $pwsh = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\pwsh.exe' }
$action = New-ScheduledTaskAction -Execute $pwsh -WorkingDirectory $root `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root/scripts/Send-DevToLaptop.ps1`" -Laptop $Laptop"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName $taskName -Force -Action $action -Trigger $trigger -Settings $settings `
    -Principal (New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited) | Out-Null
Write-Host "Task registered: $taskName (runs $root/scripts/Send-DevToLaptop.ps1 every minute)"
