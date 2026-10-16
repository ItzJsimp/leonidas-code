---
name: leonidas-os-audit
description: "Comprehensive AIOS audit: Substrate Health Gate, Four Cs Index, subagent topology, and auto-repairs."
category: system
argument-hint: "[optional: a subfolder or domain to scope the audit to]"
type: skill
id: skill-leonidas-os-audit
title: "Leonidas OS Audit: Multi-Gate Substrate and Maturity Audit"
kind: procedure
load: on-demand
owner: leonidas
scope: structural
distribution: private
verified: 2026-10-04
related:
  [
    "audits-index",
    "context",
    "adr-0018-dual-layer-kpi-and-telemetry-architecture",
    "scripts-detect-drift",
    "scripts-log-audit",
  ]
generated: false
disable-model-invocation: true
---

# Leonidas OS Audit: Is Your AIOS Compounding and True?

Your operating manual, router files, indexes, and memory stores are falsifiable claims about reality. This audit checks every claim against disk, measures system leverage over time, and enforces self-healing governance without infinite subjective drift per [ADR-0018](../../../decisions/0018-dual-layer-kpi-and-telemetry-architecture.md).

**Read-only during analysis.** Never fix, move, rename, or delete files during the evaluation phase. Outputs are the structured audit report in `audits/`, an append-only entry in `audits/audit-history.jsonl`, and at least one operational task in `tasks/` if unlogged defects are identified.

---

## Architectural Principles & Governance Gates

1. **3-Bucket Defect Triage (Anti-Hallucination Anchor):**
   - **Bucket 1: Active Defect / Regression:** Unlogged breaking bug, broken link, em dash violation, AST syntax error, or direct memory contradiction. Must be remediated.
   - **Bucket 2: Known Roadmap / Logged In-Flight:** An issue or gap already logged in [`BUILD-PLAN.md`](../../../BUILD-PLAN.md) or [`tasks/`](../../../tasks/tasks-index.md). Reported as _Known In-Flight_; does NOT count against the Substrate Health Gate. Skill description bloat (>40 words) is classified as Bucket 2 (WARNING) rather than hard-failing the gate.
   - **Bucket 3: Certified Clean:** If 0 unlogged active defects exist and Tier 1 substrate passes, the audit explicitly returns `VERDICT: CERTIFIED CLEAN (100% Operational)`.
2. **Incremental Verification Caching:**
   - Completed milestones in `BUILD-PLAN.md` and closed tasks in `tasks/` that were previously verified and recorded in `audits/audit-history.jsonl` are skipped during subsequent runs unless the underlying file modified date has changed.
3. **The 6 LifeOS / AIS-OS / ARMS Governance Gates:**
   - **VerificationGate (Claim vs Evidence):** Every completed task claim must cite verifiable disk evidence (`exists:`, `grep:`, syntax pass). Claims lacking evidence are flagged as unverified.
   - **Self-Healing Counter-Rule (Anti-Bloat Guard):** When an AI lapse occurs but an existing standard already covered the requirement, flag an _AI Execution Lapse_. Forbid authoring redundant rules for one-off slips.
   - **BPE Rule Test:** Flag any standing instruction or rule where a more capable foundation model renders the rule obsolete.
   - **Cadence & Scheduled Firing:** Verify Windows Task Scheduler jobs actually fired within their scheduled interval rather than idling silently.
   - **SSOT Redundancy Gate (One-Place Edit Test):** Operational directives or rules must never be duplicated across files. Core rules live in one authoritative store and are referenced via repo-relative links elsewhere.
   - **Frontmatter Ceiling & Freshness TTL:** All indexed docs must carry `scope: personal | structural`. Volatile operational docs older than 30 days without re-verification are flagged as `[STALE-CANDIDATE]`.
   - **Tool Registry Context Budget:** Skill descriptions in frontmatter are capped at 40 words to protect LLM tool registry context headroom across all sessions.
   - **Taxonomy & Ergonomics:** Enforce PascalCase for PowerShell (`Verb-Noun.ps1`), kebab-case for Python (`name.py`), and ban generic slugs or cross-engine collisions.
4. **Harness & Model Provenance Gate (Mandatory Audit Metadata):**
   - Every operating system audit MUST record the exact **harness** (`Google Antigravity`, `Claude Code`, `Hermes`, or `Local`) and **model** (including reasoning effort tier and subagent delegation topology, e.g. `Gemini 3.8 Flash (High) + Gemini 3.8 Flash subagents` or `Claude Opus 5.5 (High)`) in both the `audits/YYYY-MM-DD-os-audit.md` frontmatter and `audits/audit-history.jsonl` via `scripts/Log-Audit.ps1 -Harness "<Harness>" -Model "<Model>"`. The executing harness and model directly govern subagent concurrency, tool registry ceilings, context truncation limits, and constraint fidelity.

---

## Step 0: Ingest Telemetry, History & Verification Cache

1. **Tier 1 Deterministic Substrate Ingest (0 LLM Tokens):**
   - Execute `pwsh -File scripts/Audit-Substrate.ps1` or read `audits/telemetry-latest.json`.
   - Ingest broken link counts, U+2014 em dash violations, script AST syntax errors, context word counts, and task velocity.
   - Run mechanical keyword/heading co-occurrence scans to pre-filter candidate duplicate rules for Subagent 1.
   - Scan frontmatter `description` word counts across `.agents/skills/*/SKILL.md` to flag descriptions exceeding 40 words.
2. **Ingest Prior Audit History, Chronic Defect Ledger & Velocity KPI:**
   - Read `audits/audit-history.jsonl` and the most recent report in `audits/`.
   - Identify unresolved issues from previous runs. Flag any item failing across 2+ consecutive cycles as `[CHRONIC]`.
   - Calculate Compounding Velocity: compare Four Cs scores over the last 3 cycles. Flag stagnation if the total score has not advanced.

---

## Step 1: Subagent Inspection Topology

To audit every folder without context pollution or prompt drift, the orchestrator dispatches 3 parallel subagents. **The orchestrator MUST use the exact verbatim prompts provided in [`references/subagent-prompts.md`](./references/subagent-prompts.md) without improvisation.**

### Subagent 1: Governance & Routing Auditor

- **Target Files:** `AGENTS.md`, `CLAUDE.md`, `MASTER-INSTRUCTIONS.md`, `.claude/claude-overlay.md`, `.agents/rules/antigravity-overlay.md`, `.agents/rules/hermes-overlay.md`, `modes/` (Modes 00-10 + `router.md`), `standards/`, `templates/`, `workflows/`.
- **Exact Verbatim Prompt:** Pass section 1 from [`references/subagent-prompts.md`](./references/subagent-prompts.md).
- **Core Checks:** Routing link integrity, always-loaded context budget (<15,000 words, `GEMINI.md` <24,000 bytes), mode 5-section layout across Modes 00-10, BPE rule candidates, schema conformity, SSOT redundancy (One-Place Edit test), and frontmatter root hygiene (zero frontmatter on root instructions, valid `load:` values).
- **Output Contract:** Structured markdown table matching the schema in Step 2.

### Subagent 2: Capabilities & Tooling Auditor

- **Target Files:** `.agents/skills/`, `scripts/`, `prompts/`, `tools/`, project-scoped junctions in `.claude/skills/` (and verify global `~/.claude\skills\` remains empty per ADR-0038).
- **Exact Verbatim Prompt:** Pass section 2 from [`references/subagent-prompts.md`](./references/subagent-prompts.md).
- **Core Checks:** Skill frontmatter standards, tool registry context budget (40-word description ceiling), script AST parsing, taxonomy and slug ergonomics (PascalCase scripts, kebab-case python, ban on generic slugs and multi-engine collisions), `.claude/skills/` junction parity, and Task Scheduler silent flags.
- **Output Contract:** Structured markdown table matching the schema in Step 2.

### Subagent 3: Memory, Truth & Domains Auditor

- **Target Files:** `memory/`, `domains/`, `ideal-state/`, `projects/`, `capture/`, `decisions/`, `raw/`.
- **Exact Verbatim Prompt:** Pass section 3 from [`references/subagent-prompts.md`](./references/subagent-prompts.md).
- **Core Checks:** Contradiction checks, privacy and isolation boundary, frontmatter ceiling (`scope: personal | structural`) and freshness TTL (30-day half-life for volatile docs), capture note slug hygiene, scratch note cleanup, verification gate evidence checks, and compounding velocity.
- **Output Contract:** Structured markdown table matching the schema in Step 2.

---

## Step 2: Synthesis & 3-Bucket Reconciliation

The lead agent collects findings from the 3 subagents, executes reconciliation against [`BUILD-PLAN.md`](../../../BUILD-PLAN.md) and [`tasks/`](../../../tasks/tasks-index.md), and formats the operational findings table:

| Target Path                      | Category   | Rule / Standard Violated                   | Severity (CRITICAL / WARNING / INFO) | Tracked in BuildPlan/Tasks? | Triage Bucket   |
| -------------------------------- | ---------- | ------------------------------------------ | ------------------------------------ | --------------------------- | --------------- |
| `standards/example.md`           | Routing    | Broken link                                | CRITICAL                             | NO                          | Active Defect   |
| `domains/finances/`              | Cadence    | Automated statement ingest missing         | WARNING                              | YES (`TASK-0012`)           | Known In-Flight |
| `.agents/skills/sample/SKILL.md` | Budget     | Description exceeds 40 words (47 words)    | WARNING                              | YES (`TASK-0045`)           | Known In-Flight |
| `standards/rule-a.md`            | Redundancy | Duplicate directive already in `AGENTS.md` | WARNING                              | NO                          | Active Defect   |

---

## Step 3: Dual-Layer Scorecard & Chronic Escalation

### Layer 1: Substrate Health Gate (Binary Pass / Fail)

- **PASS Requirements:**
  - 0 broken router links.
  - 0 U+2014 em dash violations.
  - 0 script AST syntax errors.
  - 0 unlogged CRITICAL active defects.
  - 0 chronic defects at Cycle 3+.
- If any requirement fails, the gate is `FAIL`. Note: Bucket 2 WARNING items (such as skill description pruning or logged roadmap gaps) do NOT fail the Substrate Health Gate.

### Layer 2: Four Cs Maturity Index (0 to 100 Points)

- **Context (0-25 pts):** Depth of truth, identity clarity, glossary completeness, zero contradictions, SSOT redundancy minimization, and frontmatter ceiling compliance.
- **Connections (0-25 pts):** Live external data reach, MCP connectors, tool integrations. Read [`connections.md`](../../../connections.md) for presence and staleness only, never a live call: every domain has a row, and any row claiming a working mechanism (not `not yet connected`) with a `Last checked` older than 30 days, or blank, is flagged stale. A row's `Last checked`/`Checked by` are self-reported by whichever script last used that connection; the audit never stamps them itself.
- **Capabilities (0-25 pts):** Breadth and reliability of verified skills, scripts, test harnesses, tool registry word efficiency (<=40 words per description), and slug ergonomics.
- **Cadence (0-25 pts):** Headless execution, background automation, and scheduled task firing.

### Compounding Velocity KPI

Compare current Four Cs score against history in `audits/audit-history.jsonl`:

- **Positive Velocity:** Score increased or substrate defects dropped while capability grew.
- **Stagnation Alert:** Total score identical or dropping across 3 consecutive cycles. Triggers mandatory review of highest-friction bottlenecks.

### Qualitative Litmus Check (non-scored)

Ask these three alongside the numeric score; they surface lived friction the Four Cs points can miss. Source: [`raw/youtube/nate-herk/gpt6-astra-ultimate-ai-second-brain/analysis.md`](../../../raw/youtube/nate-herk/gpt6-astra-ultimate-ai-second-brain/analysis.md).

1. **Teammate-question test:** If someone messaged Jake a question right now, would Leonidas answer it faster and better, with sources, than Jake could from memory?
2. **Context-switching reduction:** Is work actually happening inside this interface, or are tabs still being opened to route around it?
3. **Knowledge-leaves-your-head test:** Is Jake trusting retrieval for what he decided last quarter, or still rehearsing it himself?

A "no" on any of these is a real finding even when the numeric score is high; note it in the report but do not subtract points for it.

### Chronic Defect Escalation Ladder:

- **Cycle 1 (New Finding):** Logged in report; standard task created in `tasks/`.
- **Cycle 2 (Chronic Repeat):** Tagged `[CHRONIC: 2 Runs]`, task priority automatically elevated to `Now` / High.
- **Cycle 3+ (Stagnant Blocker):** Substrate Health Gate fails automatically until resolved.

---

## Step 4: Output & Persistence Contract

1. **Save Markdown Report to `audits/YYYY-MM-DD-os-audit.md`:**
   Must begin with standardized YAML frontmatter conforming to [`standards/naming-standard.md`](../../../standards/naming-standard.md). **Every audit MUST explicitly record the `harness` and `model` (including reasoning effort tier and subagent model topology) in both the YAML frontmatter and the Markdown report header**, as the active harness and model govern execution mechanics, subagent routing, context windows, and constraint fidelity:

```yaml
---
type: audit
id: os-audit-YYYY-MM-DD
title: "Leonidas OS Audit: YYYY-MM-DD"
date: YYYY-MM-DD
harness: "Google Antigravity" # Google Antigravity | Claude Code | Hermes | Local
model: "Gemini 3.8 Flash (High)" # Exact human-readable model + effort tier (plus subagent model if delegated)
gate_status: PASS # PASS | FAIL | CERTIFIED_CLEAN
four_cs:
  context: 22
  connections: 12
  capabilities: 24
  cadence: 14
  total: 72
metrics:
  broken_links: 0
  emdash_violations: 0
  script_syntax_errors: 0
  active_defects: 0
  known_inflight: 4
  chronic_defects: 0
scope: structural
---
```

2. **Log to Centralized History Ledger:**
   Execute `pwsh -File scripts/Log-Audit.ps1 -Harness "<Harness>" -Model "<Model>"` with the parsed parameters to persist the audit event (including the exact harness and model employed) to `audits/audit-history.jsonl`.

3. **Generate Auto-Repair Script for Deterministic Defects:**
   If any mechanical active defects were identified (e.g. em dash violations, missing frontmatter scope, broken generated indexes, or orphaned symlinks), automatically generate a self-contained repair script at `scratch/Repair-AuditFindings.ps1`.
   This script must contain the exact single-batch PowerShell commands required to remediate those mechanical defects in one shot.

4. **Mandatory Improvement Gate:**
   - If any unlogged Active Defects were identified, create at least 1 concrete operational ticket in `tasks/` using `pwsh -File scripts/New-Task.ps1`.
   - If 0 unlogged defects exist and substrate passed, certify system as clean.
   - Run `pwsh -File scripts/Build-Index.ps1` to refresh all indexes.

---

## Step 5: Interactive Remediation & Auto-Repair Bridge

At the conclusion of the read-only audit report, the orchestrator MUST NOT make unapproved file edits. Instead, present the findings summary and offer the remediation bridge:

1. **Executive Presentation:** Present the gate status, Four Cs score, Compounding Velocity trend, and categorized defect table.
2. **Auto-Repair Presentation:** If `scratch/Repair-AuditFindings.ps1` was generated, present the exact command to execute it safely.
3. **Interactive Transition Prompt:** Conclude with the explicit transition prompt:
   `"Audit complete and persisted to audits/ and audit-history.jsonl. Auto-repair script generated at scratch/Repair-AuditFindings.ps1. Would you like to execute auto-repairs, or resolve architectural findings using /grill-with-docs?"`
4. **Seamless Transition on Confirmation:** If Jake confirms:
   - For mechanical fixes: run `scratch/Repair-AuditFindings.ps1` and verify with `scripts/Detect-Drift.ps1`.
   - For architectural fixes: invoke [`grill-with-docs`](../grill-with-docs/SKILL.md) to formulate Round 1 of the Design Tree, update [`CONTEXT.md`](../../../CONTEXT.md) or record ADRs, and hand off directly to [`implement`](../implement/SKILL.md).
