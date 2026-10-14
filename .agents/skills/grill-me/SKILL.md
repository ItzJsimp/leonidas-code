---
name: grill-me
description: "Interview Jake on a plan, design or idea in frontier rounds with steelmanned options asked through the structured question tool (AskUserQuestion), never as chat text. Chat-only: writes nothing to canon beyond the grill-session log."
disable-model-invocation: true
category: planning
scope: structural
distribution: core
---

# Grill Me

Runs the shared [grilling engine](./references/grilling-engine.md) end to end,
unchanged. The engine owns setup and the capture file, frontier rounds, the
option quality bar, the round format, checkpointing, and synthesis; this skill
adds and relaxes nothing.

Boundary: grill-me never edits canon (`decisions/`, `CONTEXT.md`, standards).
When the interview should write ADRs and glossary terms as it goes, use
[`grill-with-docs`](../grill-with-docs/SKILL.md) instead. That write
side effect is the only difference between the two (ADR-0066).

## Workflow

1. Confirm the interview target (plan, architecture, or idea) in one line.
2. Load [`references/grilling-engine.md`](./references/grilling-engine.md) and
   execute it end to end.

## Done when

- [ ] The capture file `logs/grill-sessions/{date}-{slug}.md` exists and lists
      every round in ascending order with Jake's verbatim answers.
- [ ] The synthesis (settled architecture, accepted tradeoffs, next action) is
      appended to the capture file and shown in chat.
- [ ] `git status --short` shows no file changed outside `logs/grill-sessions/`.
