---
name: "task-scoping"
description: "Break a spec, brief or multi-part goal into gated vertical-slice task cards. Use when work is large, vague or needs a build plan."
category: planning
scope: "structural"
distribution: template
license: MIT
---

# Task Scoping: Spec to Vertical Slices

Turns a spec, design brief, project goal, or any request too big for one task into ordered vertical slices, each a real `tasks/<slug>.md` with falsifiable `Done when` claims and a gate-assigned `lane:`. Replaces the retired `brief-to-tasks` and `planning-and-task-breakdown` skills per [ADR-0065](../../../decisions/0065-task-lifecycle-consolidation-and-delegation-gate.md). Single-action capture stays in [`task-management`](../task-management/SKILL.md); execution is [`next-action`](../next-action/SKILL.md).

## Steps

1. **Load the source.** Read the spec card from `/spec` (Idea to Ship), or the spec or brief from `projects/<slug>/` (`spec.md`, `project.md`, any brief). The project is the spec card's `project:` value. If several projects match, ask which one. No written source: ask the user to describe the outcome, or run [`grill-me`](../grill-me/SKILL.md) first when the goal itself is foggy.
2. **Read-only survey.** No code yet. Map what exists (components, scripts, tokens, tests, naming), classify each touched piece as reuse, modify, or create; only modify/create get slices. Note risks and unknowns.
3. **Dependency graph.** List what depends on what; foundations first.
4. **Slice vertically.** Each slice delivers one observable, verifiable outcome end to end (structure + behavior + styling together, never "all the schema, then all the UI"). No "set up the project" slices. Size S or M (at most 5 files); an L slice is split; "and" in a title is two slices.
5. **Order:** dependencies first, then highest risk (fail fast), then most visible (the user validates direction early). Insert a checkpoint slice ("end-to-end flow works, the user reviews") after every 2 to 3 slices.
6. **Write each slice** with [`scripts/New-Task.ps1`](../../../scripts/New-Task.ps1) (the only write path, [ADR-0019](../../../decisions/0019-deterministic-scripts-own-substrate-mutations.md)): `-Project "projects/<slug>/project.md"`, `-BlockedBy` for real dependencies, `-Verify "<one command that proves it>"`, `-StartFiles` for the files likely touched, and `-Content` holding one-paragraph intent plus 3 to 6 probe-named `Done when` claims. Let the gate assign the lane. Run it from the AIOS root, also when the chat started in a project repo. Put `Parent: <spec card link>` as the first line of `-Content`. **Claim rule:** a slice that this run builds now gets `-Status 'In progress'`, because the autonomous picker takes only `Not started` cards. Slices left for later stay `Not started`.
7. **Resolve gate failures now, not later.** Any slice landing in `grill` gets its open question batched into one `/grill-me` round (at most 3 questions total) before scoping ends; rewrite claims and re-gate.
8. **Record the plan beside the source.** For a spec card, write the plan as a `## Plan` section on that card. Otherwise write `projects/<slug>/plan.md`: architecture decisions, risks, open questions, and an ordered list linking each slice's task file. Never write `tasks/plan.md`, `tasks/todo.md`, or a second `TASKS.md`; root [`TASKS.md`](../../../TASKS.md) is generated ([ADR-0025](../../../decisions/0025-federated-task-dashboard-and-milestone-rollups.md)).
9. **Plan the execution** in an `## Execution` section beside the plan, one line for each slice:
   - **Models:** read the live list with `orchestrator_capabilities` and apply the [model router](../../../tools/model-router.md). Mechanical slices go to the cheapest ready model; architecture, security and integration stay with the orchestrator. If quota is unknown, say so; do not invent headroom.
   - **Parallel:** a group of 2 or more slices with no `blocked_by` edge between them and no shared `start_files` runs through [`ceo`](../ceo/SKILL.md) (delegated workers, each result checked). Otherwise, run them in order in this chat.
   - **New chat:** only when the remaining slices will not fit in this chat (about 30 turns, or a phase boundary). Write a [handoff](../../../handoff-docs/handoff-docs-index.md) with a resume prompt. Open a separate top-level thread only when the user asks for one.

## Slice claim shape

```markdown
## Done when

- [ ] `pwsh -NoProfile -File scripts/<Script>.ps1 -SelfTest` exits 0
- [ ] `<path/file>` renders the empty, loading, and error states from the brief
- [ ] `pwsh -NoProfile -File scripts/Audit-Substrate.ps1` reports 0 defects
```

## Done when

- [ ] Every slice exists as `tasks/<slug>.md`, created by `New-Task.ps1`, linked to its project.
- [ ] Every slice has 3 to 6 probe-named claims and a `lane:` other than `grill` (or the user deferred the grill explicitly).
- [ ] `projects/<slug>/plan.md` lists the slices in order with checkpoints and links.
- [ ] Slices built in this run are `In progress`; the `## Execution` section gives each slice a model tier and says serial, parallel or new chat.
- [ ] `pwsh -NoProfile -File scripts/Audit-Tasks.ps1` ends with `[PASS]` (no cycles in `blocked_by`).
