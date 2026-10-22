---
name: test
description: "Step 5 of Idea to Ship: verify the built work against every success criterion with real checks and the performance gate. Use after a build, before review, or when asked for /test."
category: idea-to-ship
scope: structural
distribution: core
portable: true
type: skill
id: skill-test
title: "Test"
kind: procedure
load: on-demand
owner: shared
verified: 2026-10-16
source: "https://github.com/addyosmani/agent-skills (adapted from .claude/commands, MIT, commit aeac41d)"
license: MIT
---

# /test: verify with evidence

Engines: `performance-gate`, plus the verify skills named in `.agents/workflow-profile.md`. Rule from Addy Osmani: tests are proof.

## Steps

1. **Read the profile `Verify` section.**
2. **Run the scoped checks** from the profile: tests for the changed files, lint, typecheck, build. For each check, show the command and its result. Never claim a check that you did not run.
3. **Map each success criterion** in the spec to its evidence: a test name, a command result, or a screenshot. A criterion with no evidence is a FAIL.
4. **UI or game change:** run the UI check from the profile (for example `design-audit`, a browser pass, or a Studio playtest) when the spec Boundaries allow it.
5. **Load `performance-gate`.** It must give a verdict.
6. **Result.** PASS: go to `/review`. FAIL: write each failure as Location, Cause, Fix, and go back to `/build`.

## Done when

- Every success criterion has evidence, every profile check ran with its result shown, and `performance-gate` gave a verdict.

Credit: adapted from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT). See [LICENSE](LICENSE).
