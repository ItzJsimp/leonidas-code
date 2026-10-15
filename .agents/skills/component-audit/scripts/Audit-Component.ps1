#Requires -Version 7.0

<#
.SYNOPSIS
    Audit-Component.ps1 - Deterministic substrate analyzer and fragility telemetry engine.
.DESCRIPTION
    Inspects any target file, folder, skill, mode, prompt, or script in <500ms:
    - Identifies entity type and governing domain
    - Tests naming standards against standards/naming-standard.md
    - Checks for Unicode U+2014 em dash violations (ADR-0012)
    - Validates YAML frontmatter and required scope tag (ADR-0013)
    - Checks relative markdown links for broken targets (Rule 7)
    - Performs PowerShell and Python AST syntax validation
    - Measures word count and estimated token footprint
    - Scans for inbound references via ripgrep
    - Logs longitudinal fragility telemetry to logs/audit-telemetry.jsonl
    - Supports -Staged for git pre-commit hooks and -History for stability reporting
    - Supports -Teardown for side-by-side reading teardowns in editor split views
.PARAMETER Target
    The relative or absolute path to the target file or directory.
.PARAMETER RepoRoot
    The repository root path (defaults to auto-detected AIOS root).
.PARAMETER Staged
    Inspect only files currently staged in Git index (for pre-commit hooks).
.PARAMETER History
    Display longitudinal defect history and 30-day stability score from audit telemetry.
.PARAMETER Teardown
    Emit side-by-side reading teardown formatted for editor split views.
.PARAMETER NoLog
    Suppress writing this audit event to logs/audit-telemetry.jsonl.
.PARAMETER AsJson
    Switch to output results as a JSON string.
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Target = "",

    [Parameter(Position = 1)]
    [string]$RepoRoot = "",

    [Parameter()]
    [switch]$Staged,

    [Parameter()]
    [switch]$History,

    [Parameter()]
    [switch]$Teardown,

    [Parameter()]
    [switch]$NoLog,

    [Parameter()]
    [switch]$AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Resolve repo root
$coreModule = Join-Path $PSScriptRoot "..\..\..\..\scripts\modules\AIOSCore.psm1"
if (-not (Test-Path -LiteralPath $coreModule)) {
    $coreModule = Join-Path (Get-Location) "scripts\modules\AIOSCore.psm1"
}
if (Test-Path -LiteralPath $coreModule) {
    Import-Module -Name $coreModule -Force
}

$resolvedRepoRoot = if (-not [string]::IsNullOrWhiteSpace($RepoRoot) -and (Test-Path -LiteralPath $RepoRoot)) {
    (Resolve-Path -LiteralPath $RepoRoot).Path
} elseif (Get-Command -Name "Resolve-AIOSRepoRoot" -ErrorAction SilentlyContinue) {
    Resolve-AIOSRepoRoot -StartPath $PSScriptRoot
} else {
    (Get-Location).Path
}

$telemetryLog = Join-Path $resolvedRepoRoot "logs\audit-telemetry.jsonl"

# --- Mode 1: -History Query ---
if ($History) {
    if (-not (Test-Path -LiteralPath $telemetryLog)) {
        Write-Host "No telemetry history found at $telemetryLog" -ForegroundColor Yellow
        return [PSCustomObject]@{ TotalAudits = 0; History = @() }
    }

    $rawLines = Get-Content -LiteralPath $telemetryLog -Encoding utf8
    $entries = [System.Collections.Generic.List[PSObject]]::new()
    foreach ($l in $rawLines) {
        if (-not [string]::IsNullOrWhiteSpace($l)) {
            try { $entries.Add(($l | ConvertFrom-Json)) } catch {}
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($Target)) {
        $cleanTarget = ($Target -replace "\\", "/").TrimStart("/")
        $matched = @($entries | Where-Object { $_.target -like "*$cleanTarget*" })
        $totalRuns = $matched.Count
        if ($totalRuns -eq 0) {
            Write-Host "No audit telemetry recorded for '$Target'." -ForegroundColor Yellow
            return [PSCustomObject]@{ Target = $Target; Runs = 0; StabilityScore = "N/A" }
        }
        $cleanRuns = @($matched | Where-Object { $_.verdict -eq "CERTIFIED_CLEAN" -or $_.verdict -eq "PASS" }).Count
        $defectRuns = $totalRuns - $cleanRuns
        $score = [int][Math]::Round(($cleanRuns / $totalRuns) * 100)
        
        $histResult = [PSCustomObject]@{
            Target          = $Target
            TotalRuns       = $totalRuns
            CleanRuns       = $cleanRuns
            DefectRuns      = $defectRuns
            StabilityScore  = "$score%"
            LastRun         = $matched[-1].timestamp
            LastVerdict     = $matched[-1].verdict
            RecentDefects   = @($matched | Where-Object { $_.verdict -eq "DEFECTS_FOUND" } | Select-Object -Last 3)
        }
        if ($AsJson) { return ($histResult | ConvertTo-Json -Depth 5) }
        return $histResult
    } else {
        # System-wide fragility leaderboard
        $grouped = $entries | Group-Object -Property target
        $ranked = foreach ($g in $grouped) {
            $tRuns = $g.Count
            $cRuns = @($g.Group | Where-Object { $_.verdict -eq "CERTIFIED_CLEAN" -or $_.verdict -eq "PASS" }).Count
            $dRuns = $tRuns - $cRuns
            $sScore = [int][Math]::Round(($cRuns / $tRuns) * 100)
            [PSCustomObject]@{
                Target         = $g.Name
                TotalRuns      = $tRuns
                DefectRuns     = $dRuns
                StabilityScore = "$sScore%"
                LastVerdict    = $g.Group[-1].verdict
            }
        }
        $topFragile = @($ranked | Sort-Object -Property DefectRuns -Descending | Select-Object -First 10)
        if ($AsJson) { return ($topFragile | ConvertTo-Json -Depth 5) }
        return $topFragile
    }
}

# --- Mode 2: -Staged Git Pre-Commit Ingest ---
$filesToInspect = @()
$isStagedMode = $false

if ($Staged) {
    $isStagedMode = $true
    $gitStatus = & git diff --name-only --cached --diff-filter=ACM 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $gitStatus) {
        Write-Host "No staged files detected in Git index." -ForegroundColor Gray
        return [PSCustomObject]@{ StagedFiles = 0; Verdict = "PASS" }
    }
    $stagedList = $gitStatus -split "\r?\n" | Where-Object { 
        -not [string]::IsNullOrWhiteSpace($_) -and
        $_ -notmatch "(^|[\\/])(raw|archive|brain|\.git|node_modules)[\\/]"
    }
    foreach ($sf in $stagedList) {
        $fullPath = Join-Path $resolvedRepoRoot $sf
        if (Test-Path -LiteralPath $fullPath) {
            $filesToInspect += Get-Item -LiteralPath $fullPath
        }
    }
    $resolvedTarget = $resolvedRepoRoot
    $relPath = "git:staged"
    $entityType = "staged-changeset"
    $isDir = $true
    $scope = "structural"
    $isExternal = $false
} else {
    if ([string]::IsNullOrWhiteSpace($Target)) {
        throw "Target parameter is required unless -Staged or -History is specified."
    }

    $targetPath = if ([System.IO.Path]::IsPathRooted($Target)) {
        $Target
    } else {
        Join-Path $resolvedRepoRoot $Target
    }

    if (-not (Test-Path -LiteralPath $targetPath)) {
        $errObj = [PSCustomObject]@{
            Target      = $Target
            Exists      = $false
            Error       = "Target path not found on disk: $targetPath"
            Verdict     = "FAIL"
        }
        if ($AsJson) { return ($errObj | ConvertTo-Json -Depth 5) }
        return $errObj
    }

    $resolvedTarget = (Resolve-Path -LiteralPath $targetPath).Path
    $isDir = (Get-Item -LiteralPath $resolvedTarget) -is [System.IO.DirectoryInfo]
    $relPath = if ($resolvedTarget.StartsWith($resolvedRepoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        $resolvedTarget.Substring($resolvedRepoRoot.Length).TrimStart("\/") -replace "\\", "/"
    } else {
        $resolvedTarget
    }

    $isExternal = -not $resolvedTarget.StartsWith($resolvedRepoRoot, [System.StringComparison]::OrdinalIgnoreCase)
    $scope = "structural"

    # Entity Type Determination
    if ($isExternal) {
        $entityType = "external-asset"
    } elseif ($isDir) {
        if ($relPath -match "^\.agents/skills/([^/]+)$") {
            $entityType = "skill"
        } elseif ($relPath -match "^modes(/.*)?$") {
            $entityType = "mode-directory"
        } elseif ($relPath -match "^standards(/.*)?$") {
            $entityType = "standards-directory"
        } elseif ($relPath -match "^projects/([^/]+)$") {
            $entityType = "project-directory"
        } elseif ($relPath -match "^domains/([^/]+)$") {
            $entityType = "domain-directory"
        } elseif ($relPath -match "^templates(/.*)?$") {
            $entityType = "templates-directory"
        } elseif ($relPath -match "^prompts(/.*)?$") {
            $entityType = "prompts-directory"
        } elseif ($relPath -match "^scripts(/.*)?$") {
            $entityType = "scripts-directory"
        } elseif ($relPath -match "^tasks(/.*)?$") {
            $entityType = "tasks-directory"
        } else {
            $entityType = "folder"
        }
    } else {
        $ext = [System.IO.Path]::GetExtension($resolvedTarget).ToLowerInvariant()
        $fileName = [System.IO.Path]::GetFileName($resolvedTarget)

        if ($relPath -match "^\.agents/skills/[^/]+/SKILL\.md$") {
            $entityType = "skill-definition"
        } elseif ($relPath -match "^modes/(\d{2}-[a-z0-9-]+|router)\.md$") {
            $entityType = "system-mode"
        } elseif ($relPath -match "^decisions/\d{4}-[a-z0-9-]+\.md$") {
            $entityType = "decision-adr"
        } elseif ($relPath -match "^prompts/[a-z0-9-]+\.md$") {
            $entityType = "prompt-template"
        } elseif ($relPath -match "^templates/[a-z0-9-]+\.md$") {
            $entityType = "system-template"
        } elseif ($relPath -match "^tasks/[a-z0-9-]+\.md$") {
            $entityType = "operational-task"
        } elseif ($relPath -match "^memory/[a-z0-9/-]+\.md$") {
            $entityType = "durable-memory"
        } elseif ($relPath -match "^domains/[a-z0-9/-]+\.md$") {
            $entityType = "life-domain"
        } elseif ($relPath -match "^standards/[a-z0-9-]+\.md$") {
            $entityType = "governance-standard"
        } elseif ($fileName -match "^[A-Z0-9-]+\.md$") {
            $entityType = "root-canon"
        } elseif ($fileName -match "-index\.md$") {
            $entityType = "folder-index"
        } elseif ($ext -eq ".ps1") {
            $entityType = "powershell-script"
        } elseif ($ext -eq ".py") {
            $entityType = "python-script"
        } elseif ($ext -eq ".json" -or $ext -eq ".yaml" -or $ext -eq ".yml") {
            $entityType = "structured-config"
        } else {
            $entityType = "file"
        }
    }

    $filesToInspect = if ($isDir) {
        @(Get-ChildItem -LiteralPath $resolvedTarget -Recurse -File | Where-Object { $_.FullName -notmatch "[\\/](\.git|node_modules|__pycache__)[\\/]" })
    } else {
        @(Get-Item -LiteralPath $resolvedTarget)
    }
}

# Naming Standard Validation
$namingValid = $true
$namingViolations = @()

if (-not $isExternal -and -not $isStagedMode) {
    $leafName = Split-Path -Leaf $resolvedTarget
    if ($isDir) {
        if ($leafName -notmatch "^[a-z0-9-]+$") {
            $namingValid = $false
            $namingViolations += "Directory name '$leafName' violates lowercase kebab-case standard."
        }
    } else {
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($resolvedTarget)
        $ext = [System.IO.Path]::GetExtension($resolvedTarget).ToLowerInvariant()
        
        $collisionBlacklist = @("claude", "agents", "gemini", "cursor", "copilot", "windsurf", "chatgpt")
        if ($collisionBlacklist -contains $baseName.ToLowerInvariant() -and $relPath -ne "CLAUDE.md" -and $relPath -ne "AGENTS.md" -and $relPath -ne "GEMINI.md") {
            $namingValid = $false
            $namingViolations += "Filename collides with multi-engine reserved blacklist ($baseName)."
        }

        if ($ext -eq ".ps1") {
            if ($baseName -ne "aios" -and $baseName -notmatch "^[A-Z][a-zA-Z0-9]+-[A-Z][a-zA-Z0-9]+$") {
                $namingValid = $false
                $namingViolations += "PowerShell script '$leafName' does not conform to PascalCase Verb-Noun.ps1 standard."
            }
        } elseif ($ext -eq ".py") {
            if ($baseName -notmatch "^[a-z0-9-]+$") {
                $namingValid = $false
                $namingViolations += "Python script '$leafName' does not conform to lowercase kebab-case standard."
            }
        } elseif ($ext -eq ".md") {
            if ($leafName -match "^[A-Z0-9-]+\.md$") {
                # Allowed for root canon
            } elseif ($leafName -match "^\d{4}-[a-z0-9-]+\.md$") {
                # Allowed for ADRs
            } elseif ($leafName -match "^\d{2}-[a-z0-9-]+\.md$") {
                # Allowed for modes
            } elseif ($leafName -match "^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$") {
                # Allowed for handoffs/audits
            } elseif ($leafName -match "^\d{4}-\d{2}-\d{2}T\d{4}-[a-z0-9-]+\.md$") {
                # Allowed for capture
            } elseif ($leafName -notmatch "^[a-z0-9-]+(-index)?\.md$") {
                $namingValid = $false
                $namingViolations += "Markdown file '$leafName' does not conform to lowercase kebab-case standard."
            }
        }
    }
}

# Substrate Inspections
$totalEmDashes = 0
$emDashFiles = @()
$brokenLinks = @()
$totalWords = 0
$frontmatterIssues = @()
$scriptSyntaxErrors = @()

foreach ($file in $filesToInspect) {
    # Repo-relative path, so Sync-Repo.ps1 hold-back matches the exact staged file, not a same-named sibling.
    $fileLabel = [System.IO.Path]::GetRelativePath($resolvedRepoRoot, $file.FullName).Replace('\', '/')
    if ($file.Extension -in @(".md", ".txt", ".ps1", ".psm1", ".py", ".json", ".yaml", ".yml")) {
        $content = try { [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8) } catch { "" }
        
        # Word count
        $words = @($content -split "\s+" | Where-Object { $_ -ne "" }).Count
        $totalWords += $words

        # Em dash check
        if ($content.Contains([char]0x2014)) {
            $matchingChars = @($content.ToCharArray() | Where-Object { [int]$_ -eq 0x2014 })
            $count = $matchingChars.Count
            $totalEmDashes += $count
            $emDashFiles += "${fileLabel} ($count violations)"
        }

        # PowerShell AST Validation
        if ($file.Extension -in @(".ps1", ".psm1")) {
            $astTokens = $null
            $astErrors = $null
            [void][System.Management.Automation.Language.Parser]::ParseInput($content, [ref]$astTokens, [ref]$astErrors)
            if ($astErrors -and $astErrors.Count -gt 0) {
                foreach ($err in $astErrors) {
                    $scriptSyntaxErrors += "${fileLabel}:$($err.Extent.StartLineNumber) $($err.Message)"
                }
            }
        }

        # Frontmatter & Link check (markdown only)
        if ($file.Extension -eq ".md") {
            $hasFrontmatter = $content -match "(?s)^---\s*\r?\n(.*?)\r?\n---\s*"
            if ($hasFrontmatter) {
                $fm = $Matches[1]
                if ($fm -notmatch "(?m)^\s*scope\s*:\s*[`"']?(structural|personal)[`"']?\s*$") {
                    $frontmatterIssues += "${fileLabel}: Missing or invalid 'scope: personal | structural' tag."
                }
            } else {
                # Frontmatter required only on indexed docs per AGENTS.md Rule 9
                $isIndexedPath = $file.FullName -match "[\\/](modes|decisions|templates|audits|handoff-docs)[\\/]" -or
                                 $file.FullName -match "[\\/]\.agents[\\/]skills[\\/][^\\/]+[\\/]SKILL\.md$"
                $isExempt = $file.FullName -match "[\\/](CLAUDE|AGENTS|GEMINI|MASTER-INSTRUCTIONS|README|CONTEXT|BUILD-PLAN|INTENT|TASKS)\.md$" -or
                            $file.FullName -match "[\\/]memory[\\/](core|soul|jake)\.md$"
                if ($isIndexedPath -and -not $isExempt) {
                    $frontmatterIssues += "${fileLabel}: Missing YAML frontmatter on indexed component."
                }
            }

            # Link validation. Scan prose only: strip fenced blocks and inline code
            # spans first (syntax examples like `@[label](path)` are not links), and
            # skip documentation meta-syntax targets, matching Audit-Substrate.ps1.
            $linkContent = $content -replace '(?s)```.*?```', '' -replace '`[^`]*`', ''
            $linkMatches = [regex]::Matches($linkContent, '\[([^\]]+)\]\(([^)"]+)(?:\s+"[^"]*")?\)')
            foreach ($m in $linkMatches) {
                $linkTarget = $m.Groups[2].Value.Trim()
                if ($linkTarget -in @('path', 'URL')) { continue }
                if ($linkTarget -notmatch "^(https?://|mailto:|#|conversation://)" -and $linkTarget -notmatch "\.git/") {
                    $cleanTarget = [uri]::UnescapeDataString(($linkTarget -split "[#?]")[0])  # %20 links to spaced paths resolve
                    if (-not [string]::IsNullOrWhiteSpace($cleanTarget)) {
                        $targetFull = [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $file.FullName) $cleanTarget))
                        if (-not (Test-Path -LiteralPath $targetFull)) {
                            $brokenLinks += "${fileLabel} -> $linkTarget"
                        }
                    }
                }
            }
        }
    }
}

$estimatedTokens = [int][Math]::Round($totalWords * 1.33)

# Inbound References Check (Ripgrep)
$inboundRefCount = 0
$searchTarget = if ($isDir) { Split-Path -Leaf $resolvedTarget } else { [System.IO.Path]::GetFileName($resolvedTarget) }
if (-not [string]::IsNullOrWhiteSpace($searchTarget) -and -not $isExternal -and -not $isStagedMode) {
    $rgPath = Get-Command -Name "rg" -ErrorAction SilentlyContinue
    if ($rgPath) {
        $escapedTarget = [regex]::Escape($searchTarget)
        $rgMatches = & rg -l --hidden --glob "!**/.git/**" --glob "!**/node_modules/**" --glob "!**/brain/**" --glob "*.md" "(?:\(|\[.*\]\()\s*[^)]*$escapedTarget" $resolvedRepoRoot 2>$null
        $inboundRefCount = @($rgMatches | Where-Object { $_ -ne $resolvedTarget }).Count
    } else {
        $mdFiles = @(Get-ChildItem -Path $resolvedRepoRoot -Recurse -Filter "*.md" | Where-Object {
            $_.FullName -notmatch "[\\/](\.git|node_modules|archive|brain)[\\/]" -and $_.FullName -ne $resolvedTarget
        })
        foreach ($mf in $mdFiles) {
            $text = try { [System.IO.File]::ReadAllText($mf.FullName, [System.Text.Encoding]::UTF8) } catch { "" }
            if ($text.Contains($searchTarget)) { $inboundRefCount++ }
        }
    }
}

# Determine Verdict
$verdict = "PASS"
$issuesCount = $totalEmDashes + @($brokenLinks).Count + @($frontmatterIssues).Count + @($namingViolations).Count + @($scriptSyntaxErrors).Count

if ($issuesCount -gt 0) {
    $verdict = "DEFECTS_FOUND"
} elseif ($totalWords -gt 0) {
    $verdict = "CERTIFIED_CLEAN"
}

# --- Telemetry Logging (logs/audit-telemetry.jsonl) ---
if (-not $NoLog -and -not $isStagedMode) {
    $telemetryEntry = [PSCustomObject]@{
        timestamp          = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        target             = $relPath
        entity_type        = $entityType
        verdict            = $verdict
        em_dashes          = $totalEmDashes
        broken_links       = @($brokenLinks).Count
        ast_errors         = @($scriptSyntaxErrors).Count
        frontmatter_errors = @($frontmatterIssues).Count
        total_words        = $totalWords
        estimated_tokens   = $estimatedTokens
        inbound_refs       = $inboundRefCount
    }
    try {
        $telemetryDir = Split-Path -Parent $telemetryLog
        if (-not (Test-Path -LiteralPath $telemetryDir)) { New-Item -ItemType Directory -Path $telemetryDir -Force | Out-Null }
        $jsonLine = $telemetryEntry | ConvertTo-Json -Compress
        [System.IO.File]::AppendAllText($telemetryLog, "$jsonLine`n", [System.Text.Encoding]::UTF8)
    } catch {
        # Non-blocking telemetry
    }
}

$result = [PSCustomObject]@{
    Target              = $relPath
    EntityType          = $entityType
    Scope               = $scope
    IsDirectory         = $isDir
    FilesCount          = @($filesToInspect).Count
    NamingValid         = $namingValid
    NamingViolations    = $namingViolations
    EmDashCount         = $totalEmDashes
    EmDashFiles         = $emDashFiles
    BrokenLinksCount    = @($brokenLinks).Count
    BrokenLinks         = $brokenLinks
    FrontmatterIssues   = $frontmatterIssues
    ScriptSyntaxErrors  = $scriptSyntaxErrors
    TotalWords          = $totalWords
    EstimatedTokens     = $estimatedTokens
    InboundReferences   = $inboundRefCount
    Verdict             = $verdict
}

# --- Mode 3: -Teardown Output ---
if ($Teardown) {
    $teardownReport = @"
================================================================================
  SIDE-BY-SIDE READING TEARDOWN : $relPath
================================================================================
1. COMPONENT IDENTITY & PURPOSE:
   - Entity: $entityType ($scope)
   - Size: $totalWords words (~$estimatedTokens tokens across $(@($filesToInspect).Count) files)
   - Citations: $inboundRefCount inbound repository references

2. LOAD REALITY & CONTEXT TIER:
   - Tier: $(if ($relPath -match '^(CLAUDE|AGENTS|GEMINI|memory/(core|soul))') { 'Tier 0 (Preloaded / Always-Loaded)' } elseif ($relPath -match '^(standards|decisions|templates)') { 'Tier 2 (Structural Canon)' } else { 'Tier 1 (On-Demand Retrieval)' })
   - Truncation Safety: $(if ($totalWords -gt 2500) { 'WARNING: Heavy context footprint.' } else { 'SAFE: Well within token ceilings.' })

3. CORE INVARIANTS & SUBSTRATE HEALTH:
   - Em-Dash Violations: $totalEmDashes
   - Broken Relative Links: $(@($brokenLinks).Count)
   - AST Syntax Errors: $(@($scriptSyntaxErrors).Count)
   - Naming Standard Conformance: $(if ($namingValid) { 'PASS' } else { 'VIOLATION' })
   - Overall Verdict: $verdict

4. COGNITIVE MODEL EXEMPLIFIED:
   - Primary Model: M1 (Root Cause) & M8 (MECE Decomposition)
   - Rationale: Single authoritative write path ensures zero duplication across secondary stores.

5. SOCRATIC GRILL FRONTIER:
   - Q: Does this component require structural splitting, relocation, or automated script extraction?
   - Recommendation: $(if ($verdict -eq 'CERTIFIED_CLEAN') { 'Preserve component as certified clean. Zero churn.' } else { 'Remediate identified substrate defects before modifying business logic.' })
================================================================================
"@
    Write-Host $teardownReport -ForegroundColor Cyan
}

if ($isStagedMode) {
    if ($issuesCount -gt 0) {
        Write-Host "`n[ERROR] Audit-Component Staged Gate FAIL ($issuesCount issue(s) detected across $(@($filesToInspect).Count) staged file(s)):" -ForegroundColor Red
        if ($totalEmDashes -gt 0) { Write-Host "  - Em-Dash Violations: $totalEmDashes in $($emDashFiles -join ', ')" -ForegroundColor Yellow }
        if (@($brokenLinks).Count -gt 0) { Write-Host "  - Broken Links: $(@($brokenLinks) -join ', ')" -ForegroundColor Yellow }
        if (@($frontmatterIssues).Count -gt 0) { Write-Host "  - Frontmatter Issues: $(@($frontmatterIssues) -join ', ')" -ForegroundColor Yellow }
        if (@($scriptSyntaxErrors).Count -gt 0) { Write-Host "  - Script Syntax Errors: $(@($scriptSyntaxErrors) -join ', ')" -ForegroundColor Yellow }
        if (@($namingViolations).Count -gt 0) { Write-Host "  - Naming Violations: $(@($namingViolations) -join ', ')" -ForegroundColor Yellow }
        Write-Host "Action: Fix the substrate defects above before committing.`n" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "[OK] Audit-Component Staged Gate PASS (0 defects across $(@($filesToInspect).Count) staged file(s))." -ForegroundColor Green
        exit 0
    }
}

if ($AsJson) {
    return ($result | ConvertTo-Json -Depth 5)
}

return $result
