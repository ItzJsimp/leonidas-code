<#
.SYNOPSIS
  Lists processes that have been pegging a CPU core for over an hour. Reports only; never stops anything.
.DESCRIPTION
  A process is flagged when it is older than -MinAgeMinutes and its total CPU time is at least
  -MinCoreShare of its lifetime (0.5 = averaged half a core since it started). Idle servers and
  short bursts stay below that. Each row carries the command line and the exact Stop-Process
  line to run once you have confirmed it is yours to stop.
#>
[CmdletBinding()]
param([int]$MinAgeMinutes = 60, [double]$MinCoreShare = 0.5)

$now = Get-Date
$names = @{}
$procs = Get-Process | Where-Object { $_.Id -gt 4 -and $_.Name -notin 'Idle', 'System', 'MsMpEng' }
$found = foreach ($p in $procs) {
    try { $start = $p.StartTime; $cpu = $p.CPU } catch { continue }
    if ($null -eq $start) { continue }
    $ageSeconds = ($now - $start).TotalSeconds
    if ($ageSeconds -lt ($MinAgeMinutes * 60) -or $null -eq $cpu) { continue }
    $share = $cpu / $ageSeconds
    if ($share -lt $MinCoreShare) { continue }
    $cim = Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)" -ErrorAction SilentlyContinue
    [pscustomobject]@{
        Id          = $p.Id
        Name        = $p.Name
        AgeHours    = [math]::Round($ageSeconds / 3600, 1)
        CoreShare   = [math]::Round($share, 2)
        Parent      = $cim.ParentProcessId
        CommandLine = if ($cim.CommandLine) { $cim.CommandLine.Substring(0, [math]::Min(200, $cim.CommandLine.Length)) } else { '' }
    }
}
$found = @($found | Sort-Object CoreShare -Descending)
if ($found.Count -eq 0) { Write-Output 'No runaway processes.'; return }
Write-Output "$($found.Count) process(es) averaging over $MinCoreShare of a core for over $MinAgeMinutes minutes:"
foreach ($f in $found) {
    Write-Output ("  pid {0} {1}, up {2} h, {3} cores, parent {4}: {5}" -f $f.Id, $f.Name, $f.AgeHours, $f.CoreShare, $f.Parent, $f.CommandLine)
    Write-Output ("    stop it with: Stop-Process -Id {0}   (check the command line first)" -f $f.Id)
}
