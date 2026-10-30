<#
.SYNOPSIS
  One-time setup on the desktop: registers the "Leonidas Mirror Files" scheduled task, which starts
  Mirror-Files.ps1 every minute. The script then ticks every 10 seconds for 55 seconds.
.DESCRIPTION
  Run Mirror-Files.ps1 -DryRun by hand first and read what it would copy.
  Runs as the current user, no admin, hidden. Needs `ssh <laptop>` to work without a password.
  -Config picks a roots file other than the default (to mirror one root at a time).
  Uses the dev-live copy of the script when it exists, like the other dev tasks.
  Remove it with: Unregister-ScheduledTask -TaskName 'Leonidas Mirror Files' -Confirm:$false
#>
[CmdletBinding()]
param([string]$Laptop = 'jakeslaptop', [string]$Config)

$ErrorActionPreference = 'Stop'
$taskName = 'Leonidas Mirror Files'
$root = if (Test-Path -LiteralPath 'C:/lcw/dev-live/scripts/Mirror-Files.ps1') { 'C:/lcw/dev-live' } else { Split-Path -Parent $PSScriptRoot }
$pwsh = (Get-Command pwsh -ErrorAction Stop).Source
# Store updates change the versioned path; the WindowsApps alias survives them.
if ($pwsh -match 'WindowsApps\\Microsoft\.PowerShell_') { $pwsh = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\pwsh.exe' }
$arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root/scripts/Mirror-Files.ps1`" -Laptop $Laptop -LoopSeconds 55"
if ($Config) { $arguments += " -Config `"$Config`"" }
$action = New-ScheduledTaskAction -Execute $pwsh -WorkingDirectory $root -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName $taskName -Force -Action $action -Trigger $trigger -Settings $settings `
    -Principal (New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited) | Out-Null
Write-Host "Task registered: $taskName (runs $root/scripts/Mirror-Files.ps1 every minute)"
