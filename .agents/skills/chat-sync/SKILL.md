---
name: chat-sync
description: "Sync in-session decisions, durable memories, tasks, and glossary terms into local AIOS files."
disable-model-invocation: true
category: flow
type: skill
id: skill-chat-sync
title: "Chat Sync: In-Conversation Memory & Log Sync"
kind: procedure
load: on-demand
owner: leonidas
scope: structural
distribution: template
verified: 2026-08-30
related: ["skills-index", "memory-durable", "standard-frontmatter"]
generated: false
license: MIT
---

# Chat Sync

Repeatable, non-terminal extraction procedure. Runs incrementally during active sessions to sync durable facts, decisions, tasks, and domain glossary updates into local AIOS files without closing the session.

**Chain position:** Step 1 of the [Session Ritual Chain](../../../workflows/session-ritual-chain.md), repeatable at any point mid-session. Downstream neighbors: [`session-handoff`](../session-handoff/SKILL.md) (context switch) and [`chat-closeout`](../chat-closeout/SKILL.md) (terminal gate).

---

## 5-Step Execution Workflow

### Step 1: Freshness Pass (Tight Filter)

Scan the conversation from newest to oldest. Discard superseded ideas, exploratory brainstorms, and abandoned alternatives. For long sessions (>30 turns), focus primarily on the recent 15-30 turns; scan earlier turns only for locked decisions not since overturned.

If nothing survives the freshness pass, return the **Empty Sync** string immediately and terminate.

### Step 2: Extract Candidates

Extract surviving items into six distinct channels:

1. **Durable Memory**: Standing preferences, architectural rules, feedback patterns, or system facts.
2. **Operational Tasks**: Actionable follow-ups, implementation items, or backlog tasks.
3. **Project Updates**: Status progressions, active decisions, or notes tied to a specific project.
4. **Domain Terminology**: Crystallized definitions or glossary terms for [`CONTEXT.md`](../../../CONTEXT.md).
5. **Staleness Flags**: Existing canon files that drifted or require revision based on this session.
6. **Project Learnings**: For each project under `projects/` this session changed or investigated: what would save the next agent time, tokens, cost or a wrong turn (module locations, data-source traps, the cheapest verify loop, gotchas paid for, why something is the way it is). 🟢 Auto-write into `projects/<project>/agent-playbook.md` (create it from [`templates/agent-playbook-template.md`](../../../templates/agent-playbook-template.md) if missing) plus one dated line in its section 7. Cross-project lessons stay in [`logs/lessons-learned.md`](../../../logs/lessons-learned.md).

### Step 3: Durability Gate

Apply the single logging test per [`MASTER-INSTRUCTIONS.md`](../../../MASTER-INSTRUCTIONS.md): **Is this durable?**

- Would knowing this change what a zero-context engine does or says in a future session?
- If yes, proceed to Step 4.
- If no (e.g. transient debugging logs, scratch syntax, standard Git edits already committed per [ADR-0010](../../../decisions/0010-git-history-replaces-the-master-log.md)), drop silently.

### Step 4: Risk-Tier Gating

| Tier                  | Condition                                                                                                        | Execution Action                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 🟢 **Auto-Write**     | Destination is unambiguous, non-destructive, and creates/updates tasks, projects, captures, or glossary entries. | Execute immediately via CLI scripts or inline edits.                   |
| 🔴 **Approval Queue** | **Every write targeting `memory/`**, ADR creations, schema changes, or ambiguous/destructive updates.            | Hold. Present paste-ready commands and wait for operator confirmation. |

_Rule:_ Every memory write is strictly 🔴. Dedup verification and confidence checks require human-in-the-loop glance.

### Step 5: Deterministic Execution & Routing

Execute approved and auto-tier writes using zero-token CLI helpers:

```powershell
# 1. Durable Memory (🔴 Gated - Run upon operator approval)
pwsh scripts/New-Memory.ps1 -Name "<Memory Title>" -Type <decision|preference|feedback|system|reference> -Description "<Dense Summary>" -Content "<Body Content>"

# 2. Operational Tasks (🟢 Auto-applied if unambiguous)
pwsh scripts/New-Task.ps1 -Name "<Verb-First Task Title>" -Priority <Critical|High|Medium|Low> -Scope <personal|structural>

# 3. Quick Capture (🟢 Auto-applied for unorganized thoughts)
pwsh scripts/Capture-Thought.ps1 -Content "<Thought Content>"
```

For detailed schema structures and deep routing edge cases, consult:

- [`references/memory-schemas.md`](./references/memory-schemas.md) (Frontmatter and taxonomy rules)
- [`references/routing-matrix.md`](./references/routing-matrix.md) (Collision handling and destination matrix)

---

## Output Contract

Structure the response using standardized markdown sections:

```markdown
### 🟢 Auto-Applied

- `Item description` -> `path/to/file.md` (Method: CLI/Inline)
  _(Emit "None" if nothing qualified)_

### 🔴 Approval Queue

Per gated item:

- **What**: Brief description of the durable fact or decision.
- **Destination**: Target file path (e.g. `memory/<slug>.md`).
- **Proposed Command / Content**: Paste-ready `scripts/New-Memory.ps1` command or text.
- **Why Gated**: Specific rationale (e.g. "Durable memory write requires operator review").

### 🗂️ Local Memory Touched

- `memory/<slug>.md` (Type): One-line summary of created/updated memory.
  _(Emit "None" if no memory was written)_

### 🕵️ Staleness Flags

- `path/to/file.md`: What changed and drift confidence (1=Low, 2=Medium, 3=High).
  _(Emit "None" if clean)_

### 📋 Topics Covered

3 to 7 words summarizing the session sync scope.

### Sync Status

`✅ Fully synced` OR `🔴 Items awaiting approval`
```

**Empty Sync Output:** When nothing survives Steps 1-3, return exactly:

> _"Nothing to sync, no new decisions, updates, or action items beyond what is already recorded. No writes made."_

---

## Executable "Done When" Criteria

A `chat-sync` invocation is complete when:

1. All surviving decisions and durable facts are either executed or listed in the 🔴 Approval Queue.
2. Every memory file created exists in `memory/` with a dense `description:`; [`memory/memory-index.md`](../../../memory/memory-index.md) lists it after `scripts/Build-Index.ps1` (generated, never hand-edited, per ADR-0063).
3. Every new task created exists in `tasks/` with valid frontmatter.
4. No Unicode U+2014 em dashes exist in any touched or generated files.
5. All markdown links in the output resolve to valid local repository files.
