# Workflow profile

The Idea to Ship commands read this file first. Keep it short: one line for each fact.

## Tracker

- Specs and slices: <where cards go, and the command that creates one>
- Claim rule: <how a slice is marked as taken, so no other agent starts it>

## Verify

- Tests: <scoped test command>
- Lint: <scoped lint command>
- Typecheck: <command>
- Build: <command, or "CI only">
- UI check: <skill or steps> (ask | allowed | none)

## Ship

1. <step, for example: commit on a branch and open a PR with the pr skill>
2. <step, for example: release notes>

## Never

- <repo rule that the workflow must not break>
