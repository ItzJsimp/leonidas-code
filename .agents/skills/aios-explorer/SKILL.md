---
name: "aios-explorer"
description: "Search the AIOS deeply across files, the store cascade and Git history. Use when something may be saved somewhere in the AIOS and a first grep did not find it."
category: knowledge
scope: structural
distribution: template
type: skill
id: "skill-aios-explorer"
title: "AIOS Explorer: Operating System & Codebase Discovery Engine"
kind: procedure
load: on-demand
owner: shared
verified: 2026-09-16
related: ["skills-index", "research", "context-engineering", "master-instructions"]
generated: false
license: MIT
---

# AIOS Explorer Skill

Deep internal discovery and codebase forensics engine for your AIOS and any peer AIOS. Specializes in finding buried files, tracing symbols, analyzing architecture, and navigating the 7-tier Store Cascade without firing external web tools.

---

## 1. When to Use

Use this skill whenever the user or an orchestrator asks to:

- "Find where X is defined or used in AIOS"
- "Search through the operating system / D drive files"
- "Trace how a script, function, or standard works across the codebase"
- "Investigate past session decisions, handoffs, or Git commit history"
- "Locate relevant knowledge before executing a refactor"

**Boundary Rule:** If the query requires searching the external internet, official documentation websites, or external APIs, route immediately to [`research`](../research/SKILL.md).

---

## 2. The Store Cascade Search Protocol

When investigating facts, standards, or system state, traverse the tiers in strict sequence per [`CONTEXT.md`](../../../CONTEXT.md):

```
1. memory/memory-index.md         -> Durable facts already promoted (gen)
2. tasks/ & TASKS.md              -> Active operational state and sprint tasks
3. projects/                      -> Active workspaces, deliverables, and plans
4. CONTEXT.md                     -> Authoritative domain glossary and terminology
5. wiki/                          -> Synthesized domain knowledge and research dossiers
6. logs/                          -> Raw session logs, grill sessions, and handoffs
7. decisions/                     -> ADRs and architectural rationale
8. Ask the user                       -> Only after 1 through 7 miss
```

Never search blindly across the entire drive when the Store Cascade defines the exact hierarchy of truth.

---

## 3. Investigation Tooling & Forensic Techniques

### 1. SQLite FTS5 / BM25 Ranked Concept Search (Fastest & Token-Dense)

- Run `python scripts/search-aios.py "<query>"` (use `--uri` when responding in Antigravity chat).
- Searches across `decisions/`, `standards/`, `memory/`, `wiki/`, `tasks/`, `projects/`, `ideal-state/`, `domains/`, `workflows/`, `modes/`, `logs/`, and `raw/` (the 12 `INDEX_DIRS` in `scripts/search-aios.py`).
- Uses BM25 probabilistic relevance ranking to return the top ranked files with highlighted snippet passages in <10ms.
- To force an index rebuild: `python scripts/search-aios.py --index`.

### 2. High-Speed Pattern Search (Exact Match / Code Symbols)

- Use `grep_search` with exact literal or regex patterns when looking for specific function names, paths, or code strings.
- Filter paths using glob patterns (e.g. `Includes: ["*.ps1", "!**/node_modules/**"]`) to avoid scanning noise.

### 3. File & Directory Discovery

- Use `find_by_name` to locate files by glob pattern across specific subtrees (`scripts/`, `standards/`, `projects/`).
- Avoid scanning ephemeral build folders, `.git/`, or virtual environments.

### 3. PowerShell AST & Script Forensics

- When tracing function declarations, cmdlets, or variables in `scripts/`, inspect the AST directly via PowerShell:
  ```powershell
  $ast = [System.Management.Automation.Language.Parser]::ParseFile("scripts/My-Script.ps1", [ref]$null, [ref]$null)
  $ast.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)
  ```

### 4. Git History & Provenance Tracing

- When context in a file is missing or ambiguous, trace its commit provenance:
  - Find commits modifying a symbol: `git log -S "<symbol-name>" --oneline`
  - Inspect recent changes to a file: `git log -p -n 3 <file-path>`

---

## 4. Canon vs. Legacy Filtering (Rule 1)

Every discovered reference must be qualified against AIOS canon:

- **Canon:** Live files in `standards/`, `modes/`, `.agents/skills/`, and active `projects/`.
- **Legacy / Historical:** Files inside `archive/permanent/` (e.g. `superseded-skills/`), or tagged `status: deprecated`.
- **Action:** If a search matches a legacy file, explicitly flag it: _"Found in legacy Notion export; not current active canon."_ Never present superseded practices as active truth.

---

## 5. Output Contract

Deliver a dense, scannable briefing:

1. **Direct Answer:** 1-2 sentence core finding (e.g. where the symbol lives, what governs it).
2. **Authoritative Locations:** Clickable relative links with line numbers (e.g. [`Build-Index.ps1:L45`](../../../scripts/Build-Index.ps1)).
3. **Architectural Context:** Which Mode, skill, or ADR owns this component.
4. **Relevant Connections:** Pointers to related tasks or wiki knowledge.
