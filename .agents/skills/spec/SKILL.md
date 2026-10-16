---
name: spec
description: "Step 1-2 of Idea to Ship: define the idea, then write a testable spec and get it approved. Use when an idea or feature has no written spec yet, or when asked for /spec."
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
---

# /spec: define and specify

Engines: `grilling` (define), then `to-spec` (write). Added from Addy Osmani's spec-driven-development: assumptions, the spec template and Boundaries.

## Steps

1. **Define.** If the user already gave settled requirements or a grill already ended, skip this step. Otherwise load `grilling` and run it until its synthesis.
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
   - **Workflow:** a checklist with one line for each phase (Spec, Plan, Build, Test, Review, Ship).
4. **Ask the permissions now.** If the profile marks a later step as "ask" (for example, a browser or computer-use check), ask it at this gate. Record the answer in Boundaries.
5. **Gate 1.** Show the spec link and a summary of 5 lines or fewer. Wait for a clear yes. Stop here even when the user ran `/spec` alone.
6. **Keep the spec alive.** If a later phase changes the scope, update the spec first.

## Done when

- The spec card exists with every section above and the user's explicit approval recorded.
