---
name: spec
description: "Step 2 of Idea to Ship: turn settled decisions into a testable spec and get it approved. Use after /grill-me, when a feature has no written spec, or when asked for /spec."
category: idea-to-ship
scope: structural
distribution: core
portable: true
type: skill
id: skill-spec
title: "Spec"
kind: procedure
load: on-demand
owner: shared
verified: 2026-10-16
source: "https://github.com/addyosmani/agent-skills (adapted from .claude/commands, MIT, commit aeac41d)"
license: MIT
---

# /spec: write the spec

Engine: `to-spec`. Step 1 (`/grill-me`) comes before it. Added from Addy Osmani's spec-driven-development: assumptions, the spec template and Boundaries.

## Steps

1. **Check the input.** Use the grill synthesis or the settled requirements in this chat. If the goal is still unclear, stop and run `/grill-me` first (from the conductor: load `grill-me`, then come back).
2. **List assumptions.** Before you write the spec, list each assumption you make. End with: "Correct me now, or I continue with these."
3. **Write.** Load `to-spec` and publish to the tracker named in `.agents/workflow-profile.md`. Use these sections. Write "none" for an empty section; do not delete it.
   - **Objective:** what, why, and for whom.
   - **Commands:** full build, test and lint commands from the profile.
   - **Touched areas:** folders and modules this work changes.
   - **Testing strategy:** the seams where tests go.
   - **Boundaries:** Always / Ask first / Never.
   - **Success criteria:** specific, testable conditions. Change a vague request into a condition that a check can prove.
   - **Not doing:** each item with a reason.
   - **Open questions.**
   - **Workflow:** a checklist with one line for each phase (Define, Spec, Plan, Build, Test, Review, Ship).
4. **Ask the permissions now.** If the profile marks a later step as "ask" (for example, a browser or computer-use check), ask it at this gate. Record the answer in Boundaries.
5. **Gate 1.** Show the spec link and a summary of 5 lines or fewer. Wait for a clear yes. Stop here even when the user ran `/spec` alone.
6. **Keep the spec alive.** If a later phase changes the scope, update the spec first.

## Done when

- The spec card exists with every section above and the user's explicit approval recorded.

Credit: adapted from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT). See [LICENSE](LICENSE).
