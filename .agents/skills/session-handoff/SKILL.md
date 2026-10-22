---
name: session-handoff
description: "Compact conversation and working tree state into handoff-docs/ with a fresh-session resumption prompt."
category: flow
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
scope: personal
distribution: template
owner: leonidas
license: MIT
---

# Handoff

Turn everything learned in this session into a single **handoff document** so a fresh agent can resume work cold without losing context or repeating failed approaches. The purpose is transfer, not archival: capture the _state, reasoning, and transient frontier_ that only lives in this chat, while pointing at permanent repository artifacts rather than copying them.

**Chain position:** Step 2 of the [Session Ritual Chain](../../../workflows/session-ritual-chain.md): run when switching tasks, engines, or directories. Upstream neighbor: [`chat-sync`](../chat-sync/SKILL.md) owns durable canon first (the Step 0 rule below). Downstream neighbor: [`chat-closeout`](../chat-closeout/SKILL.md) certifies archive readiness.

## Core Rules

1. **Canon First (The Step 0 Rule):** Never trap durable architectural decisions, system facts, or standing preferences in a handoff document. Run [`chat-sync`](../chat-sync/SKILL.md) first or directly update permanent facts in [`memory/`](../../../memory/memory-index.md), [`decisions/`](../../../decisions/decisions-index.md), or [`BUILD-PLAN.md`](../../../BUILD-PLAN.md).
2. **Handoff is for the Transient Frontier:** The handoff document records what a zero-context agent cannot find by reading repository canon: uncommitted working tree diffs, active spikes, failed dead ends, the immediate 2 to 3 next tasks, and open blocker questions.
3. **Goal-Slanted Focus:** If the user provides a focus argument (e.g. `/session-handoff fix frame pacing in Moonlight`), tailor the entire document, next steps, and pruned context around that objective.
4. **Strict Redaction:** Never write secrets, API keys, passwords, bearer tokens, or PII into the handoff document. Refer to them symbolically (e.g., `the API key in .env`).
5. **Every handoff carries its resume prompt:** the doc opens with a `## 0. Resume Prompt` block, and the final chat message prints only that block. Never paste the whole doc into chat; the prompt is what the user copies. The pre-commit Handoff Resume Gate blocks a new handoff doc without it, so a handoff written without this skill loaded still fails closed. It also carries `status: open` in frontmatter (`open | resumed | closed | superseded`, gate-enforced). A session that resumes a handoff sets `status: resumed`, and one that finishes it sets `closed` and moves it to `handoff-docs/archive/`. [`Check-OpenHandoffs.ps1`](../../../scripts/Check-OpenHandoffs.ps1) lists open ones older than 3 days across both handoff folders.

## Save Location & Naming

Save to `<project-root>/handoff-docs/YYYY-MM-DD-<topic-slug>.md`:

- Path: `<repo>/handoff-docs/YYYY-MM-DD-<topic-slug>.md`
- Auto-create `handoff-docs/` if it does not exist.

---

## Execution Procedure

### Step 0: Canon Synchronization Pass

1. Scan the conversation for durable decisions, roadmap updates, or permanent system facts.
2. Promote all unwritten durable items into [`BUILD-PLAN.md`](../../../BUILD-PLAN.md), [`decisions/`](../../../decisions/decisions-index.md), or [`memory/`](../../../memory/memory-index.md) before writing the handoff.
3. For each project the session touched, apply the write-back rule in [`templates/agent-playbook-template.md`](../../../templates/agent-playbook-template.md): update `projects/<project>/agent-playbook.md` and add one dated line. The handoff holds this session's frontier; the playbook holds what every future session needs.

### Step 1: Inspect Working Tree & Environment

1. Execute `git status -s` to obtain an exact inventory of modified, untracked, and deleted files.
2. Note test outcomes, active tool executions, or scratch scripts in progress.

### Step 2: Write Handoff Document

Write `<project-root>/handoff-docs/YYYY-MM-DD-<slug>.md` using the template below.

**Writing Registers:**

- **Current State, Next Steps, Verification:** ASD-STE100 style (one instruction per sentence, active voice, present tense, <=20 words per procedural sentence, concrete file paths).
- **Goal, Decisions & Constraints, Dead Ends:** Conversational reasoning preserving the _why_ and discarded alternatives so the next agent does not repeat mistakes.

````markdown
---
status: open
---

# Session Handoff: [Task Title]

**Date:** YYYY-MM-DD | **Operator:** <user> | **Status:** [In Progress / Checkpoint / Blocked]
**Saved to:** `handoff-docs/YYYY-MM-DD-<slug>.md`

## 0. Resume Prompt

```text
Resume from `handoff-docs/YYYY-MM-DD-<slug>.md`. Read it fully, then the files its §2 lists. Verify git state matches §2 and do not redo anything marked done. Present §5, then start step 1 unless it needs my input.
```
````

## 1. Goal & Focus

Summary of what we are building and why. Slanted toward the next session focus if provided.

## 2. Changes Landed & Working Tree

- **Canon Updated**: Links to updated files ([`memory/`](../../../memory/memory-index.md), [`BUILD-PLAN.md`](../../../BUILD-PLAN.md), [`decisions/`](../../../decisions/decisions-index.md)).
- **Modified**: [`path/to/file.ext`](../../..), [1-line summary]
- **Created**: [`path/to/new_file.ext`](../../..), [Purpose]
- **Uncommitted State**: Output of `git status -s`.

## 3. Decisions & Constraints

- **Decisions Locked**: [Choices made with links to canon]
- **Constraints**: [Hard boundaries not to violate]

## 4. Dead Ends & Ruled Out Approaches

- **Discarded Option 1**: [What was tried, why it failed, and why not to re-attempt]

## 5. Next Session Action Plan

1. [ ] [Immediate next procedural action with exact target file]
2. [ ] [Follow-up implementation or verification step]

## 6. How to Run / Verify

[Exact command or script to build, test, or verify the current state]

## 7. Suggested Skills for Next Agent

- `@skills/[skill-name]`: [Why to invoke]

```

### Step 3: Emit the Resume Prompt
Commit the doc, then end the chat turn with the §0 block in a `text` fence under a `📋 Resume prompt` line. Print nothing else from the doc: the file is already on disk and linked.

```
