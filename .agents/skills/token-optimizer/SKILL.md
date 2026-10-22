---
name: "token-optimizer"
description: "Audit dual-harness token spend, identify context leaks, and optimize project repository file bloat."
category: efficiency
scope: structural
distribution: template
disable-model-invocation: true
license: MIT
---

# Token Optimizer: Dual-Harness Context Forensics & File Optimization

Unified token optimization engine for Google Antigravity and Anthropic Claude Code. Automatically isolates telemetry to the active harness, provides dual-lens visibility across active session burn and repository file bloat, and delivers immediate 1-click remediation actions.

Subsumes `ai-efficiency-audit` (retired) and [`context-budget`](../context-budget/SKILL.md).

---

## When to Use

- Monitor and prevent hitting session limits on Claude Code Pro or Antigravity Google AI Pro.
- Check exactly where tokens are going in the active conversation ($0 offline cost).
- Identify project repository files or instruction sets that have grown too large (>400 lines or >4k tokens).
- Distinguish legitimate operational workload from preventable context leaks.
- Invoked via `/token-optimizer`, `/token-audit`, or `/ai-efficiency-audit`.

---

## 3-Phase Execution Pipeline

### Phase 1: Automatic Harness Detection & Dual-Lens Telemetry

Run the telemetry engine directly:

```powershell
# Auto-detects current engine (Antigravity vs Claude) and audits latest session
pwsh -NoProfile -File scripts/Audit-AiEfficiency.ps1 -Latest

# Audit specific lookback window (default: 24 hours)
pwsh -NoProfile -File scripts/Audit-AiEfficiency.ps1 -HoursBack 24

# Explicitly override harness if cross-auditing
pwsh -NoProfile -File scripts/Audit-AiEfficiency.ps1 -Engine Claude
pwsh -NoProfile -File scripts/Audit-AiEfficiency.ps1 -Engine Antigravity
pwsh -NoProfile -File scripts/Audit-AiEfficiency.ps1 -Engine All
```

The engine executes offline with 100% local parsing ($0 API cost):

- **Antigravity Telemetry:** Decodes SQLite protobuf metadata from `~/.gemini/antigravity/conversations/<id>.db` via [`scripts/get-harness-tokens.py`](../../../scripts/get-harness-tokens.py). Extracts exact active context tokens, total output tokens, reasoning thinking tokens, and step latency.
- **Claude Code Telemetry:** Extracts exact usage objects from `~/.claude/projects/*/*.jsonl`. Reports exact prompt tokens, cache read hit rate %, and thinking tokens.
- **Hermes Telemetry:** `-Latest` does NOT cover Hermes sessions and its auto-detection can scope a stale Antigravity session as "active"; always label the harness scope in the report. For exact Hermes session tokens, query the Hermes `state.db` read-only (`file:...?mode=ro`): `sessions` and `session_model_usage` hold per-session/per-model `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `reasoning_tokens`, and `estimated_cost_usd`, with `model_config` carrying the reasoning effort. Model window + list pricing: the Hermes `models_dev_cache.json`.

---

### Phase 2: Dual-Lens Analysis & Attribution

The scorecard renders two diagnostic views:

#### Lens 1: Active Session Forensics & Quota Drain Attribution

- **Bucket 1 (Legitimate Operational Load):** Code diffs, multi-file edits, vertical slice test runs.
- **Bucket 2 (Preventable Waste & Leaks):**
  - Context snowballing (turns > 50).
  - Repetitive tool loops (commands run >= 3x).
  - Subagents dispatched with `Model: 'inherit'` multiplying reasoning tokens.
  - Mid-session cache busts / model flipping.
- **Efficiency Ratio:** Displays exact percentage attribution (e.g. `82% Productive Work | 18% Preventable Waste`).

#### Lens 2: Project Context Map & File Bloat

- **Always-Loaded Base:** Measures token footprint of preloaded instruction files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `MASTER-INSTRUCTIONS.md`).
- **Top 10 Repository Hogs:** Scans project workspace files, flagging split candidates (>400 lines or >4,000 tokens) per [`standards/template-standard.md`](../../../standards/template-standard.md).
- **Session File Correlator:** Matches files opened via `view_file` or `View` during the session against their token contribution.

---

### Phase 3: Interactive Remediation Palette

Surface the 4-action remediation menu and execute chosen option upon user reply:

1. **[1] Generate Handoff Checkpoint:** When turns >= 50, automatically write a checkpoint to [`handoff-docs/`](../../../handoff-docs/handoff-docs-index.md) and advise opening a fresh session window to reset context to 0 tokens.
2. **[2] Batch Repeated Tool Loops:** If commands run >= 3x, combine them into a single PowerShell or Python script per Rule 3.
3. **[3] Split / Truncate File:** Split bloated markdown files into parent router + children per [`standards/template-standard.md`](../../../standards/template-standard.md).
4. **[4] Tactical Prompt Compression:** Emit a high-density prompt refactor card stripping conversational preambles and enforcing checkable bounds per [`standards/system-prompt-authoring.md`](../system-prompt-authoring/SKILL.md).

---

## Standing Footer Integration

Active sessions display verified context tokens in the standing chat footer above Next Actions:

```text
**Model Rating:** [Model & Effort] ([Rating]) | **Next:** [Recommended Model] ([Cache Advice]) | **Context & Turn Gauge:** [Verified Tokens]k / 150k tokens [Verified] (Prompt X/50) ([Optimal | WARNING])
```

Context tokens must be read from disk ground truth via `scripts/get-harness-tokens.py --active-only` rather than heuristic guesses.

---

## Completion Criteria

- [ ] Telemetry script executes cleanly with zero errors in under 2 seconds.
- [ ] Active context tokens match exact disk logs across Antigravity SQLite and Claude Code JSONL.
- [ ] Lens 1 correctly separates productive work from preventable leaks.
- [ ] Lens 2 identifies and flags top repository file bloat candidates.
- [ ] No U+2014 em dashes exist in documentation or scripts.
