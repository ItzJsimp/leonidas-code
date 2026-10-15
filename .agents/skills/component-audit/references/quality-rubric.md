---
type: "reference"
id: "reference-quality-rubric"
title: "AIOS Quality Rubric & Standards Reference"
description: "The 10 foundational quality standards, context failure modes, and tool stack integration profiles for Leonidas AIOS component audits."
scope: "structural"
---

# AIOS Quality Rubric & Standards Reference

The 10 foundational quality standards, context failure modes, and tool stack integration profiles for Leonidas AIOS component audits.

---

## 1. The 10 AIOS Quality Standards

| #      | Standard                                      | Core Invariant                                                                                                                                 | Failure Signal                                                            | Remediating Action                                                            |
| ------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **1**  | **Zero Em-Dash Policy (ADR-0012)**            | Never write Unicode character U+2014 anywhere in prose, code, or metadata.                                                                     | Pre-commit hook failure, `Detect-Drift.ps1` flag.                         | Replace with colons, commas, hyphens, or parentheses.                         |
| **2**  | **Single Authoritative Write Path (SAWP)**    | Every entity or fact has exactly one authoritative write path. All other references link to it.                                                | Competing edits, duplicate records in multiple folders.                   | Consolidate to canonical file, replace duplicates with links.                 |
| **3**  | **Mandatory Relative File Links (Rule 7)**    | Repository markdown references must use repo-relative clickable links (e.g. [`naming-standard.md`](../../../../standards/naming-standard.md)). | Absolute `file:///` paths, plain unlinked filenames, broken targets.      | Convert to valid repo-relative markdown paths.                                |
| **4**  | **Quoted Frontmatter & Scope Tag (ADR-0013)** | YAML frontmatter strings must be double-quoted; must include `scope: personal` or `scope: structural`.                                         | AST parse error, unquoted YAML strings, missing scope.                    | Format frontmatter with double-quotes and explicit scope.                     |
| **5**  | **The 4 Failure Modes Defense**               | Guard against Poisoning (false), Bloat (too much), Confusion (wrong/missing), and Clash (contradictory).                                       | Stale numbers, bloated prompt caches, missing indexes, conflicting rules. | Prune bloat, freshen data feeds, add routing entries, resolve contradictions. |
| **6**  | **Context Load Tiers & Budgeting**            | Preloaded Tier 0 files must stay lean to prevent prompt cache eviction and Antigravity 24k cliff.                                              | Always-loaded files exceeding word budgets or 24,000 bytes.               | Factor reference into on-demand Tier 1 modules.                               |
| **7**  | **Progressive Disclosure**                    | Core instructions remain concise; bulky schemas and lookup tables live in `references/`.                                                       | Monolithic files >300 lines with unread reference tables.                 | Extract tables into `references/<topic>.md` with clean pointers.              |
| **8**  | **Deterministic Script Extraction**           | Repetitive multi-file procedures (>3 files) must be scripted, not performed via manual LLM loops.                                              | Sequential manual file-edit tool calls in agent chat.                     | Author a zero-token PowerShell or Python script in `scripts/`.                |
| **9**  | **6-Tier Automation Routing**                 | Map workflows to the lowest viable tier across the 6-tier automation hierarchy.                                                                | Running LLM agents for deterministic local file transforms.               | Route to Tier 1 (Script), Tier 2 (Scheduler), or Tier 4 (n8n).                |
| **10** | **Quality Preservation Principle**            | If a component is healthy, sound, and compliant, leave it alone. Zero unnecessary churn.                                                       | Cosmetic rewrites, bike-shedding, churn for the sake of activity.         | Certify as clean (`VERDICT: CERTIFIED CLEAN`) and exit.                       |

---

## 2. The 4 Context Failure Modes (LangChain / Drew Breunig Lens)

Every defect identified during an audit maps to one of the four ways AI context breaks:

1. **Poisoning (False Information):**
   - Stale data stated as current truth.
   - An index claiming "active" for month-old items.
   - Historical guidelines contradicting recent Architectural Decision Records (ADRs).
   - _Risk:_ The AI model treats context as absolute ground truth and gives confidently incorrect advice.

2. **Bloat (Excessive Token Weight):**
   - Conversational preambles, marketing fluff, or boilerplate introductions.
   - Bulky reference tables embedded directly in always-loaded or operational instructions.
   - Ephemeral scratch notes left inside durable knowledge folders.
   - _Risk:_ Pushes models past prompt cache boundaries, increases latency, and triggers context truncation cliffs.

3. **Confusion (Missing or Ambiguous Guidance):**
   - Active folders omitted from parent indexes or the master router.
   - Incomplete instruction sets with missing edge-case handling.
   - Misleading file names that fail to communicate functional responsibility.
   - _Risk:_ The AI hallucinates paths, misses essential rules, or fails to navigate to required resources.

4. **Clash (Direct Contradictions):**
   - Two files claiming ownership over the same process or data store.
   - Conflicting instructions between universal canon (`AGENTS.md`) and engine overlays.
   - Multiple versions of the same skill or template sitting in parallel directories.
   - _Risk:_ The AI oscillates between competing behaviors depending on subtle context ordering.

---

## 3. Tool Stack Integration Profiles

When auditing components, evaluate how they integrate with the operator's active tool stack:

| Tool                   | Role in AIOS                                    | Integration Touchpoint & Opportunity                                                                                |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Hermes**             | Autonomous local CLI agent & cron daemon        | Headless execution, background polling, automated cron job execution via Python wrappers.                           |
| **VS Code**            | Primary code editor & IDE                       | Workspace settings, keybindings, split-pane reading teardowns, tasks.json shortcuts.                                |
| **Claude Code**        | Terminal-based agentic paired programmer        | Skill discovery via project junctions (`.claude/skills/`), prompt cache tiering, slash commands.                    |
| **Google Antigravity** | Agentic IDE with multi-turn workspace context   | Native `.agents/skills/` reading, annotation disk titles (`scripts/Set-HarnessChatName.ps1`), 24k cliff management. |
| **Vivaldi Browser**    | Web research, dashboards, and media ingestion   | Automated web navigation, browser-based research extraction, tab and workspace routing.                             |
| **Obsidian**           | Local markdown knowledge viewer & canvas        | Graph views, canvas workflows, markdown readability, local search indexing.                                         |
| **ActivityWatch**      | Telemetry and work habit tracker                | Task telemetry logging (`logs/task-telemetry.jsonl`, `aw-aios-tasks`), focus rhythm tracking.                       |
| **n8n (Docker)**       | Visual workflow and multi-app orchestration     | Tier 4 automation: webhooks, API polling, external notification routing (Telegram, Discord, email).                 |
| **PowerShell 7**       | Deterministic automation & substrate validation | Tier 1 automation: fast local scripts, substrate linting, AST analysis, Git automation.                             |
