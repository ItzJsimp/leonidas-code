#Requires -Version 7.0
<#
.SYNOPSIS
    Install the portable next-action default in an AIOS and its existing projects.
.DESCRIPTION
    Re-run after updating the AIOS skills. Changed destination files are backed up;
    project instructions and user task data are preserved. New-Project calls this
    for new projects. Use -ProjectPath to install in a standalone project.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$RepoPath = (Join-Path $PSScriptRoot '..'),
    [string]$SourceRoot = (Join-Path $PSScriptRoot '..'),
    [string]$ProjectPath
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath $RepoPath).Path
$source = Join-Path (Resolve-Path -LiteralPath $SourceRoot).Path '.agents/skills/next-action'
if (-not (Test-Path -LiteralPath (Join-Path $source 'SKILL.md'))) { throw "Missing default skill: $source" }
$targets = @($repo)
if ($ProjectPath) { $targets = @((Resolve-Path -LiteralPath $ProjectPath).Path) }
elseif (Test-Path -LiteralPath (Join-Path $repo 'projects')) {
    $targets += @(Get-ChildItem -LiteralPath (Join-Path $repo 'projects') -Directory |
        Where-Object { $_.Name -notmatch '^[._]' -and
            ((Test-Path -LiteralPath (Join-Path $_.FullName 'project.md')) -or
             (Test-Path -LiteralPath (Join-Path $_.FullName 'AGENTS.md')) -or
             (Test-Path -LiteralPath (Join-Path $_.FullName '.git')) -or
             (Test-Path -LiteralPath (Join-Path $_.FullName 'agent-playbook.md'))) } |
        ForEach-Object { $_.FullName })
}
$updated = 0
function Copy-DefaultSkill([string]$Destination, [string]$Backup) {
    foreach ($file in Get-ChildItem -LiteralPath $source -File -Recurse | Where-Object { $_.Name -notlike '*.pyc' -and $_.FullName -notmatch '__pycache__' }) {
        $relative = [IO.Path]::GetRelativePath($source, $file.FullName)
        $dest = Join-Path $Destination $relative
        if ((Test-Path -LiteralPath $dest) -and ((Get-FileHash -LiteralPath $dest).Hash -eq (Get-FileHash -LiteralPath $file.FullName).Hash)) { continue }
        if ($PSCmdlet.ShouldProcess($dest, 'Install default next-action skill, backing up changes')) {
            if (Test-Path -LiteralPath $dest) {
                $save = Join-Path $Backup $relative
                New-Item -ItemType Directory -Path (Split-Path $save) -Force | Out-Null
                [IO.File]::WriteAllText((Join-Path $target '.aios-backups/.gitignore'), "*`n")
                Copy-Item -LiteralPath $dest -Destination $save
            }
            New-Item -ItemType Directory -Path (Split-Path $dest) -Force | Out-Null
            Copy-Item -LiteralPath $file.FullName -Destination $dest -Force
            $script:updated++
        }
    }
}
foreach ($target in $targets | Select-Object -Unique) {
    $destination = Join-Path $target '.agents/skills/next-action'
    $backup = Join-Path $target ('.aios-backups/next-action-' + (Get-Date -Format 'yyyyMMdd-HHmmss-ffff'))
    Copy-DefaultSkill $destination $backup
    $adapter = Join-Path $target '.claude/skills/next-action'
    if ($PSCmdlet.ShouldProcess($adapter, 'Make default skill discoverable to the Claude provider')) {
        if (-not (Test-Path -LiteralPath $adapter)) {
            New-Item -ItemType Directory -Path (Split-Path $adapter) -Force | Out-Null
            $ignore = Join-Path (Split-Path $adapter) ".gitignore"
            if (-not (Test-Path -LiteralPath $ignore)) { [IO.File]::WriteAllText($ignore, "*`n!.gitignore`n") }
            if ($IsWindows) { New-Item -ItemType Junction -Path $adapter -Target $destination | Out-Null }
            else { New-Item -ItemType SymbolicLink -Path $adapter -Target $destination | Out-Null }
        } elseif (-not (Get-Item -LiteralPath $adapter).LinkType -and -not (Get-Item -LiteralPath (Split-Path $adapter)).LinkType) {
            Copy-DefaultSkill $adapter (Join-Path $backup "provider-copy")
        }
    }
}
Write-Host "[OK] Updated $updated default skill files across $($targets.Count) workspace(s)."
