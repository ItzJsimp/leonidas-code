---
name: build
description: "Step 4 of Idea to Ship: implement planned slices test-first, one commit per slice, with stop rules for risky work. Use to build the next slice or the whole plan, or when asked for /build or /build auto."
category: idea-to-ship
scope: structural
distribution: core
portable: true
type: skill
id: skill-build
title: "Build"
kind: procedure
load: on-demand
owner: shared
verified: 2026-10-16
source: "https://github.com/addyosmani/agent-skills (adapted from .claude/commands, MIT, commit aeac41d)"
license: MIT
---

# /build: implement slices

Engine: `implement` (it uses `tdd`). Added from Addy Osmani's `/build auto` and incremental-implementation: loop control, scope discipline and stop rules.

## Modes

- `/build`: build the next pending slice, then stop.
- `/build auto`, or a call from the conductor: build every slice in dependency order, with no stop between slices.

## Steps

1. **Check the baseline.** Run `git status --porcelain`. Do not stage changes that are not part of this work. In a shared checkout, stage explicit paths only (`safe-parallel-commit`). If unrelated changes block the work, ask.
2. **For each slice,** load `implement` and follow its loop: red, green, refactor, performance gate, commit. Follow the `## Execution` section of the spec card: run a parallel group as subagents (one slice each, on the model named there), check each result before you commit it, and run the other slices in order in this chat.
3. **Bug fix:** first write a test that fails because of the bug (Prove-It). Then fix it.
4. **Apply these rules in each slice:**
   - Simplicity first: the smallest change that meets the acceptance criteria.
   - Scope discipline: touch only what the slice needs. Write other findings down; do not fix them.
   - The code compiles and the tests pass after each slice.
   - One commit for each slice, explicit paths only. Never `git add -A`.
5. **Stop and ask (do not continue) when:**
   - a test or the build still fails after 3 attempts with no clear fix (load `diagnosing-bugs`);
   - the spec is ambiguous, or a slice needs a decision that the spec does not cover;
   - a slice is high risk or `git revert` cannot undo it: auth, permissions, data migration or deletion, payments, secrets, deploy or publish.
6. **Resume.** A new run continues from the next pending slice.
7. **Report:** slices done, tests added, commits, and items skipped or flagged.

## Done when

- Every slice in scope has a passing test and its own commit, or the report names the stop rule that fired.

Credit: adapted from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT). See [LICENSE](LICENSE).
