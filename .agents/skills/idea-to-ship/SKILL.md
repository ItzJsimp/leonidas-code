---
name: idea-to-ship
description: "Run a build task from idea to ship: define, spec, plan, build, test, review, ship, with two approval stops. Use when asked to build, add, change or fix a feature, or to run the full workflow."
category: idea-to-ship
scope: structural
distribution: core
portable: true
type: skill
id: skill-idea-to-ship
title: "Idea to Ship"
kind: procedure
load: on-demand
owner: shared
verified: 2026-10-16
source: "https://github.com/addyosmani/agent-skills (adapted from .claude/commands, MIT, commit aeac41d)"
license: MIT
---

# Idea to Ship

The conductor. It holds no phase instructions: each phase command holds its own. Load one phase at a time, follow it fully, then go to the next.

## Steps

1. **Read the profile.** Open `.agents/workflow-profile.md` in the repo root. If it is missing, copy [references/workflow-profile-template.md](references/workflow-profile-template.md) there, fill it from the repo's AGENTS.md, CLAUDE.md and package files, and tell the user in one line.
2. **Size the task.** Say the size and the path in one line.
   - **XS** (1 file, cause known): skip `/grill-me`, `/spec` and `/plan`. Go to `/build` with a test that fails first (Prove-It).
   - **S or M:** run all phases. The plan can be one slice.
   - **L or larger:** run all phases. If the work needs more than one session, plan it with `wayfinder` first.
   - **Bug with unknown cause:** load `diagnosing-bugs` first, then return here as XS or S.
3. **Run the phases in order.** Before each phase, write `Phase N/7: <name>`. Load the command skill with the Skill tool. If the Skill tool is missing, read its `SKILL.md`.

   | #   | Phase  | Load                | Exit condition                        |
   | --- | ------ | ------------------- | ------------------------------------- |
   | 1   | Define | `grill-me`          | every open question answered          |
   | 2   | Spec   | `spec`              | spec approved (Gate 1)                |
   | 3   | Plan   | `plan`              | slices written with acceptance checks |
   | 4   | Build  | `build` (auto mode) | every slice committed                 |
   | 5   | Verify | `test`              | PASS                                  |
   | 6   | Review | `review`            | no Critical or Required findings      |
   | 7   | Ship   | `ship`              | user approved (Gate 2), shipped       |

4. **Stop only at the gates.** Gate 1: the spec. Gate 2: before push, merge, publish or release. Accept only a clear yes ("yes", "go", "approve"). A hedged answer is not a yes. Between the gates, stop only for the stop rules in `build`.
5. **Loop on failure.** A FAIL from `test` or `review` goes back to `build` with the findings. After 3 loops on the same failure, stop and report.
6. **Keep the state on the spec card.** Tick the `## Workflow` checklist on the spec card as each phase ends, so the work can continue after compaction or in a new chat.
7. **Report once at the end:** phases run, phases skipped (with reason), commits, checks with results, and gate decisions.

## Done when

- Each phase that ran has met its exit condition, or the report names the phase that stopped and why.
- Both gates have an explicit user answer recorded on the spec card.

Credit: adapted from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT). See [LICENSE](LICENSE).
