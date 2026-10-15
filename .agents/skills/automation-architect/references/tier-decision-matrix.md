# Automation Tier Decision Matrix

Choosing the right automation tier is a cost-of-failure and statefulness calculation, not a matter of convenience. Always default to the lowest tier that satisfies the operational requirement.

---

## The 7 Tiers at a Glance

| Tier       | Engine / Technology                                                                           | Latency            | Failure Cost         | Token Cost                | Statefulness       | Best For                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------- | ------------------ | -------------------- | ------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Tier 1** | Local PowerShell 7 / Python scripts                                                           | Sub-second (<1s)   | Near zero            | \$0 (Zero)                | Stateless / File   | Deterministic file transforms, index builds, lints, local health checks.                                                                |
| **Tier 2** | Windows Task Scheduler (`schtasks.exe`)                                                       | Scheduled / Event  | Low                  | \$0 (Zero)                | Persistent OS      | 24/7 background daemons, scheduled backups, queue polling, sleep-waking runs.                                                           |
| **Tier 3** | Autonomous LLM Agent Loops (Hermes / Antigravity / Claude)                                    | Seconds to minutes | Medium-High          | Variable (\$0.05-\$2.00+) | Context / Memory   | Tasks requiring semantic synthesis, multi-source research, code refactoring, kanban fleet dispatch.                                     |
| **Tier 4** | n8n Visual Workflow Engine                                                                    | 1-5 seconds        | Medium               | \$0-\$0.10 (Hybrid)       | SQLite / Postgres  | Multi-app webhooks, external SaaS APIs, visual branch auditing, item iteration.                                                         |
| **Tier 5** | Model Context Protocol (MCP)                                                                  | Sub-second to 2s   | Low-Medium           | Per-prompt tool overhead  | Stateless Protocol | Live tool discovery for LLM hosts (Hermes desktop, Antigravity, Claude Code; databases, filesystem, external APIs).                     |
| **Tier 6** | Git Lifecycle Pre-Commit Hooks                                                                | 1-3 seconds        | High (blocks commit) | \$0 (Zero)                | Git Index          | Enforcing repository invariants (zero em-dash, lints, syntax checks).                                                                   |
| **Tier 7** | Agent Lifecycle Hooks (Antigravity `.agents/hooks.json`, Claude Code `.claude/settings.json`) | Sub-second (<1s)   | Medium               | \$0 (Zero)                | Session            | Inviolable agent-behavior invariants enforced at action time: PreToolUse deny gates, SessionStart context injection, Stop verification. |

---

## Tier Selection Rules

### Default to Tier 1 (Deterministic Scripts) When:

1. The logic is fully predictable with explicit rules (no fuzzy reasoning needed).
2. The task operates strictly on local files, git history, or local databases.
3. Execution can be triggered manually or called by higher tiers.
4. Fast feedback (<5 seconds) is essential.

### Elevate to Tier 2 (Windows Task Scheduler) When:

1. The task must run unattended on a recurring clock schedule (hourly, daily) or system event (on logon, on idle, on unlock).
2. The task must survive reboots and run silently in the background without user intervention.
3. The machine may be sleeping and needs to wake up (`WakeToRun: true`).
4. Credentials must be isolated without interactive password prompts (`LogonType: S4U`).

### Reserve Tier 3 (Autonomous Agent Loops) Strictly When:

1. The task requires cognitive judgment that cannot be encoded in procedural code:
   - Synthesizing conflicting unstructured web sources.
   - Deciding when qualitative research is "complete".
   - Performing autonomous multi-file refactors with AST verification.
2. **Hard Rule:** Never use Tier 3 for scheduled data syncing, file moving, or deterministic polling. Agent loops carry fixed token overhead (286-588 tokens per tool request) and risk runaway loops if unbounded.
3. **Hermes Lane:** Hermes cron jobs and kanban dispatches are Tier 3 executors behind a clock or queue trigger: sanctioned for semantic work (digests, reviews, fleet tasks), still the LLM-cron anti-pattern when polling a folder or inbox a Tier 1/2 script should watch. Jobs that must run while the Hermes app is closed belong to Tier 2.

### Route to Tier 4 (n8n Workflow Engine) When:

1. The task connects two or more external cloud services (e.g. Gmail, Discord, Google Sheets, Stripe, Notion).
2. An inbound webhook must be received, validated, and acknowledged asynchronously.
3. Non-developer operators or visual auditing of branching workflows is required.
4. Complex error sub-workflows, retry loops, and visual execution traces are beneficial.

_Note on Local Environment:_ When n8n is not yet running or configured locally, provide a Tier 1 PowerShell fallback (`Invoke-RestMethod` / CLI script) alongside a simple guide to spin up local n8n via Docker or npm.

### Route to Tier 5 (Model Context Protocol / MCP) When:

1. An LLM agent (Hermes desktop, Antigravity, Claude Code) needs real-time, on-demand read/write access to external resources during conversation.
2. The tool definitions must be standardized across multiple AI harnesses without vendor lock-in.

### Reserve Tier 6 (Git Pre-Commit Hooks) When:

1. The gate must be inviolable and block human/AI errors before git history is written.
2. The check executes in under 2 seconds (e.g. regex scans for U+2014 em dashes, JSON/PSD1 syntax validation).

### Route to Tier 7 (Agent Lifecycle Hooks) When:

1. The invariant must bind the agent's behavior at the moment an action fires (PreToolUse deny), steer session startup (SessionStart / UserPromptSubmit injection), or verify at turn end (Stop): enforcement at action time, not after the damage lands in git history (that is Tier 6).
2. The gate is deterministic, sub-second, and zero-token: a hook is Tier 1 code wired into the engine lifecycle and never calls an LLM. If judgment is needed, the hook denies with a reason that routes the agent to the right skill.
3. Session-scoped enforcement is acceptable: hooks bind engine sessions via [`.agents/hooks.json`](../../../../.agents/hooks.json) (Antigravity) and [`.claude/settings.json`](../../../../.claude/settings.json) (Claude Code); they do not persist at the OS layer (Tier 2) or the git-history layer (Tier 6).

_Budget note:_ every hook declares a kill timeout (5-30 s; 30 s hard cap) that only bounds a hung subprocess. Expected runtime is sub-second. Health gate: `pwsh -File scripts/Get-AutomationSurface.ps1 -Verify` exits 1 on any wired hook whose script is missing, a stub, over budget, or failing its selftest.

---

## Anti-Patterns & Downgrade Triggers

- **Anti-Pattern 1: The "LLM Cron Job"**
  Running an LLM agent on a 5-minute cron to check a folder or inbox.
  _Fix:_ Use a Tier 2 Task Scheduler running a Tier 1 PowerShell script. Only invoke an LLM agent when an item actually requires semantic evaluation. Hermes cron jobs running semantic work (digests, reviews) are sanctioned Tier 3; Hermes cron polling a folder is this anti-pattern.

- **Anti-Pattern 2: The "Monolithic Python Daemon"**
  Writing an infinite `while True: time.sleep(60)` script that dies silently on crash or sleep.
  _Fix:_ Use Tier 2 Windows Task Scheduler with `RestartOnFailure` and `MultipleInstancesPolicy: IgnoreNew`.

- **Anti-Pattern 3: The "Blind Webhook Handler"**
  Writing bespoke Express/Flask servers for every webhook.
  _Fix:_ Route webhooks through Tier 4 n8n with built-in validation gates, or a lightweight PowerShell event listener.

- **Anti-Pattern 4: The "Cognitive Hook"**
  Putting LLM judgment, network calls, or slow work inside a lifecycle hook, stalling every agent action behind it.
  _Fix:_ Hooks are Tier 1 code: deterministic, sub-second, fail-open. Reserve hooks for invariants; let a deny reason route judgment work to a Tier 3 step.
