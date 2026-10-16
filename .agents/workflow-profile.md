# Workflow profile: Leonidas Code

The Idea to Ship commands read this file first. Rules come from [AGENTS.md](../AGENTS.md) and [engineering](rules/engineering.md).

## Tracker

- Specs and slices: AIOS task cards with `project: leonidas-code` (`pwsh scripts/New-Task.ps1` from the AIOS root). Without the AIOS: a GitHub issue.

## Verify

- Tests: `node_modules/.bin/vp test run <changed test files>`
- Lint: `node_modules/.bin/vp lint <changed files>`
- Typecheck (web): from `apps/web`, `../../node_modules/.bin/vp run typecheck` (about 13 s). Server typecheck has old errors: filter to changed paths.
- Build: CI owns the full build and suite. Never run `vp check`, `vp run -r test` or `vp run -r typecheck` unless asked.
- Server boot: `node scripts/smoke.mjs` when server startup code changed.
- Skills seen by Codex (free): `codex debug prompt-input` in the folder.
- UI check: `test-t3-app` (web) or `test-t3-mobile` (mobile), primary agent only (ask).

## Ship

1. Commit on the current branch with explicit paths. A PR only when the user asked for one at Gate 2: plain conventional title, body from the `pr` skill (problem, fix, model and harness, before/after images for UI).
2. User-visible change: patch notes and version with `leonidas-release`.
3. Release: push to `main` only after Gate 2, then confirm the release is published.

## Never

- Edit `.repos/` (vendored, read only).
- Commit motion videos (upload them to GitHub).
