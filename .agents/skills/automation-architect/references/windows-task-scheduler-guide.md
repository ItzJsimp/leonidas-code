# Windows Task Scheduler Engineering Guide

Windows Task Scheduler is the Tier 2 persistent, crash-resistant automation engine for Leonidas AIOS. It provides 11 native trigger types (time-based, logon, idle, system unlock, event log) and runs tasks unattended without active user sessions.

---

## Task Scheduler Schema Defaults & Critical Overrides

Windows Task Scheduler's default settings are designed for interactive user utilities, not silent 24/7 automations. Always explicitly configure the following properties:

| XML / Property Name       | Windows Default    | Required AIOS Setting         | Rationale                                                                                                 |
| ------------------------- | ------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Hidden`                  | `false`            | `true`                        | Prevents disruptive command prompt windows from popping up over Jake's screen.                            |
| `WakeToRun`               | `false`            | `true` (if sleep-critical)    | Wakes the PC from sleep to execute scheduled time triggers. Leave false if task can wait for user wakeup. |
| `LogonType`               | `Interactive`      | `S4U` (Service-for-User)      | Runs under Jake's account security context without storing a plaintext password.                          |
| `RunLevel`                | Inherited          | `LeastPrivilege`              | Avoids elevating tasks to Administrator unless specific hardware/driver access is required.               |
| `ExecutionTimeLimit`      | `PT72H` (72 hours) | `PT1H` (1 hour) or tighter    | Prevents frozen scripts from hanging invisibly for 3 days.                                                |
| `MultipleInstancesPolicy` | `IgnoreNew`        | `IgnoreNew` or `StopExisting` | Prevents race conditions and overlapping runs of non-reentrant scripts.                                   |
| `RestartOnFailure`        | Disabled           | Interval: `PT5M`, Count: `3`  | Automatically retries transient failures before raising alerts.                                           |

---

## What New-AiosScheduledTask.ps1 Bakes In (Reference Only)

[`scripts/New-AiosScheduledTask.ps1`](../../../../scripts/New-AiosScheduledTask.ps1) is the one sanctioned registration path: it emits exactly the structure below (Hidden, S4U, bounded ExecutionTimeLimit, IgnoreNew). This template is the reference for auditing the wrapper's output, not a copy-paste path: never hand-write `Register-ScheduledTask` calls for new tasks.

```powershell
# Parameters
$TaskName = "Leonidas-Queue-Sync"
$ScriptPath = "D:\Leonidas AIOS\scripts\Sync-Queue.ps1"
$LogPath = "D:\Leonidas AIOS\logs\queue-sync.log"

# 1. Action: Launch PowerShell 7 silently
$Action = New-ScheduledTaskAction `
    -Execute "pwsh.exe" `
    -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -File `"$ScriptPath`""

# 2. Trigger: Run hourly between 8 AM and 11 PM
$Trigger = New-ScheduledTaskTrigger `
    -Daily `
    -At "08:00AM"

# For recurring intervals within the day:
$Trigger.RepetitionInterval = (New-TimeSpan -Hours 1)
$Trigger.RepetitionDuration = (New-TimeSpan -Hours 15)

# 3. Settings: Hidden, bounded execution, sleep recovery
$Settings = New-ScheduledTaskSettingsSet `
    -Hidden `
    -WakeToRun `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -MultipleInstancesPolicy IgnoreNew `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5)

# 4. Principal: Service-for-User (S4U) unattended execution
$Principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType S4U `
    -RunLevel LeastPrivilege

# 5. Register Task
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "Automated background sync task for Leonidas AIOS." `
    -Force
```

---

## Window Hiding & Silent Execution

Even with `-WindowStyle Hidden`, `pwsh.exe` or `powershell.exe` can momentarily flash a console window when spawning from an interactive desktop session.

### The 3-Tier Hiding Standard:

1. **Primary Standard:** Set `Hidden: true` in `New-ScheduledTaskSettingsSet` and pass `-WindowStyle Hidden` in the action arguments.
2. **Zero-Flash Standard (Background Services):** Use `pythonw.exe` (installed at `C:\Python314\pythonw.exe`) for Python scripts. `pythonw.exe` has no console subsystem and never flashes.
3. **VBScript Shim (for legacy console tools):** If a CLI utility cannot be suppressed via flags, call it via a 2-line VBS wrapper:
   ```vbscript
   Set WshShell = CreateObject("WScript.Shell")
   WshShell.Run "pwsh.exe -NoProfile -File ""D:\Leonidas AIOS\scripts\job.ps1""", 0, False
   ```

---

## Task Management & Diagnostics

Inspect and test tasks directly from the terminal:

```powershell
# List all Leonidas registered tasks
Get-ScheduledTask -TaskName "Leonidas-*"

# View detailed operational state and last run result
Get-ScheduledTaskInfo -TaskName "Leonidas-Queue-Sync"

# Manually trigger task execution
Start-ScheduledTask -TaskName "Leonidas-Queue-Sync"

# View task scheduler event logs for failure investigation
Get-WinEvent -LogName "Microsoft-Windows-TaskScheduler/Operational" -MaxEvents 20 |
    Where-Object { $_.Message -match "Leonidas" } |
    Format-Table TimeCreated, Id, Message -Wrap
```
