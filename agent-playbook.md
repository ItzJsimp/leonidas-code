---
type: reference
id: leonidas-code-agent-playbook
title: "Leonidas Code: agent playbook"
description: "Read before changing Leonidas Code (the fork of T3 Code). Where the updater and settings live, upstream traps, the cheap verify loop, gotchas already paid for, and one line per past session."
scope: structural
owner: leonidas
verified: 2026-10-10
---

# Leonidas Code agent playbook

## 1. Start here (under 5 calls)

1. Read [`project/plan.md`](./project/plan.md), [`LEONIDAS.md`](./LEONIDAS.md) (the shared brief Mob's agent also reads; keep its roadmap and status log in step with the task cards) and the open cards listed in [`project.md`](./project.md).
2. Fork state: `git fetch -q upstream; git rev-list --left-right --count upstream/main...main`.
3. Open only the files the task names, using the map below. The source is this folder.

## 2. Module map

| Area                                                   | Files                                                                                                                                                             | Self-test                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Desktop auto-update (poll, download, install, restart) | `apps/desktop/src/updates/DesktopUpdates.ts`, `apps/desktop/src/electron/ElectronUpdater.ts`                                                                      | `DesktopRemoteUpdates.test.ts`           |
| Update toast and sidebar pill                          | `apps/web/src/components/desktopUpdate.toast.tsx`, `sidebar/SidebarUpdatePill.tsx`                                                                                | `desktopUpdate.toast.test.tsx`           |
| What's new popup (shown when an update downloads)      | `apps/web/src/components/desktop/LeonidasWhatsNewDialog.tsx`, wired in `DesktopUpdateCoordinator.tsx`; bullets via `getWhatsNewItems` in `desktopUpdate.logic.ts` | `desktopUpdate.logic.test.ts`            |
| Release feed target                                    | `scripts/build-desktop-artifact.ts` `resolveGitHubPublishConfig`                                                                                                  | `scripts/build-desktop-artifact.test.ts` |
| Settings UI                                            | `apps/web/src/components/settings/`                                                                                                                               | n/a                                      |
| Local mock update server                               | `pnpm start:mock-update-server` (`scripts/mock-update-server.ts`)                                                                                                 | n/a                                      |

## 3. Data sources: shape, cost, traps

| Source         | Reached by                                                                                                   | Latency                                     | Trap                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Update feed    | GitHub Releases of the repo named in `T3CODE_DESKTOP_UPDATE_REPOSITORY` or `GITHUB_REPOSITORY` at build time | 4 minute poll (`AUTO_UPDATE_POLL_INTERVAL`) | Baked in at build: an official T3 install keeps updating from `pingdotgg` until replaced by our build. Private repo needs a token in the app. |
| Update channel | Derived from version string: `-nightly.YYYYMMDD.N` is nightly, else latest                                   | n/a                                         | Updates whose channel does not match the selected one are ignored silently; version our builds as plain semver (`1.0.<run_number>`).          |

## 4. The cheap build and verify loop

1. Updater logic: run the updater tests in `apps/desktop` (fast, no build).
2. Toast flow end to end: `pnpm start:mock-update-server` plus a mock-updates desktop build, before touching CI.
3. Real proof: push to `main`, wait for the release, confirm the toast on the other machine.

## 5. Gotchas already paid for

- **The popup bullets are the GitHub release body:** `team-release.yml` builds `notes.md` from commit subjects since the previous release (drops docs/chore/test/ci/sync/style, strips `feat:` prefixes, oldest first because `releaseNotes.ts` reverses and keeps the last 8). No notes means the old toast shows. Notes cover only the newest release, so skipped versions are not listed. The "Read more" links still point at `pingdotgg/t3code` releases (`DESKTOP_RELEASE_HISTORY_URL` in `desktopUpdate.logic.ts`, asserted in 3 test files).
- **No `vp` on PATH:** run `node_modules/.bin/vp test run <files>` and `node_modules/.bin/tsc --noEmit -p .` from `apps/web`.

- **Identity link needs a manual approval:** `CLAUDE.local.md` in the repo imports the user's AIOS, but external imports stay silently unloaded until `claude` is run once in the folder and the dialog is approved (per path, so redo after a rename). Escape spaces as `\ ` in `@` paths. Standard: [`project-standard.md`](../../standards/project-standard.md) section 9.
- **Do not rebuild the update toast:** it already exists end to end; the only gap is publishing releases from our repo. Found 2026-10-09 by reading source before planning.
- **Keep the `claude` CLI installed:** the Claude provider runs the Claude Agent SDK, which is what loads `CLAUDE.md`, hooks and skills.
- **`New-Task.ps1` YAML escaping:** Windows paths in `-StartFiles` or quotes in `-Verify` broke card frontmatter before `c1eb7bab7`; fixed with `ConvertTo-YamlDq`. Use forward slashes in card paths anyway.
- **Upstream workflows need upstream secrets:** `release.yml` runs on a 30-minute cron and expects macOS signing, Azure signing and Clerk keys; disable it in the shared repo or it fails every half hour.
- **Two Claude accounts do not share threads:** threads only switch between instances with the same `CLAUDE_CONFIG_DIR`, so hitting one account's limit means a new thread on the other; load balancing spreads machines, not accounts. Source: [`project/settings-walkthrough.md`](./project/settings-walkthrough.md).
- **Launch arguments beat the permission picker:** `--permission-mode` or `--dangerously-skip-permissions` in a Claude instance's launch args silently override the UI choice; default permission mode is Full access.
- **Settings seed does not exist:** T3 has no team-defaults mechanism; settings sit in `~/.t3/userdata` (server `settings.json`, client `client-settings.json`, `desktop-settings.json`, `keybindings.json`). Map, never-ship list and seed design: [`project/settings-inventory.md`](./project/settings-inventory.md). The default `branchNamePrefix` is `t3`; change it with the rebrand.
- **Rebrand scope rule:** change user-visible names only; leave `@t3tools/*`, `T3CODE_*` env vars and the `~/.t3` / Electron userData folder names, or existing threads and settings orphan and upstream merges get costly.
- **Keep the app id `com.t3tools.t3code`:** changing it gives a new NSIS GUID, so installs land side by side and old T3 shortcuts survive; the runtime AUMID must match it or taskbar pins duplicate.
- **A push to `main` ships a release to both machines:** the rebrand and any change stay local commits until Jake says push.

- **Claude "no subscription limits" was a 429:** the SDK `get_usage` returns `rate_limits_available: true, rate_limits: null` when Anthropic's usage endpoint is rate limited; that must map to `probeFailed` (retryable), never `unsupported` (sticky, drops streamed `rate_limit_event`s). Antigravity has no reachable quota source: the harness credential gets 403 on `fetchAvailableModels` and `retrieveUserQuota`. Found 2026-10-10.

## 6. Why it is this way

- **Reuse electron-updater over a git-pull updater:** installed apps cannot `git pull`; the existing GitHub Releases path needs only a CI workflow. Card: [`t3-code-push-to-update-release-pipeline`](../../tasks/t3-code-push-to-update-release-pipeline.md).
- **Thin rebrand layer:** every branding touch makes `upstream/main` merges harder. Card: [`t3-code-rebrand`](../../tasks/t3-code-rebrand.md).

## 7. Session notes (newest first, one line each, keep 10)

- **2026-10-10 (What's new popup):** centered dialog on update download lists the release bullets (Restart now / Update when safe / Later); CI now writes release notes from commits. 45 tests and tsc green; not seen in a live window, CI step not yet run, committed locally (`d622e654be`) not pushed. Open: repoint the "Read more" links to our repo.

- **2026-10-10 (usage panel redesign):** composer usage control now has a context ring and hover summary, a top-right panel with separate This chat and Connected accounts sections, a crisp email mask instead of blur, and the Claude Pro null-limits fix; pushed to main. Not verified in a live client. Open: Antigravity quota via the local language server (card `leonidas-code-antigravity-usage-limits-via-local-language-server`), stale `T3` assertions in `MessagesTimeline` tests.
- **2026-10-10 (folder move, ADR-0072):** repo moved from `D:\t3code` to `projects/leonidas-code/` inside the AIOS (own git repo, AIOS-gitignored); project docs now live in the repo (`project.md`, this file, `project/`). The `../../tasks/` and `../../standards/` links resolve only inside an AIOS checkout. Moving a repo re-requires the one-time `claude` import approval and `vp install` (pnpm junctions are absolute).
- **2026-10-10 (Leonidas Code v1.0.2 shipped):** rebrand pushed `ded8ae8d08`, release v1.0.2 installed over T3 0.0.45 in place (app id kept `com.t3tools.t3code` on purpose so NSIS upgrades instead of side-by-side), auto-pull SessionStart hook and `scripts/leonidas-setup.ps1` for Mob. Windows 11 blocks scripted taskbar pins; Jake pins by hand. Open: Mob runs setup, toast proof across machines, optional repo rename.
- **2026-10-10 (Name set, settings mapped):** Jake named it Leonidas Code and approved the predictor build; rebrand running as a Sonnet executor (local commit, no push), settings inventory written with 21 proposed values awaiting approval. Open: land rebrand, predictor port (copy `ThreadTitleRegenerationService.ts` for the one-shot call), settings seed.
- **2026-10-09 (Shared repo live):** Mob's `mob-base` fast-forwarded into `main`, `team-release.yml` builds `v1.0.N` releases, upstream workflows disabled, `LEONIDAS.md` added to the fork as the cross-machine brief. Open: prove the toast on both machines, then task board, prompt predictor (`t3-code-prompt-predictor-from-scribe-transcripts`), rebrand.
- **2026-10-09:** Scaffolded project, 4 task cards, name research (Leonidas Code low risk), settings walkthrough in progress; open: repo home (A/B/C) and task board store (GitHub Issues vs Supabase), Mob's source state.
