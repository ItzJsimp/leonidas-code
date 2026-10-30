<#
.SYNOPSIS
  Registers the "Leonidas Feedback Triage" scheduled task (current user, no admin): every 30
  minutes it runs Invoke-FeedbackTriage.ps1, which only starts an AI run when reports are waiting.
  Remove it with: Unregister-ScheduledTask -TaskName 'Leonidas Feedback Triage' -Confirm:$false
#>
$ErrorActionPreference = 'Stop'
$taskName = 'Leonidas Feedback Triage'
$pwsh = (Get-Command pwsh -ErrorAction Stop).Source
# Store updates change the versioned path; the WindowsApps alias survives them.
if ($pwsh -match 'WindowsApps\\Microsoft\.PowerShell_') { $pwsh = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\pwsh.exe' }
# Invoke-FeedbackTriage.ps1 deletes and refreshes its own worktree. A task that points inside it
# loses its script (0x8007010B). Register only from a stable checkout.
$workDir = 'C:/lcw/triage'
$here = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\', '/')
$work = [IO.Path]::GetFullPath($workDir).TrimEnd('\', '/')
if ($here -eq $work -or $here.StartsWith($work + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to register: this script sits inside the triage worktree ($work). Run it from a stable checkout."
}
$script = Join-Path $PSScriptRoot 'Invoke-FeedbackTriage.ps1'
$action = New-ScheduledTaskAction -Execute $pwsh -WorkingDirectory (Split-Path -Parent $PSScriptRoot) `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -Hidden -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName $taskName -Force -Settings $settings -Action $action -Trigger $trigger `
    -Principal (New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Limited) | Out-Null
Write-Output "Registered '$taskName' (every 30 minutes). Log: $env:LOCALAPPDATA/LeonidasFeedbackTriage/triage.log"
