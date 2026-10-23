---
name: "automation-architect"
description: "Audit AIOS automation gaps, deconstruct workflows into deterministic state machines, and route to optimal 7-tier automation engines."
category: planning
scope: "structural"
distribution: template
disable-model-invocation: true
license: MIT
---

# Automation Architect

Audit automation surfaces across Leonidas AIOS, identify manual friction and tool integration gaps, deconstruct workflows into deterministic state machines, and route implementation to the optimal tier across the 7-tier automation hierarchy.

---

## 1. The AIOS 7-Tier Automation Standard

Every workflow, script, and background task in AIOS maps to one of seven explicit tiers. Always default to the lowest tier that satisfies the requirement:

1. **Tier 1: Deterministic Local Scripts (PowerShell 7 / Python)**: Stateless, sub-second execution for local file transforms, builds, and checks.
2. **Tier 2: Windows Task Scheduler (`schtasks.exe`)**: 24/7 persistent background jobs, event-driven triggers, and sleep-waking recurring runs.
3. **Tier 3: Autonomous LLM Agent Loops (Hermes / Antigravity / Claude Code)**: Complex qualitative reasoning, multi-source research, code refactoring, and Hermes kanban fleet dispatch. Hermes cron jobs and kanban dispatches are Tier 3 executors behind a clock or queue trigger; Tier 2 still owns jobs that must run while the Hermes app is closed.
4. **Tier 4: n8n Visual Workflow Engine**: Multi-app webhook ingestion, external API orchestrations, and visual branching logic.
5. **Tier 5: Model Context Protocol (MCP)**: Live tool and resource discovery for conversational AI agents (Hermes desktop, Antigravity, Claude Code).
6. **Tier 6: Git Lifecycle Pre-Commit Hooks**: Fast (<2s) mechanical gates blocking repository errors before commit.
7. **Tier 7: Agent Lifecycle Hooks (Antigravity / Claude Code)**: Deterministic, sub-second, zero-token gates wired into the engine lifecycle (PreToolUse deny, SessionStart context injection, Stop verification), enforcing inviolable agent-behavior invariants at action time. Config lives in [`.agents/hooks.json`](../../../.agents/hooks.json) and [`.claude/settings.json`](../../../.claude/settings.json).

For detailed tradeoffs, latency benchmarks, and selection criteria, consult [tier-decision-matrix.md](references/tier-decision-matrix.md).

---

## 2. Procedure

### Phase 1: Repository Surface & Gap Audit

When requested to audit the system or identify automation opportunities:

1. **Inventory Existing Scripts & Tasks (zero LLM tokens):**
   - Run `pwsh -File scripts/Get-AutomationSurface.ps1` to regenerate [`wiki/automation-register.md`](../../../wiki/automation-register.md): live Tier 2 registrations with Hidden/S4U/ExecutionTimeLimit/IgnoreNew compliance flags, Tier 2 daemons, Tier 6 git hooks, and the Tier 7 engine hook inventory (every wired hook per engine with event, group, matcher, script, timeout, and health status), in one deterministic pass.
   - Read the regenerated register instead of re-deriving it by hand.
   - Detect unmonitored scripts: scripts run manually that lack automated triggers or health telemetry (Tier 1 section of the register).
   - Read the register's MANUAL:TIER3-AGENTS section for scheduled agent surfaces (Hermes cron jobs, kanban recurring dispatches): the register is their inventory of record.
2. **Audit Tool & Surface Connections:**
   - Read [`connections.md`](../../../connections.md) and [`tools/tools-index.md`](../../../tools/tools-index.md).
   - Identify installed binaries, APIs, or MCP servers that lack automated workflow pipelines.
3. **Identify Cognitive & Manual Friction:**
   - Scan recent git history and user notes for repetitive manual sequences (tasks executed 3+ times).
   - Flag processes where the user waits on slow commands or manually copies data between apps.

### Phase 2: Workflow & Loop Deconstruction

Before writing code or configuring an engine, break the candidate workflow into five unambiguous specifications:

1. **Trigger:** What initiates the run? (Clock schedule, file creation, git commit, webhook, or manual kick).
2. **Pre-conditions & Inputs:** Required system state, environment variables, dependencies, and network access.
3. **Atomic Transformations:** The sequential state transitions. Each step must be idempotent and isolated.
4. **Verification Gate:** The programmatic check proving the step succeeded (exit code 0, regex match, test pass).
5. **Failure Recovery:** What happens on error? (Retry policy, circuit breaker trip, or alert notification).

**Manifest coupling (SAWP):** these five fields double as the schema of a declarative
automation manifest at `automations/<slug>.yaml`, which adds `tier`, the tier's
registration parameters (`script`, `trigger`, `execution_time_limit`), and `telemetry`.
Authoring the manifest IS recording the deconstruction. Compile it with
[`scripts/Compile-AutomationManifest.ps1`](../../../scripts/Compile-AutomationManifest.ps1):
the compiler emits the routed tier's artifacts (Tier 2: the registration, the
register row, the REGISTRATION-NOTES row), so documentation stays a compiled artifact
instead of a hand-synced copy. Re-run it after any manifest edit; it is idempotent and
fails loudly on tier emitters that do not exist yet.

### Phase 2b: Cognitive Classification Gate (mandatory)

For every step in the deconstruction, ask: is the answer one of a finite list (route, tag, triage, yes/no, score)? If yes, it is a System-1 step, not a Tier 3 agent step ([ADR-0068](../../../decisions/0068-system-one-decision-engine-laya-and-openrouter-jev.md), [`standards/system-one-routing-standard.md`](../../../standards/system-one-routing-standard.md)).

- Laya locally for 20 labels or fewer; OpenRouter Jev above 20, in Game Mode, or when the daemon is down. The client fails over automatically.
- Gate side effects on `confidence`, keep a deterministic fallback, and never place System-1 in Scribe's live dictation path.
- Drop-in step (Python or shell):
  `python scripts/route-system-one.py --text "$TEXT" --labels "a,b,c"` prints `{"label","confidence","engine","ms"}`.
- Drop-in step (PowerShell): `$r = pwsh -NoProfile -File scripts/Route-SystemOne.ps1 -Text $text -Labels a,b,c | ConvertFrom-Json; if ($r.confidence -lt 0.8) { <escalate to Tier 3> }`

### Phase 3: Tier Routing & Engine Selection

Map the deconstructed workflow to its optimal tier using [tier-decision-matrix.md](references/tier-decision-matrix.md):

- If the task is purely local and deterministic -> **Tier 1 (PowerShell/Python)**.
- If the task must run 24/7 or survive reboots on Windows 11 -> **Tier 2 (Windows Task Scheduler)**.
- If the task requires judgment or unstructured synthesis -> **Tier 3 (Agent Loop)**.
- If the task connects external SaaS APIs or handles webhooks -> **Tier 4 (n8n)**.
  - _n8n Status Guard:_ Check if n8n is active locally. If n8n is not yet running or configured, provide an immediate Tier 1 PowerShell fallback (`Invoke-RestMethod`) and offer a simple setup walkthrough.
- If the task exposes a tool to the conversational agent -> **Tier 5 (MCP)**.
- If the task enforces an inviolable repository invariant -> **Tier 6 (Git Hook)**.
- If the task enforces an inviolable agent-behavior invariant at action time (deny a tool call, inject session context, verify at Stop) -> **Tier 7 (Agent Lifecycle Hook)**.
- If the workflow is authored as an `automations/<slug>.yaml` manifest, the routed tier is declared in the manifest and compiled to that tier's artifacts by [`scripts/Compile-AutomationManifest.ps1`](../../../scripts/Compile-AutomationManifest.ps1) (Tier 2 emission implemented; new tiers land as emitters).

### Phase 4: The Human-in-the-Loop & Wizard Bridge

Pure software automations frequently fail when an external account login, MFA challenge, browser session, or physical hardware action is required.

- Whenever a workflow encounters an unavoidable manual operator step, **do not leave the process as a vague manual chore**.
- Automatically invoke or generate a Wizard script adhering to [manual-setup-walkthrough](../manual-setup-walkthrough/SKILL.md):
  1. Pre-flight dependency check.
  2. Clear console pause: `Read-Host "Press Enter once [action] is completed..."`.
  3. Programmatic post-verification checking that the human action succeeded before resuming automated steps.

### Phase 5: Resilience Engineering & Quality Control

Apply core engineering principles from [resilience-principles.md](references/resilience-principles.md):

1. **Idempotency:** Implement Stripe-style keys or Azure atomic marker commits to prevent duplicate executions.
2. **Backoff & Circuit Breakers:** Pair transient retries (exponential backoff) with a Closed/Open/Half-Open circuit breaker to prevent retry storms.
3. **Windows 11 Hardening:** Register every new Tier 2 task through [`scripts/New-AiosScheduledTask.ps1`](../../../scripts/New-AiosScheduledTask.ps1), the one sanctioned registration path. It bakes in `Hidden`, `S4U`, a bounded `ExecutionTimeLimit` (default 1 hour), and `IgnoreNew` per [windows-task-scheduler-guide.md](references/windows-task-scheduler-guide.md), so hardening cannot be forgotten per task. Do not hand-write `Register-ScheduledTask` calls for new tasks.

---

## 3. Completion Criteria ("Done When")

An automation architecture or audit is complete when:

- [ ] Every finite-label step passed the Cognitive Classification Gate (System-1 before generative LLM).
- [ ] Every identified workflow is mapped to a specific tier in the 7-tier hierarchy.
- [ ] Any manual operator steps are paired with an interactive Wizard script via [manual-setup-walkthrough](../manual-setup-walkthrough/SKILL.md).
- [ ] Every new Tier 2 task is registered via [`scripts/New-AiosScheduledTask.ps1`](../../../scripts/New-AiosScheduledTask.ps1), not a hand-written `Register-ScheduledTask` call.
- [ ] Retries are bounded and paired with circuit breakers or fail-fast policies.
- [ ] `pwsh -File scripts/Get-AutomationSurface.ps1 -Verify` exits 0: every live Tier 2 task is Hidden/S4U/bounded-ExecutionTimeLimit/IgnoreNew compliant and documented in the register.
- [ ] `pwsh -File scripts/Get-AutomationSurface.ps1 -Verify` also gates Tier 7: exits 1 on any wired hook whose script is missing, a stub, over its timeout budget, or failing its selftest (zero such defects required).
- [ ] `pwsh -File scripts/Detect-Drift.ps1` reports zero broken links for this skill.
- [ ] No U+2014 em dashes exist in generated scripts, docs, or task definitions.
