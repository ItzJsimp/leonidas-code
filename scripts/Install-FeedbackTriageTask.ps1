<#
.SYNOPSIS
  Registers the "Leonidas Feedback Triage" scheduled task (current user, no admin): every 30
  minutes it runs Invoke-FeedbackTriage.ps1, which only starts an AI run when reports are waiting.
  Remove it with: Unregister-ScheduledTask -TaskName 'Leonidas Feedback Triage' -Confirm:$false
#>
$ErrorActionPreference = 'Stop'
$taskName = 'Leonidas Feedback Triage'
$pwsh = (Get-Command pwsh -ErrorAction Stop).Source
$script = Join-Path $PSScriptRoot 'Invoke-FeedbackTriage.ps1'
$action = New-ScheduledTaskAction -Execute $pwsh -WorkingDirectory (Split-Path -Parent $PSScriptRoot) `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName $taskName -Force -Settings $settings -Action $action -Trigger $trigger `
    -Principal (New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited) | Out-Null
Write-Output "Registered '$taskName' (every 30 minutes). Log: $env:LOCALAPPDATA/LeonidasFeedbackTriage/triage.log"
