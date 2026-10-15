---
name: subagent-builder
description: "Author, audit, and configure subagents for Claude Code and Antigravity with model routing and tools."
category: agents
scope: structural
distribution: core
disable-model-invocation: true
---

# Subagent Builder: Dual-Engine Subagent Architecture & Tooling

A subagent executes tasks in an isolated context window with dedicated tool permissions and model routing. This isolates the parent orchestrator from token bloat, enables parallel execution swarms, and preserves budget headroom.

Detailed platform schemas and mechanics live in dedicated reference files:

- Canonical Specification: [`references/canonical-spec.md`](./references/canonical-spec.md)
- Claude Code Subagents: [`references/claude-subagents.md`](./references/claude-subagents.md)
- Google Antigravity Subagents: [`references/antigravity-subagents.md`](./references/antigravity-subagents.md)
- Cross-Engine Compiler: [`scripts/Sync-Subagents.ps1`](../../../scripts/Sync-Subagents.ps1)
- Antigravity Payload Generator: [`scripts/Get-SubagentPayload.ps1`](../../../scripts/Get-SubagentPayload.ps1)

---

## 1. The Placement Decision (First)

Before authoring a subagent, verify that a subagent is the correct architectural construct:

| Construct            | Execution Context       | Cost & Token Impact                        | When to Choose                                                                                 |
| -------------------- | ----------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| **Subagent**         | Isolated context window | Moderate token cost; zero parent pollution | Long-horizon searches (>5 files), test runs, multi-step verification, adversarial critique.    |
| **Inline Execution** | Same context window     | Lowest overhead; immediate execution       | Quick edits (<30s), single-file greps, localized updates touching <=2 files.                   |
| **Mode**             | Same context window     | Zero token cost; behavioral lens switch    | Tone adjustment, domain perspective, or strategic thinking rules (Modes never declare models). |
| **Skill**            | Loaded into context     | On-demand procedural injection             | Reusable step-by-step SOP or reference loaded by parent or subagent.                           |

---

## 2. Harness-Aware Model Routing (ADR-0030)

Every subagent must declare explicit model tiers per [`ADR-0030`](../../../decisions/0030-harness-aware-model-routing-and-quota-telemetry.md) and [`tools/model-router.md`](../../../tools/model-router.md):

### Google Antigravity Routing

- **Default Swarm Model:** `flash` (Gemini 3.8 Flash Low/Medium, 313 tok/s, 0.70s TTFT). Use for parallel search, code inspection, and AST analysis.
- **Indexing & Grep Sweeps:** `flash_lite` (Gemini 3.6 Flash). High-speed zero-reasoning passes with zero negative rules.
- **Heavy Verification & Formal Proofs:** `pro` (Gemini 3.1 Pro) or `inherit`. Reserve for Tier 1 multi-file audits or complex mathematical proofs.

### Claude Code Routing

- **Default Read-Only Model:** `haiku` (Claude 3.5 Haiku). Preserves Claude Pro 5-hour quota headroom on fast search, grep, and metadata extraction.
- **Substantive Coding & Refactoring:** `sonnet` (Claude Sonnet 5). Use when subagents write code, implement tests, or refactor multi-file components.
- **Intractable Logic & Security:** `opus` (Claude Opus 5). Reserve strictly for isolated formal logic or security proofs.

---

## 3. Authoring Sequence (The 6-Step SOP)

Follow these steps in order when creating or updating a subagent:

### Step 1: Define Role & Operational Bounds

Give the subagent a single responsibility. If a subagent has two independent roles, split it into two subagents. State the role in one clear sentence under `## Role & Mission`.

### Step 2: Establish Spawn-vs-Inline Thresholds

Write explicit mechanical criteria under `## Spawn vs. Inline Policy`:

- `When to Spawn`: Name countable thresholds (e.g. "Spawn when scanning >5 files or running complete test suites").
- `Inline Threshold`: Name the upper bound for keeping work in the orchestrator (e.g. "<30 seconds or <=2 files").

### Step 3: Minimal Tool Permissions Bounding

Grant only the tools strictly required for the mission:

- `read-only`: `view_file`, `grep_search`, `find_by_name`, `list_dir` (Claude: `Read`, `Grep`, `Glob`).
- `terminal-read-exec`: Add `run_command` (Claude: `Bash`) for test runners and linters.
- `full-write`: Add `replace_file_content`, `write_to_file` (Claude: `Edit`, `Write`) strictly when authorized to modify code.

### Step 4: Enforce Token Deflation Output Contract

Every subagent prompt must enforce token deflation to keep parent context lean:

- **Terse Synthesis:** Returns compact markdown summaries (max 400 words) directly to the parent orchestrator.
- **Evidence-First:** Cites specific file paths, line numbers, or external URLs.
- **No Parent Pollution:** Never dumps raw multi-page transcripts or unbounded search results into the parent context.

### Step 5: Author Canonical Specification File

Create `.agents/subagents/<name>.md` following the template in [`references/canonical-spec.md`](./references/canonical-spec.md). Use either inline arrays or standard multi-line lists for the `tools` key.

### Step 6: Compile & Generate Engine Targets

Run the compiler script to update Claude Code markdown agents and the Antigravity runtime manifest:

```powershell
pwsh scripts/Sync-Subagents.ps1
```

To generate an immediate runtime dispatch payload for Antigravity:

```powershell
pwsh scripts/Get-SubagentPayload.ps1 -Name <name>
```

---

## 4. Mechanical Rules Beat Adjectives

Subagent instructions must use mechanical, checkable rules rather than vague adjectives:

| Vague Adjective  | Mechanical Rule                                                            |
| ---------------- | -------------------------------------------------------------------------- |
| Be thorough      | Inspect every markdown link in the target folder and check disk existence. |
| Be concise       | Return a bulleted summary of <=400 words. Do not quote verbatim code.      |
| Test thoroughly  | Run the test suite and verify 0 failing tests before reporting success.    |
| Safe permissions | Set permissions to read-only; omit write and terminal execution tools.     |

---

## 5. The Honesty Floor & Overflow Spillover Protocol

Subagent token deflation must never suppress critical failure signals:

- Test failures, syntax errors, and link breaks must be listed explicitly, never hidden under summary counts.
- Skipped or unverified files must be explicitly named.
- Unverified assumptions must be labeled as unverified.

### Overflow Spillover Protocol (Reconciling Floor & Ceiling)

When diagnostic traces, broken link lists, or test error cascades exceed the 400-word ceiling:

1. **Drop Raw Trace to Disk:** Write the complete, unvarnished error log to `scratch/<subagent>-failures.log` (or `<conversation_scratch>/failures.log`).
2. **Emit Indexed Pointer to Chat:** Return a concise summary to the orchestrator: total failure count, top 3 representative failures with line numbers, and a direct relative link to the scratch log.
3. **Result:** Zero negative signals are suppressed (Honesty Floor preserved), while parent context remains uncluttered (Token Deflation preserved).

---

## 6. Audit Rubric for Existing Subagents

When auditing subagents in `.agents/subagents/`, verify these four gates:

1. **Role Overlap Gate:** Do two subagents compete for the same task? If yes, merge them or sharpen their trigger descriptions.
2. **Permission Creep Gate:** Does a subagent hold write tools when read-only suffices? Strip all unused tools.
3. **Model Routing Gate:** Are model declarations aligned with ADR-0030? Flag any subagent assigning Opus or Sonnet to basic read passes.
4. **Deflation Contract Gate:** Does the subagent specify a 400-word ceiling and citation requirements?

---

## 7. Done When

A subagent build is complete when:

1. Canonical file exists in `.agents/subagents/<name>.md` with valid YAML frontmatter.
2. Contains all three standard body sections: Role & Mission, Spawn vs Inline Policy, and Output Contract.
3. Frontmatter declares dual-harness models matching ADR-0030.
4. `scripts/Sync-Subagents.ps1` runs with zero errors, compiles `.claude/agents/<name>.md`, and updates `.agents/subagents/manifest.json`.
5. `scripts/Get-SubagentPayload.ps1 -Name <name>` outputs valid Antigravity JSON.
6. No em dashes (U+2014) exist in any subagent markdown file.
