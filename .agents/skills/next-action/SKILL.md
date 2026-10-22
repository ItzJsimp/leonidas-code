---
name: next-action
description: "Pick the best next tasks from the task folder for the current operator, project, energy and mode. Use when asked what to work on, what is next, or to pick the next action."
category: flow
scope: structural
distribution: core
license: MIT
---

# Next Action: Context-Aware Task Discovery & Routing Engine

Find the real task store for the current project and operator, conduct quick interactive intake, rank the top 5 concrete actions, and route each to its optimal execution path (in-chat execution, fresh session prompt via prompt-composer, or autonomous subagents).

Works in any AIOS (any Leonidas AIOS) or standalone project repository (such as `leonidas-code`).

---

## Phase 1: Context & Store Resolution

Run the bundled resolver with `--rank`:

```bash
python <skill-folder>/scripts/resolve_tasks.py --workspace <workspace> --rank
```

### Discovery & Project Awareness

1. **Project Detection**: Detects whether the active session is running inside a specific project (e.g. `leonidas-code`, `leonidas-scribe`, etc.) or in an AIOS root.
   - For `leonidas-code` (standalone clone or within an AIOS `projects/leonidas-code` directory): prioritizes tasks belonging to `leonidas-code`.
   - Resolves generated project views, handles symlinks, and falls back to parent AIOS task stores if symlinks are unlinked or in separate checkouts.
2. **Operator Awareness**: Automatically identifies the active user:
   - **Operator lane**: Prioritizes tasks whose `lane` or `owner` matches the active user, plus unassigned project work (`lane: agent`, `lane: leonidas`), and hides other people's personal lanes.
3. **Cache & Fallback**: Validates cached store path in `.agents/next-action.json`. If Python is unavailable, uses the documented filesystem fallback.

---

## Phase 2: Interactive Quick Intake (2 to 4 Questions)

If the user already provided preferences in their prompt (e.g. "next action, skip", "what should I work on next, high energy", or specific domain constraints), **skip intake completely** and proceed straight to ranking.

Otherwise, prompt the user with interactive modal questions using the `ask_question` tool:

### Question 1: Energy Level (With Quick Skip All)

- **Question**: `"What is your current energy level for this session?"`
- **Options**:
  1. `(Recommended) Skip all & pick best match for me`
  2. `High Energy (Deep work, complex architecture, large feature build)`
  3. `Medium Energy (Focused slice, refactor, targeted bug fix, docs)`
  4. `Low Energy (Quick wins, chores, review backlog, small polish)`
- `is_multi_select`: false

> **CRITICAL SKIP RULE**:
> If the user selects Option 1 (`(Recommended) Skip all & pick best match for me`), **immediately stop asking questions**. Do NOT show Question 2 or Question 3. Proceed directly to ranking with AI-recommended defaults.

### Question 2: Scope & Focus Area (Only if Question 1 was NOT skipped)

- **Question**: `"Which area would you like to focus on?"`
- **Options**:
  1. `(Recommended) Best ready task in current project`
  2. `Core Code & Features (Implementation, bug fixes, UI/UX)`
  3. `Architecture & System Design (Prototypes, specifications, planning)`
  4. `Cleanup, Testing & Docs (Test suite, tech debt, documentation)`
- `is_multi_select`: false

### Question 3: Execution Preference (Optional / Filter)

- **Question**: `"How would you prefer to tackle the work?"`
- **Options**:
  1. `(Recommended) Show top options with execution recommendations`
  2. `In-Chat Execution (Work on it right here in this session)`
  3. `Prompt Composer (Generate a prompt to spin up a new focused chat)`
  4. `Subagent Delegation (Launch parallel background subagents)`
- `is_multi_select`: false

---

## Phase 3: Rank & Present Top 5 Tasks

Run the resolver with the selected parameters:

```bash
python <skill-folder>/scripts/resolve_tasks.py --workspace <workspace> --rank --energy <low|medium|high|all> --focus <code|arch|review|all>
```

Render the top 5 tasks in structured GitHub Markdown:

```markdown
# Next Actions for [User] · [Project]

**Context:** Project: `[project]` | Operator: `[User]` | Energy: `[Level]` | Focus: `[Domain]`

Here are the top 5 tasks ranked by priority and fit:

### 1. [[Task Title]](file:///<absolute-path-to-task>)

- **Priority:** High · **Effort:** Low · **Type:** Quick Win · **Lane:** [lane]
- **Why Now:** [1-2 sentences on impact and why this is ready now]
- **Recommended Route:** `🟢 In-Chat Execution` ("Bang it out right here")
  - _Why:_ Compact scope, clear finish line, and instant test verification in this session.

### 2. [[Task Title]](file:///<absolute-path-to-task>)

- **Priority:** High · **Effort:** High · **Type:** Deep Work · **Lane:** [lane]
- **Why Now:** [1-2 sentences on architectural necessity]
- **Recommended Route:** `🔵 New Chat (Prompt Composer)` ("Spin up a new focused chat")
  - _Why:_ Deep multi-file changes requiring fresh context window and dedicated extended reasoning.

### 3. [[Task Title]](file:///<absolute-path-to-task>)

- **Priority:** Medium · **Effort:** Medium · **Type:** Strategic · **Lane:** [lane]
- **Why Now:** [1-2 sentences]
- **Recommended Route:** `🟣 Subagent-Ready` ("Delegate to Subagent")
  - _Why:_ Independent modular verification slice that background agents can run concurrently.

[Tasks 4 and 5 in same format...]

---

### Next Steps:

- **Execute in this chat:** Reply `1` (or `Execute #1`) to begin immediately.
- **Spin up new chat:** Reply `Prompt #2` to get a production-ready, model-calibrated prompt via `prompt-composer`.
- **Spawn subagents:** Reply `Delegate #3` (or `Delegate [3, 4]`) to launch background workers.
```

---

## Phase 4: Execution Pathways

Based on the user's choice:

### 1. In-Chat Execution (`Execute #N`)

- Authorized immediately when chosen.
- Set task status to `In Progress` if tracked in a task ledger.
- Execute in disciplined test-first slices (TDD).
- Run project test/build commands to verify.
- Commit changes following `safe-parallel-commit` protocol.

### 2. Prompt Composer (`Prompt #N`)

- When the user wants to spin up a new dedicated chat/session, invoke the `prompt-composer` skill.
- Run `python <skill-folder>/scripts/resolve_tasks.py --workspace <workspace> --draft-prompt <N>` or compose the model-calibrated instruction block:

```markdown
<task>
[Task Title]
</task>

<context>
- Project: [project]
- Task Card: [file path]
- Objective: [Why now & key requirements]
- Start Here: [Start file or entry point]
</context>

<rules>
- Maintain code integrity and execute test-first slices.
- Verify changes against project standards and ensure clean git status.
- DO NOT edit unrelated files outside this task scope.
</rules>

<verification>
[Test command or binary observable criteria from Done When]
</verification>
```

### 3. Subagent Delegation (`Delegate #N` or `Delegate [N, M]`)

- When the user chooses delegation or a task is flagged `🟣 Subagent-Ready`:
  - In Leonidas Code / T3 harness: call `delegate_task` with structured brief.
  - In Antigravity native: call `invoke_subagent`.
  - Pass the exact task file, objective, boundaries, and acceptance tests.
  - When subagents complete, summarize verified evidence and report back to the user.
