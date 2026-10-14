---
type: reference
id: leonidas-code-agent-playbook
title: "Leonidas Code: agent playbook"
description: "Read before changing Leonidas Code (the fork of T3 Code). Where the updater and settings live, upstream traps, the cheap verify loop, gotchas already paid for, and one line per past session."
scope: structural
owner: leonidas
verified: 2026-10-11
---

# Leonidas Code agent playbook

## 1. Start here (under 5 calls)

1. Read [`project/plan.md`](./project/plan.md), [`LEONIDAS.md`](./LEONIDAS.md) (the shared brief; keep [project/roadmap.md](./project/roadmap.md) and the status log in step with the task cards) and the open cards listed in [`project.md`](./project.md).
2. Fork state: `git fetch -q upstream; git rev-list --left-right --count upstream/main...main`.
3. Open only the files the task names, using the map below. The source is this folder.

## 2. Module map

| Area | Files | Self-test |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |\
| Desktop auto-update (poll, download, install, restart) | `apps/desktop/src/updates/DesktopUpdates.ts`, `apps/desktop/src/electron/ElectronUpdater.ts` | `DesktopRemoteUpdates.test.ts` |\
| Update toast and sidebar pill | `apps/web/src/components/desktopUpdate.toast.tsx`, `sidebar/SidebarUpdatePill.tsx` | `desktopUpdate.toast.test.tsx` |\
| What's new popup (shown when an update downloads) | `apps/web/src/components/desktop/LeonidasWhatsNewDialog.tsx`, wired in `DesktopUpdateCoordinator.tsx`; bullets via `getWhatsNewItems` in `desktopUpdate.logic.ts` | `desktopUpdate.logic.test.ts` |\
| Release feed target | `scripts/build-desktop-artifact.ts` `resolveGitHubPublishConfig` | `scripts/build-desktop-artifact.test.ts` |\
| Settings UI | `apps/web/src/components/settings/` | n/a |\
| Local mock update server | `pnpm start:mock-update-server` (`scripts/mock-update-server.ts`) | n/a |\

## 3. Data sources: shape, cost, traps

| Source         | Reached by                                                                                                   | Latency                                     | Trap                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Update feed    | GitHub Releases of the repo named in `T3CODE_DESKTOP_UPDATE_REPOSITORY` or `GITHUB_REPOSITORY` at build time | 4 minute poll (`AUTO_UPDATE_POLL_INTERVAL`) | Baked in at build: an official T3 install keeps updating from `pingdotgg` until replaced by our build. Private repo needs a token in the app. |
| Update channel | Derived from version string: `-nightly.YYYYMMDD.N` is nightly, else latest                                   | n/a                                         | Updates whose channel does not match the selected one are ignored silently; version our builds as plain semver (`1.0.<run_number>`).          |

## 4. The cheap build and verify loop

1. Updater logic: run the updater tests in `apps/desktop` (fast, no build).
2. Toast flow end to end: `pnpm start:mock-update-server` plus a mock-updates desktop build, before touching CI.
3. Real proof: push to `main`, wait for the release, confirm the toast on the other machine.
4. First-run starter skills: `node scripts/verify-starter-skills.ts --live` installs all of them into a fresh temp folder and checks both roots plus Claude Code and Codex loading (about 8 s, one haiku call). `--list <folder>` audits any AIOS folder.
5. Which skills Codex sees in a folder, free and with no model call: `codex debug prompt-input` run there (skills are listed as `(file: rN/<name>/SKILL.md)`).
6. Web typecheck: from `apps/web`, `../../node_modules/.bin/vp run typecheck` (about 13 s). `npx tsgo` and a local `tsc` bin do not exist.

## 5. Gotchas (the ones that bite first)

Full list and session notes: [project/agent-gotchas.md](./project/agent-gotchas.md). Search it before touching updater, release, rebrand, worktree, build-preflight or quota code.

- **A push to `main` ships a release to both machines:** changes stay local commits until Jake says push.
- **Rebrand scope rule:** change user-visible names only; leave `@t3tools/*`, `T3CODE_*`, the `~/.t3` folder and app id `com.t3tools.t3code`, or threads orphan and installs duplicate.
- **No `vp` on PATH:** run `node_modules/.bin/vp test run <files>` from the repo.
- **The main checkout is shared with live agents:** another session may be committing here every few seconds. Never `git switch`/`git checkout -b` (its commits land on your branch) and never `git stash` (an old `stash@{0}` exists and `pop` applies it). Commit by explicit path with `git commit --only -- <paths>`; for a baseline, compare error lists instead of stashing.
- **A dev server for this checkout may already be running:** `vp run dev` then refuses. Start yours with `--home-dir <temp folder>` (own ports and data) and stop only the PID you captured (`/proc/<pid>/winpid`, then `taskkill //T`).
- **Fresh worktrees need an install first:** `pnpm install --frozen-lockfile` (about 7.5 minutes) before any check. Worktrees on D: stall; use `C:/lcw`.
- **A commit that hangs is usually the hook:** let `vp fmt` finish; never bypass it.
- **MCP service test fixtures are partial records:** `OrchestratorMcpService.test.ts` casts runs without `startedAt`/`completedAt`. New code that reads run or turn fields must guard with `== null`, or 7 unrelated tests fail.
- **Server typecheck has existing errors** in unrelated test files (`aiosDetect.test.ts`, `relativeImportExtensions.test.ts`). Filter the output to your changed paths instead of reading the total.

## 6. Why it is this way

- **Native tasks and release planning:** Leonidas owns new tasks; Todoist supplied public interaction references. Agent execution requires explicit delegation. Existing AIOS cards and GitHub sharing remain compatible. Release scope lives in [`project-roadmap.json`](./project-roadmap.json); V1.0 remains an explicitly approved public launch.
- **Roadmap task identity:** Imported briefs carry a durable `Roadmap key:` in their descriptions. Renaming or moving a task must not reimport it. Use the shared `observeResize` helper for map connectors; raw ResizeObserver callbacks fail scoped lint.

- **Reuse electron-updater over a git-pull updater:** installed apps cannot `git pull`; the existing GitHub Releases path needs only a CI workflow. Card: [`t3-code-push-to-update-release-pipeline`](../../tasks/t3-code-push-to-update-release-pipeline.md).
- **Thin rebrand layer:** every branding touch makes `upstream/main` merges harder. Card: [`t3-code-rebrand`](../../tasks/t3-code-rebrand.md).

## 7. Session notes

In [project/agent-gotchas.md](./project/agent-gotchas.md); older ones in [project/session-notes-archive.md](./project/session-notes-archive.md).

- 2026-10-14: skill folders in the `/` menu (`packages/client-runtime/src/skillFolders.ts`, `apps/web/src/components/chat/composerSkillFolders.logic.ts`, `settings/SkillFoldersEditor.tsx`), commits `e518535038` and `b0e9835b08`; checked live in Claude, 97 flat rows became 9 folders. Open: AIOS mirror file, category and source for Codex skills.
- 2026-10-14: delegated task status returns a provider-reported `usage` block (`apps/server/src/mcp/delegatedTaskUsage.ts`, commit `c0efa878cf`); harness-gates card 1 of 4. Cards 2 to 4 build on it.
- 2026-10-14: AIOS Home on the Command tab (`taskBoard.home`, `aiosHome.ts`, `AiosHomeCard.tsx`), verified live on 583 cards; Home build 1 ms, shared card scan 92 ms warm is the next cost to cut.
- 2026-10-14: starter skills verified 22/22 in both roots for Claude Code and Codex; `SKILL_ROOTS` now lives in `skillPacks.ts` so the wizard and the verifier share it.
