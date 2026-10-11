#Requires -Version 7.0
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('mob-next-action-' + [guid]::NewGuid().ToString('N'))
function Assert([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
$project = Join-Path $fixture 'projects/leonidas-code'
$other = Join-Path $fixture 'projects/game'
foreach ($folder in @($project, $other, (Join-Path $fixture 'tasks'), (Join-Path $fixture '.claude/skills/next-action'))) {
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
}
Set-Content -LiteralPath (Join-Path $fixture 'AGENTS.md') 'Mob custom instructions'
Set-Content -LiteralPath (Join-Path $project 'AGENTS.md') 'Code project instructions'
Set-Content -LiteralPath (Join-Path $other 'project.md') 'Game project ledger'
Set-Content -LiteralPath (Join-Path $fixture 'tasks/keep.md') 'Mob private task data'
Set-Content -LiteralPath (Join-Path $fixture '.claude/skills/next-action/SKILL.md') 'Old real provider skill copy'
$install = Join-Path $PSScriptRoot 'Install-NextAction.ps1'
& $install -AiosRoot $fixture -WhatIf
Assert (-not (Test-Path -LiteralPath (Join-Path $fixture '.agents/skills/next-action'))) 'WhatIf wrote a canonical skill'
& $install -AiosRoot $fixture
$skill = Join-Path $fixture '.agents/skills/next-action/SKILL.md'
$first = (Get-Item -LiteralPath $skill).LastWriteTimeUtc
& $install -AiosRoot $fixture
Assert ((Get-Item -LiteralPath $skill).LastWriteTimeUtc -eq $first) 'Second install rewrote an unchanged skill'
Assert ((Get-Content -LiteralPath (Join-Path $fixture 'AGENTS.md') -Raw).Trim() -eq 'Mob custom instructions') 'Personal instructions changed'
Assert ((Get-Content -LiteralPath (Join-Path $fixture 'tasks/keep.md') -Raw).Trim() -eq 'Mob private task data') 'Task data changed'
Assert ((Get-FileHash -LiteralPath $skill).Hash -eq (Get-FileHash -LiteralPath (Join-Path $fixture '.claude/skills/next-action/SKILL.md')).Hash) 'Existing provider copy stayed stale'
$backups = @(Get-ChildItem -LiteralPath (Join-Path $fixture '.aios-backups') -Filter SKILL.md -File -Recurse)
Assert ($backups.Count -eq 1) 'Old provider copy was not backed up exactly once'
Assert ((Get-Content -LiteralPath $backups[0].FullName -Raw).Trim() -eq 'Old real provider skill copy') 'Provider backup lost old content'
Assert (Test-Path -LiteralPath (Join-Path $fixture 'scripts/Sync-DefaultSkills.ps1')) 'AIOS future updater missing'
foreach ($workspace in @($fixture,$project,$other)) {
    Assert (Test-Path -LiteralPath (Join-Path $workspace '.agents/skills/next-action/scripts/resolve_tasks.py')) 'Workspace resolver missing'
    Assert (Test-Path -LiteralPath (Join-Path $workspace '.claude/skills/next-action/SKILL.md')) 'Provider discovery missing'
}
# Test automatic parent detection with the exact projects/leonidas-code layout.
New-Item -ItemType Directory -Path (Join-Path $project 'scripts'),(Join-Path $project '.agents/skills') -Force | Out-Null
foreach ($script in @('Install-NextAction.ps1','Sync-DefaultSkills.ps1')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $script) -Destination (Join-Path $project 'scripts') -Force
}
& (Join-Path $project 'scripts/Install-NextAction.ps1')
$cached = Get-Content -LiteralPath (Join-Path $fixture '.agents/next-action.json') -Raw | ConvertFrom-Json
Assert ($cached.tasks_dir -eq 'tasks') 'Cached folder is not relative to the AIOS'
Write-Host '[PASS] Mob layout, existing provider-copy migration, backups, discovery, cache reuse, repeated installs and WhatIf'
Write-Host "Fixture: $fixture"
