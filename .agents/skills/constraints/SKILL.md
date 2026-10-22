---
name: constraints
description: "Define and enforce a repo's quality bar once: detect tools, ask up to 4 questions, write CONSTRAINTS.md with real commands. Use when a repo has no enforced quality bar, or when asked for /constraints."
category: idea-to-ship
scope: structural
distribution: core
portable: true
type: skill
id: skill-constraints
title: "Constraints"
kind: procedure
load: on-demand
owner: shared
verified: 2026-10-16
source: "https://github.com/addyosmani/agent-skills (adapted from .claude/commands, MIT, commit aeac41d)"
disable-model-invocation: true
license: MIT
---

# /constraints: the quality bar

Adapted from Addy Osmani's `/constraints` (constraint-driven-development). Run it once for each repo, then again when the bar changes. It does not replace `performance-gate`: it adds the repo's own checks.

## Steps

1. **Detect first.** Read the package files, test runner, lint config, coverage output, CI workflows and agent instructions. Report what you found in 2 lines. Never ask for what you can read.
2. **Ask at most 4 questions**, one at a time, each with your best guess and a usable default:
   - which dimensions beyond the floor (coverage, security, performance, accessibility, architecture);
   - block or warn when a check fails in the middle of a task;
   - target numbers, or measure today's values and hold them;
   - the slowest check that is acceptable before work is handed back.
3. **Write `CONSTRAINTS.md`** at the repo root: a Floor section, enforced numbers, measured-only values with today's numbers, and an exceptions table with owner and expiry date. Every number has a reason.
4. **Give each dimension a tool.** A number without a tool is only a wish. Use the standard tool that the repo already uses, if one exists. Write the exact command next to each rule.
5. **Place each check by cost:** types, lint and secrets in the edit loop (seconds); related tests at the end of a slice; everything else in review or CI. Scope checks to the diff.
6. **Point agents at it.** Add one line to AGENTS.md: read CONSTRAINTS.md and never weaken it to make a change pass. Add the commands to `.agents/workflow-profile.md` under Verify.
7. **Verify.** Run the constraints on the current branch. If the user disagrees with a failure, fix the constraint now.

## Sub-commands

- `/constraints check`: run the constraints on this branch and report.
- `/constraints guard`: search the diff for a weaker bar: lower thresholds, skipped or deleted tests, new suppressions, stubs, new exceptions.

## Done when

- `CONSTRAINTS.md` exists, each rule has a command, and a run on the current branch reported its result.

Credit: adapted from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT). See [LICENSE](LICENSE).
