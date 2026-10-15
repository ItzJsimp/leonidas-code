---
type: "reference"
id: "reference-entity-analysis-matrix"
title: "Entity Analysis Matrix"
description: "Governing analysis protocols and inspection vectors specialized by entity type across Leonidas AIOS."
scope: "structural"
---

# Entity Analysis Matrix

Governing analysis protocols and inspection vectors specialized by entity type across the Leonidas AI Operating System and related assets.

---

## 1. Entity Classification Taxonomy

The auditor first classifies the target asset into one of six operational categories:

| Category                      | Typical Path / Pattern              | Governing Standard                                                         | Load Tier          | Primary Invariants                                                        |
| ----------------------------- | ----------------------------------- | -------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------- |
| **Single File**               | `*.md`, `*.json`, `*.yaml`          | [`standards/naming-standard.md`](../../../../standards/naming-standard.md) | Tier 0 / 1 / 2     | Single Authoritative Write Path (SAWP), Zero Em-Dash, Relative Links      |
| **Folder / Directory**        | `<folder>/`                         | [`standards/drive-taxonomy.md`](../../../../standards/drive-taxonomy.md)   | Tier 1 / 2         | Kebab-case, `<folder>-index.md` present, no root clutter                  |
| **Both (Subsystem)**          | `<folder>/` + key files             | Architecture standard                                                      | Tier 1 / 2         | Cohesive boundaries, clear input/output contracts, zero circular coupling |
| **Artifact**                  | `brain/<cid>/`, `assets/`           | Artifact standard                                                          | Tier 3 (Ephemeral) | Traceable metadata, no durable knowledge trapped in ephemeral paths       |
| **Specialized System Entity** | Skills, Modes, ADRs, Scripts, Tasks | Specialized standard                                                       | Specialized        | Strict schema compliance, registration in manifests, deterministic gates  |
| **External / Related Asset**  | `D:\...` outside repo               | [`standards/drive-taxonomy.md`](../../../../standards/drive-taxonomy.md)   | External           | Path portability, boundary isolation, explicit confirmation for mutations |

---

## 2. Specialized Entity Inspection Vectors

### A. Agent Skills (`.agents/skills/<skill-name>/SKILL.md`)

- **Location & Naming:** Must live at `.agents/skills/<skill-name>/SKILL.md`. Name must be lowercase kebab-case.
- **Invocation Posture:** Verify model-invoked vs user-invoked (`disable-model-invocation: true`). Model-invoked descriptions must be under 40 words / 250 characters and front-loaded with active trigger verbs.
- **Harness Economics & Parity:** Dual-engine discovery must be maintained. Claude Code reads junctions via `<repo>/.claude/skills/` (synced via `scripts/Sync-AgentSkills.ps1`). Antigravity reads natively. Global `~/.claude/skills` must remain empty per [ADR-0038](../../../../decisions/0038-claude-code-skill-discovery-is-project-scoped-per-tenant.md).
- **Progressive Disclosure:** Bulky references (>30 lines), large schemas, or heavy lookup tables must be extracted into `references/<topic>.md`. Deterministic automation belongs in `scripts/` or `scripts/<script>.ps1`.
- **Done When Criteria:** Must terminate with observable, checkable completion conditions, not fuzzy prose.

### B. System Modes (`modes/<num>-<slug>.md`, `modes/router.md`)

- **Naming & Sequencing:** 2-digit zero-padded prefix (`modes/00-build-architect.md`, `modes/03-simplygersi.md`).
- **Precedence Ladder:** Verify synchronization with [`modes/router.md`](../../../../modes/router.md). Ensure the 9-rule precedence ladder correctly accounts for the mode.
- **5-Section Structure:** Persona identity, core principles, technical guidelines, domain boundaries, and completion criteria.
- **Cross-Repo Boundary:** Mode 03 SimplyGersi must enforce read-only overlay rules, with explicit user confirmation required prior to any write operations per [ADR-0008](../../../../decisions/0008-mode-3-is-a-cross-repo-read-overlay.md).

### C. Architectural Decisions (`decisions/<0000>-<slug>.md`)

- **Naming:** 4-digit zero-padded prefix (`0001-slug.md`, `0010-slug.md`).
- **MADR Schema:** Must include Context, Decision, Consequences (Positive, Negative, Neutral), and Compliance Verification.
- **Git as Master Log:** Changes must conform to [ADR-0010](../../../../decisions/0010-git-history-replaces-the-master-log.md) (Git commits replace manual log sprawl).
- **Index Sync:** Must be cataloged in [`decisions/decisions-index.md`](../../../../decisions/decisions-index.md).

### D. System Prompts & Templates (`prompts/`, `templates/`)

- **Token Density:** Strip pleasantries, greetings, and conversational padding.
- **Variable Placement:** Clean placeholders (`[TARGET]`, `<parameter>`) with clear substitution contracts.
- **Frontmatter:** Prompts and templates must include `type: prompt` or `type: template` and `scope: personal | structural`.
- **Template Governance:** Follow [`standards/template-standard.md`](../../../../standards/template-standard.md) for splitting monolithic files into structured parents and children.

### E. Automation Scripts (`scripts/*.ps1`, `scripts/*.py`)

- **Language & Casing:** PowerShell must use PascalCase approved `Verb-Noun.ps1`. Python must use lowercase `kebab-case.py`.
- **Substrate Module Import:** PowerShell scripts should import `scripts/modules/AIOSCore.psm1` for root resolution and em-dash checks.
- **AST Parsing:** Must parse cleanly via PowerShell AST (`[System.Management.Automation.Language.Parser]`) with zero syntax errors.
- **Automation Tier:** Classify into one of the 6 AIOS Automation Tiers (Tier 1 Local Script, Tier 2 Task Scheduler, Tier 3 Agent Loop, Tier 4 n8n, Tier 5 MCP, Tier 6 Git Hook).
- **Hardening:** Scheduled tasks must use [`scripts/New-AiosScheduledTask.ps1`](../../../../scripts/New-AiosScheduledTask.ps1) with `Hidden`, `S4U`, `ExecutionTimeLimit`, and `IgnoreNew` flags.

### F. Durable Memory & Domain Stores (`memory/`, `domains/`, `ideal-state/`)

- **Single Write Path:** One authoritative home per fact. Secondary files must link to it, not duplicate it.
- **Promotion Ladder:** Ephemeral session lessons -> `memory/observed/` (same-turn) -> promoted to `memory/<slug>.md` via `scripts/New-Memory.ps1` or domain summaries.
- **Privacy Boundary:** Private tenant details (financial records or personal context) must never cross tenant boundaries or public commits.
- **mem0 Integration:** Key durable facts must be indexed into mem0 (`user_id=<tenant-scope>`) via [`scripts/Sync-Mem0Index.ps1`](../../../../scripts/Sync-Mem0Index.ps1) and searched before assumptions are made.

### G. Operational Tasks (`tasks/*.md`)

- **Naming:** Lowercase kebab-case action slug (`tasks/deploy-local-docker-n8n.md`).
- **Dashboard Synchronization:** `tasks/` is the authoritative write path; [`TASKS.md`](../../../../TASKS.md) is a read-only rendered dashboard. Never edit `TASKS.md` directly.
- **Autonomy Defaults:** Follow [ADR-0048](../../../../decisions/0048-task-capture-autonomy-defaults-and-harvester-safety-net.md): default `autonomous: true` for unblocked `scope: structural` tasks; `scope: personal` requires explicit opt-in.

### H. Folders & Subsystems (`<folder>/`)

- **Folder Prefix Index:** Every folder must contain `<folder>-index.md` with `generated: true` frontmatter.
- **Depth & Semantics:** Avoid nesting deeper than 3 subdirectories. Ensure directory names represent clear functional domains.
- **Root Hygiene:** Only approved core instruction entrypoints, routers, and dispatchers may reside in the repository root. All other files belong in categorized subfolders.

### I. External & Related Assets (`D:\...`)

- **Boundary Verification:** Confirm whether asset is inside or outside AIOS root.
- **Taxonomy Compliance:** Follow [`standards/drive-taxonomy.md`](../../../../standards/drive-taxonomy.md).
- **Confirmation Requirement:** Modifying external codebases, system registries, or disk partitions outside AIOS requires explicit operator confirmation before execution.
