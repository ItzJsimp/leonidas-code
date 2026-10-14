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

1. Read [`project/plan.md`](./project/plan.md), [`LEONIDAS.md`](./LEONIDAS.md) (the shared brief every builder's agent reads; keep its roadmap and status log in step with the task cards) and the open cards listed in [`project.md`](./project.md).
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

## 5. Gotchas already paid for

- **The popup bullets are the GitHub release body:** `scripts/leonidas-release.ts` writes `notes.md`: up to 5 highlight `- ` bullets (`Release-Note:` trailers first, then cleaned subjects of commits without one; internal `ci/chore/refactor/test/docs/style/sync` subjects are skipped), an optional `## Details` list (overflow plus `Release-Detail:` trailers) and a last `<!-- leonidas-release {...} -->` metadata line (commit, authors, coAuthors). Wording standard: the leonidas-release skill. `apps/desktop/src/updates/releaseNotes.ts` stops reading at the `## Details` heading, so the popup shows highlights only (fixed in v0.9.0); it still reverses the list and keeps 8, so highlight order in the popup is unchecked live. No notes means the old toast shows. Notes cover only the newest release, so skipped versions are not listed. The "Read more" links point at `ItzJsimp/leonidas-code` releases (`DESKTOP_RELEASE_HISTORY_URL` in `desktopUpdate.logic.ts`, asserted in 3 test files).
- **Test the popup any time:** Settings > About > "What's new popup" > Preview opens it with the latest published release's bullets and no install buttons (`desktop/whatsNewPreview.ts`). Every push to `main` ships to the other machine through the same release feed.
- **No `vp` on PATH:** run `node_modules/.bin/vp test run <files>` and `node_modules/.bin/tsc --noEmit -p .` from `apps/web`.

- **Identity link needs a manual approval:** `CLAUDE.local.md` in the repo imports the user's AIOS, but external imports stay silently unloaded until `claude` is run once in the folder and the dialog is approved (per path, so redo after a rename). Escape spaces as `\ ` in `@` paths. Standard: [`project-standard.md`](../../standards/project-standard.md) section 9.
- **Do not rebuild the update toast:** it already exists end to end; the only gap is publishing releases from our repo. Found 2026-10-09 by reading source before planning.
- **Keep the `claude` CLI installed:** the Claude provider runs the Claude Agent SDK, which is what loads `CLAUDE.md`, hooks and skills.
- **`New-Task.ps1` YAML escaping:** Windows paths in `-StartFiles` or quotes in `-Verify` broke card frontmatter before `c1eb7bab7`; fixed with `ConvertTo-YamlDq`. Use forward slashes in card paths anyway.
- **Upstream workflows need upstream secrets:** `release.yml` runs on a 30-minute cron and expects macOS signing, Azure signing and Clerk keys; disable it in the shared repo or it fails every half hour.
- **Two Claude accounts do not share threads:** threads only switch between instances with the same `CLAUDE_CONFIG_DIR`, so hitting one account's limit means a new thread on the other; load balancing spreads machines, not accounts. Source: [`project/settings-walkthrough.md`](./project/settings-walkthrough.md).
- **Launch arguments beat the permission picker:** `--permission-mode` or `--dangerously-skip-permissions` in a Claude instance's launch args silently override the UI choice; default permission mode is Full access.
- **Settings seed does not exist:** T3 has no team-defaults mechanism; settings sit in `~/.t3/userdata` (server `settings.json`, client `client-settings.json`, `desktop-settings.json`, `keybindings.json`). Map, never-ship list and seed design: [`project/settings-inventory.md`](./project/settings-inventory.md). The default `branchNamePrefix` is `t3`; change it with the rebrand.
- **Keep "T3 Connect" and its Account sheet:** it names upstream's hosted relay and sign-in (`clerk.t3.codes`), so renaming it would claim a service we do not run. Rebrand only the app's own name ("Sent by Leonidas Code", restart messages, widget text). Agent-facing MCP tool text ("inside a T3 thread") and marketing legal pages written for T3 Tools, Inc. are also left alone. Found 2026-10-12 by a tiered-agent branding scan.
- **Rebrand scope rule:** change user-visible names only; leave `@t3tools/*`, `T3CODE_*` env vars and the `~/.t3` / Electron userData folder names, or existing threads and settings orphan and upstream merges get costly.
- **Keep the app id `com.t3tools.t3code`:** changing it gives a new NSIS GUID, so installs land side by side and old T3 shortcuts survive; the runtime AUMID must match it or taskbar pins duplicate.
- **A push to `main` ships a release to both machines:** the rebrand and any change stay local commits until Jake says push.

- **Claude "no subscription limits" was a 429:** the SDK `get_usage` returns `rate_limits_available: true, rate_limits: null` when Anthropic's usage endpoint is rate limited; that must map to `probeFailed` (retryable), never `unsupported` (sticky, drops streamed `rate_limit_event`s). Antigravity has no reachable quota source: the harness credential gets 403 on `fetchAvailableModels` and `retrieveUserQuota`. Found 2026-10-10.
- **Fresh worktrees need an install before any check:** `git worktree add` skips the T3 setup script. Run `pnpm install --frozen-lockfile` first (about 7.5 minutes); tests and typecheck fail until it finishes. Found 2026-10-11.
- **A commit that hangs is usually the hook, not git:** the Vite pre-commit hook runs `vp fmt` on staged files and can stall on a shared temporary index. Commit from a clean worktree and let the hook finish; never bypass it. Found 2026-10-11.
- **`shadcn/no-restyle` rejects `className` on `Button` and `MenuItem`:** use a `size` such as `icon-xs`, or a plain wrapper for layout. Use the `text-3xs` token, not `text-[10px]`. Found 2026-10-11.

- **Windows desktop preflight is not a dry run:** `node scripts/build-desktop-artifact.ts --platform win --target nsis --arch x64` runs the full build unless its prerequisite probe fails first. The probe reads `KitsRoot10` under `HKLM:\SOFTWARE\Microsoft\Windows Kits\Installed Roots`; on this machine it points at `C:\Program Files\Windows Kits\10\` (no `Lib`) while the SDK sits under `Program Files (x86)`. Spectre libraries live at `VC\Tools\MSVC\<ver>\lib\spectre\x64`. Found 2026-10-11.
- **Node-spawned PowerShell drops backslashes:** a `-Command` probe with `\` paths exits 1 with no stderr. `windowsVswherePrerequisiteScript` in `scripts/build-desktop-artifact.ts` uses forward slashes; that fix was uncommitted when written. Debug a probe by printing each step, not by re-running the whole string.
- **Isolated dev desktop and model catalog propagation:** launching `scripts/dev-isolated.ps1 -Mode desktop` does not prove that the caller MCP is connected to that dev instance. Check `orchestrator_capabilities` each time and require the exact model ID before delegation. Earlier checks omitted Apodex; the 2026-10-11 continuation advertised `apodex/apodex-1.1-mini:free` on `openrouter` and one synthetic Read/Write/read-back task passed, independently verified on disk. Never substitute `openrouter/auto`. The installer at `release/Leonidas-Code-0.0.45-x64.exe` (supplied build commit `54340e9754`) was not installed during this check; catalog visibility is not installer acceptance proof.

## 6. Why it is this way

- **Native tasks and release planning:** Leonidas owns new tasks; Todoist supplied public interaction references. Agent execution requires explicit delegation. Existing AIOS cards and GitHub sharing remain compatible. Release scope lives in [`project-roadmap.json`](./project-roadmap.json); V1.0 remains an explicitly approved public launch.
- **Roadmap task identity:** Imported briefs carry a durable `Roadmap key:` in their descriptions. Renaming or moving a task must not reimport it. Use the shared `observeResize` helper for map connectors; raw ResizeObserver callbacks fail scoped lint.

- **Reuse electron-updater over a git-pull updater:** installed apps cannot `git pull`; the existing GitHub Releases path needs only a CI workflow. Card: [`t3-code-push-to-update-release-pipeline`](../../tasks/t3-code-push-to-update-release-pipeline.md).
- **Thin rebrand layer:** every branding touch makes `upstream/main` merges harder. Card: [`t3-code-rebrand`](../../tasks/t3-code-rebrand.md).

## 7. Session notes (newest first, one line each, keep 10, older in the archive)

- **2026-10-12 (Leonidas pet, slices 1 to 3):** petdex-format pet (192x208 cells, 9 state rows, MIT code) is committed locally on `feat/leonidas-pet` in worktree `C:/lcw/pet` (`154503bbca`, `1ef7f2bd77`, `e053a4e609`): atlas core, flagged canvas player with `petEnabled` setting, activity-to-state mapping, walk and bubble. 9 pet tests pass; not seen in a client yet and not pushed. Worktrees on D: stall for 10+ minutes, use `C:/lcw`. Resume from `handoff-docs/2026-10-12-leonidas-pet-slice-4.md`.

- **2026-10-12 (native tasks and connected roadmap):** daily planning and the V0.21 to V1.0 map are committed in `036dd3214a` and `67707f3c95`. The map has ten release gates, twenty executable tasks and editable milestone assignments; 154 focused tests pass. Preview checks cover import, reload, reassignment, clear, complete/reopen, zoom and narrow layouts. Three unrelated web typecheck errors remain; no release was published.

- **2026-10-12 (slowness diagnosis and perf audit):** agents were slow because D: is a 7200rpm HDD (queue 35 to 50) with no Defender exclusion, whole-tree git checkpoints with per-object fsync (66 to 112 s), and per-turn `npx` MCP spawns; nothing in source changed. 56 evidence-tagged changes in `handoff-docs/leonidas-code-perf-audit-20261012.md`; resume from `handoff-docs/2026-10-12-leonidas-code-performance-audit.md`. Open: Defender exclusions (admin), SSD move decision with Mob, real Codex turn-start failure cause (masked in `failure.ts`).

- **2026-10-11 (Apodex smoke check continuation):** ran the isolated desktop launcher (ports 23773/15733, `.t3` home); live capabilities now advertise exact `apodex/apodex-1.1-mini:free` on OpenRouter. One sanitized delegated file-tool task passed in a detached worktree at `54340e9754`: Read/Write/read-back changed the fixture to `status=passed`, independently verified. Recorded task ID and limits in the private AIOS `tests/personal-suite/run-ledger.md`; no fallback, no installer application, no benchmark tasks run. Earlier blocked result is superseded for the smoke gate only.

- **2026-10-11 (desktop build preflight):** installed the Spectre libraries through the VS Installer; the preflight still fails on the stale `KitsRoot10` value, and the probe's slash fix is uncommitted in `scripts/build-desktop-artifact.ts`. Open: approve the registry fix (machine-wide, admin) or a probe fallback to `Program Files (x86)`.

- Older session notes: [project/session-notes-archive.md](./project/session-notes-archive.md).
