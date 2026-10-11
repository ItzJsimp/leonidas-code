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
# Core skills link from the AIOS canon into every workspace; a workspace's own folder of the same name wins.
foreach ($name in @('session-handoff', 'implement')) {
    New-Item -ItemType Directory -Path (Join-Path $fixture ".agents/skills/$name") -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $fixture ".agents/skills/$name/SKILL.md") "---`nname: $name`n---"
}
New-Item -ItemType Directory -Path (Join-Path $other '.agents/skills/implement') -Force | Out-Null
Set-Content -LiteralPath (Join-Path $other '.agents/skills/implement/SKILL.md') 'Game owned implement'
git -C $fixture init --quiet
Assert ($LASTEXITCODE -eq 0) 'Fixture git initialization failed'
& $install -AiosRoot $fixture
Assert ((Get-Item -LiteralPath (Join-Path $project '.agents/skills/session-handoff')).LinkType -eq 'Junction') 'Core skill was not linked into a project'
Assert (Test-Path -LiteralPath (Join-Path $project '.claude/skills/session-handoff/SKILL.md')) 'Linked core skill is not discoverable to Claude'
Assert ((Get-Content -LiteralPath (Join-Path $other '.agents/skills/implement/SKILL.md') -Raw).Trim() -eq 'Game owned implement') 'Project-owned skill was overwritten by the core link'
Assert ((Get-Item -LiteralPath (Join-Path $other '.claude/skills/implement')).LinkType -eq 'Junction') 'Project-owned core skill was not exposed to Claude by its adapter'
Assert ((Get-Content -LiteralPath (Join-Path $fixture '.git/info/exclude') -Raw) -match '(?m)^/projects/game/\.agents/skills/session-handoff/$') 'Core link is not excluded from the enclosing repository'
Write-Host '[PASS] Core skills linked from the AIOS canon, discoverable to Claude, project-owned copies kept'

# Test automatic parent detection with the exact projects/leonidas-code layout.
New-Item -ItemType Directory -Path (Join-Path $project 'scripts'),(Join-Path $project '.agents/skills') -Force | Out-Null
foreach ($script in @('Install-NextAction.ps1','Sync-DefaultSkills.ps1','Start-NextActionSession.ps1')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $script) -Destination (Join-Path $project 'scripts') -Force
}
& (Join-Path $project 'scripts/Install-NextAction.ps1')
$cached = Get-Content -LiteralPath (Join-Path $fixture '.agents/next-action.json') -Raw | ConvertFrom-Json
Assert ($cached.tasks_dir -eq 'tasks') 'Cached folder is not relative to the AIOS'
Write-Host '[PASS] Mob layout, existing provider-copy migration, backups, discovery, cache reuse, repeated installs and WhatIf'
Write-Host "Fixture: $fixture"

# Exercise the exact Codex command from a nested directory in a path containing spaces.
$hookProject = Join-Path $fixture 'Code hook fixture'
New-Item -ItemType Directory -Path (Join-Path $hookProject 'scripts/nested'),(Join-Path $hookProject '.agents/skills') -Force | Out-Null
Set-Content -LiteralPath (Join-Path $hookProject 'AGENTS.md') 'Hook fixture instructions'
foreach ($script in @('Install-NextAction.ps1','Sync-DefaultSkills.ps1','Start-NextActionSession.ps1')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $script) -Destination (Join-Path $hookProject 'scripts')
}
Copy-Item -LiteralPath (Join-Path $source '.agents/skills/next-action') -Destination (Join-Path $hookProject '.agents/skills') -Recurse
git -C $hookProject init --quiet
Assert ($LASTEXITCODE -eq 0) 'Hook fixture git initialization failed'
$hook = Get-Content -LiteralPath (Join-Path $source '.codex/hooks.json') -Raw | ConvertFrom-Json
$group = $hook.hooks.SessionStart[0]
foreach ($event in @('startup','resume','clear')) { Assert ($event -match $group.matcher) "Hook misses $event" }
Assert ('compact' -notmatch $group.matcher) 'Installation reruns during compaction'
Push-Location (Join-Path $hookProject 'scripts/nested')
try {
    $result = (& pwsh -NoProfile -Command $group.hooks[0].command | Out-String) | ConvertFrom-Json
    Assert ($LASTEXITCODE -eq 0) 'Codex hook command failed from a nested directory'
    Assert ($result.hookSpecificOutput.hookEventName -eq 'SessionStart') 'Wrong hook event in output'
    Assert ($result.hookSpecificOutput.additionalContext -match '\[PASS\]') 'Hook output lost installation verification'
} finally { Pop-Location }
Assert (Test-Path -LiteralPath (Join-Path $hookProject '.claude/skills/next-action/SKILL.md')) 'Hook did not install provider discovery'
Write-Host '[PASS] Codex startup/resume matcher and exact hook command from a nested path with spaces'
Set-Content -LiteralPath (Join-Path $hookProject 'scripts/Install-NextAction.ps1') "throw 'Fixture installation failure'"
Push-Location $hookProject
try {
    $failedOutput = & pwsh -NoProfile -Command $group.hooks[0].command 2>$null | Out-String
    Assert ($LASTEXITCODE -ne 0) 'Hook masked an installation failure'
    Assert ($failedOutput -notmatch 'hookSpecificOutput') 'Failed installation reported successful context'
} finally { Pop-Location }
Write-Host '[PASS] Codex hook preserves installation failures'
