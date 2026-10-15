---
name: "task-scoping"
description: "Decompose specs, briefs, and multi-part goals into gated vertical-slice tasks via New-Task.ps1."
category: planning
scope: "structural"
distribution: template
disable-model-invocation: true
---

# Task Scoping: Spec to Vertical Slices

Turns a spec, design brief, project goal, or any request too big for one task into ordered vertical slices, each a real `tasks/<slug>.md` with falsifiable `Done when` claims and a gate-assigned `lane:`. Replaces the retired `brief-to-tasks` and `planning-and-task-breakdown` skills per [ADR-0065](../../../decisions/0065-task-lifecycle-consolidation-and-delegation-gate.md). Single-action capture stays in [`task-management`](../task-management/SKILL.md); execution is [`next-action`](../next-action/SKILL.md).

## Steps

1. **Load the source.** Read the spec or brief from `projects/<slug>/` (`spec.md`, `project.md`, any brief). If several projects match, ask which one. No written source: ask Jake to describe the outcome, or run [`grill-me`](../grill-me/SKILL.md) first when the goal itself is foggy.
2. **Read-only survey.** No code yet. Map what exists (components, scripts, tokens, tests, naming), classify each touched piece as reuse, modify, or create; only modify/create get slices. Note risks and unknowns.
3. **Dependency graph.** List what depends on what; foundations first.
4. **Slice vertically.** Each slice delivers one observable, verifiable outcome end to end (structure + behavior + styling together, never "all the schema, then all the UI"). No "set up the project" slices. Size S or M (at most 5 files); an L slice is split; "and" in a title is two slices.
5. **Order:** dependencies first, then highest risk (fail fast), then most visible (Jake validates direction early). Insert a checkpoint slice ("end-to-end flow works, Jake reviews") after every 2 to 3 slices.
6. **Write each slice** with [`scripts/New-Task.ps1`](../../../scripts/New-Task.ps1) (the only write path, [ADR-0019](../../../decisions/0019-deterministic-scripts-own-substrate-mutations.md)): `-Project "projects/<slug>/project.md"`, `-BlockedBy` for real dependencies, `-Verify "<one command that proves it>"`, `-StartFiles` for the files likely touched, and `-Content` holding one-paragraph intent plus 3 to 6 probe-named `Done when` claims. Let the gate assign the lane.
7. **Resolve gate failures now, not later.** Any slice landing in `grill` gets its open question batched into one `/grill-me` round (at most 3 questions total) before scoping ends; rewrite claims and re-gate.
8. **Record the plan beside the source** as `projects/<slug>/plan.md`: architecture decisions, risks, open questions, and an ordered list linking each slice's task file. Never write `tasks/plan.md`, `tasks/todo.md`, or a second `TASKS.md`; root [`TASKS.md`](../../../TASKS.md) is generated ([ADR-0025](../../../decisions/0025-federated-task-dashboard-and-milestone-rollups.md)).

## Slice claim shape

```markdown
## Done when

- [ ] `pwsh -NoProfile -File scripts/<Script>.ps1 -SelfTest` exits 0
- [ ] `<path/file>` renders the empty, loading, and error states from the brief
- [ ] `pwsh -NoProfile -File scripts/Audit-Substrate.ps1` reports 0 defects
```

## Done when

- [ ] Every slice exists as `tasks/<slug>.md`, created by `New-Task.ps1`, linked to its project.
- [ ] Every slice has 3 to 6 probe-named claims and a `lane:` other than `grill` (or Jake deferred the grill explicitly).
- [ ] `projects/<slug>/plan.md` lists the slices in order with checkpoints and links.
- [ ] `pwsh -NoProfile -File scripts/Audit-Tasks.ps1` ends with `[PASS]` (no cycles in `blocked_by`).
