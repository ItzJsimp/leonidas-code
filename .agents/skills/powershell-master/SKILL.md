---
name: powershell-master
description: "Expert PowerShell 7+ automation: robust cmdlets, pipeline tuning, -LiteralPath safety, and AST parsing."
category: pc
scope: structural
distribution: core
type: skill
id: skill-powershell-master
title: "PowerShell Master : Scripting & Automation Expert"
kind: procedure
load: on-demand
owner: shared
verified: 2026-08-21
related: ["skills-index", "windows-debloat", "pc-systems-engineer", "drive-taxonomy"]
generated: false
disable-model-invocation: true
license: MIT
---

# PowerShell Master

Comprehensive PowerShell 7+ expertise system across Windows, Linux, and macOS for scripting, scheduled task automation, CI/CD, and systems management.

---

## When to Activate

PROACTIVELY activate for ANY PowerShell-related task:

- **PowerShell Scripts & Tasks**: Creating, reviewing, and optimizing `.ps1` files and scheduled tasks.
- **Filesystem & Drive Operations**: Safe batch file processing with `-LiteralPath` and UTF-8 encoding.
- **Cmdlets & Modules**: Finding, installing, and managing PowerShell modules via `PSResourceGet` / `PSGallery`.
- **System Administration**: Windows administration, service tuning, registry manipulation, and performance profiling.
- **Cross-Platform Scripting**: Scripts targeting PowerShell 7+ (`pwsh`) across Windows and Linux/macOS.
- **Script Debugging & Optimization**: Performance profiling (`Measure-Command`), pipeline optimization, and strict error handling (`$ErrorActionPreference = "Stop"`).

---

## Reference Map

Detailed reference material lives in [`references/`](./references/). Load only what the current task needs.

| Topic                     | File                                                                               | When to Load                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Cross-platform patterns   | [`references/cross-platform-patterns.md`](./references/cross-platform-patterns.md) | Writing scripts that run on Windows + Linux/macOS, or distinguishing PowerShell vs Git Bash |
| Module management         | [`references/modules-and-gallery.md`](./references/modules-and-gallery.md)         | Installing/finding modules, Az, Microsoft.Graph, PnP, AWS Tools, offline installs           |
| CI/CD pipelines           | [`references/cicd-integration.md`](./references/cicd-integration.md)               | Setting up automated PowerShell builds/tests with multi-platform matrices                   |
| Syntax & cmdlet reference | [`references/syntax-reference.md`](./references/syntax-reference.md)               | Authoring scripts, looking up cmdlets, writing Pester tests, performance tuning             |
| Security & hardening      | [`references/security-2025.md`](./references/security-2025.md)                     | Production security hardening, credential management, audit logging                         |

---

## AIOS & Windows Execution Standards

1. **Always use `-LiteralPath`**: Required by AIOS canon ([`standards/drive-taxonomy.md`](../../../standards/drive-taxonomy.md)). Prevents wildcard expansion on paths with spaces, brackets, or emojis.
2. **UTF-8 BOM encoding**: Ensure all `.ps1` files are saved with UTF-8 BOM so legacy 5.1 and modern 7+ both parse characters without mojibake.
3. **Explicit `pwsh.exe` invocation**: For scheduled tasks and background jobs, invoke explicit `pwsh.exe` rather than generic `powershell.exe`.
4. **Dry-Run default**: Include `-WhatIf` / `-Confirm` support on any script performing file moves or deletions.

---

## Minimal Script Skeleton

```powershell
#Requires -Version 7.0

<#
.SYNOPSIS
    Brief description of the script
.DESCRIPTION
    Detailed description
.PARAMETER Path
    Target directory path
.EXAMPLE
    PS> .\Invoke-Task.ps1 -Path "D:\1-Business"
#>

[CmdletBinding(SupportsShouldProcess=$true)]
param(
    [Parameter(Mandatory=$true, ValueFromPipeline=$true)]
    [ValidateNotNullOrEmpty()]
    [string]$Path
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

try {
    Write-Verbose "Starting execution on: $Path"
    if ($PSCmdlet.ShouldProcess($Path, "Process Action")) {
        # Main execution logic
        Get-ChildItem -LiteralPath $Path -File | ForEach-Object {
            Write-Verbose "Processing: $($_.FullName)"
        }
    }
    Write-Verbose "Completed successfully."
}
catch {
    Write-Error "Execution failed: $_"
    exit 1
}
finally {
    # Cleanup if needed
}
```
