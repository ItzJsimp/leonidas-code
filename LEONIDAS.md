# Leonidas Code: how Jake and Mob build it

Read this first if you are an agent working in this repo. It is the shared brief for both machines. Jake's and Mob's private notes live in their own AI operating systems and are not visible here, so anything both sides need goes in this file.

## What Leonidas Code is (say it this way every time)

- **T3 Code** is an open-source, MIT-licensed AI coding harness by T3 Tools (`pingdotgg/t3code`). We forked it.
- **Leonidas Code** is our own product built from that fork by Jake and Mob, repo `ItzJsimp/leonidas-code`. It is not T3 Code: it gets its own features and direction, and it ships inside the **Leonidas app** we are building at the same time.
- It replaces the Claude Code and Antigravity front ends for both of us, running on our own AI subscriptions, with extra built-in tools.
- Credit stays: keep the original MIT notice in `LICENSE`. Say "T3 Code" only when talking about upstream (merges, credit, internal ids like `@t3tools/*`, `T3CODE_*`, `~/.t3` that stay for data safety). Everywhere a user sees the app, it is Leonidas Code.

## Roadmap (in order, tick when merged to main)

- [ ] Subscription token calibration: implementation verified locally, release pending; session/weekly estimates pair local Claude/Codex tokens with provider quota percentages.

- [x] Shared repo, based on Mob's build (branch `mob-base`, now `main`)\n- [x] Push-to-update: every push to `main` builds the Windows installer and publishes a semantic development release (`0.x` until public launch); the desktop app's updater shows the update toast
- [x] Prove the update toast across both machines (sound, OS notification, and confirmation dialog for Mob to test on next update)
- [x] Token counter: provider-reported output and thinking tokens, current-turn average t/s, and recent-turn averages; missing telemetry is visible rather than hiding the counter
- [ ] Synced task board panel in the web UI. Store: GitHub Issues on this repo (decided). Agents add tasks with `gh issue create`; the panel polls and shows the same list on both machines within about 10 seconds
- [x] Prompt predictor: ghost text of the prompt the user is most likely to send next, built from the user's own Leonidas Scribe `history.jsonl` (filtered to agent apps), Tab accepts, nothing is typed until Tab. Port of Jake's Claude Code mod `voice-predict`
- [x] Rebrand to Leonidas Code as a thin layer (name, icons, window title, installer, About). Keep the MIT notice. Internal ids stay (`@t3tools/*`, `T3CODE_*`, `~/.t3`, app id `com.t3tools.t3code`) so data survives and old installs upgrade in place
- [ ] Leonidas shell: Command Center views as a tab; Scribe stays a tray app with a localhost API
- [x] Dev instance isolation: agents test on a separate dev app (own profile and ports) and never restart the live app; Settings theme changes apply live, source CSS refreshes in dev and installed assets ship through releases
- [ ] Agent activity bar: a live sliver above the composer (current step, step count, elapsed, file chips) that expands to the full plan, next steps, files and reasoning; updates instantly when the plan changes
- [ ] Limit failover: when one provider subscription hits its limit, another provider (for example Codex) takes over the same chat in one click, using the existing context handoff

Not in this repo: the Scribe Copy tab and shared clipboard (lives in Leonidas Scribe).

## Working together (two people, one `main`)

1. Every Claude session in this folder auto-runs `git pull --rebase --autostash origin main` (`.claude/settings.json`). Pull by hand before other tools. Push small commits often; do not sit on a big branch.
2. **Every push to `main` ships to both of us.** The release workflow (`.github/workflows/team-release.yml`) builds and publishes, and the other machine gets a toast. Before pushing, run the scoped checks: `vp run typecheck` and `vp test run <files you touched>`. Do not push a broken build.\n3. Docs-only pushes (`*.md`) skip the release build.
3. If the other person's agent is editing the same area, say so in this file's status log first.
4. The repo is **public**. Never commit keys, tokens, `.env` files, personal paths or local launcher scripts (put those in `.git/info/exclude`).
5. Do not edit `team-release.yml` without telling the other person; it is the only workflow that runs (the upstream workflows are disabled in the repo's Actions settings).
6. Keep changes to upstream files small. Prefer new files over edits so `git merge upstream/main` stays cheap. Jake merges upstream periodically (`git fetch upstream`).

## Run and verify

- Dev: `vp run dev` (all), `vp run dev:desktop` (Electron). Upstream `AGENTS.md` has the project's code rules (performance, no unrequested abstractions); they still apply to code quality. Its product statements describe T3, not us.
- Checks: `vp run typecheck`, `vp lint`, `vp fmt`, `vp test run <files>`.
- Updater logic lives in `apps/desktop/src/updates/DesktopUpdates.ts` and the toast in `apps/web/src/components/desktopUpdate.toast.tsx`. They already work; the repo they poll is whatever `GITHUB_REPOSITORY` was at build time.
- Versions use plain semver. Development is `0.MINOR.PATCH`; `1.0.0` is reserved for explicit public launch. `feat:` (and legacy `Build:`) advances minor; fixes/maintenance advance patch; breaking development changes advance minor. After launch, breaking changes advance major. Use `Release-Note:` commit trailers for clear patch-note bullets. See [release policy](.agents/skills/leonidas-release/SKILL.md).
- Existing `1.0.x` installs need the one-time `0.2.0` installer migration; app identity and user data stay intact. Later development updates use the normal updater.
- Keep the `claude` CLI installed: T3's Claude provider runs the Claude Agent SDK, which is what loads `CLAUDE.md`, hooks and skills.\n\n## Gotchas already paid for\n\n- A copied AIOS git `pre-commit` hook can point at a script that does not exist in this repo and block commits. Fix: rename `.git/hooks/pre-commit` to `pre-commit.aios-disabled` in this clone (do not use `--no-verify`).
- First installs show a one-time Windows SmartScreen warning (unsigned). Updates still apply.
- Two Claude accounts do not share threads: threads move only between instances with the same `CLAUDE_CONFIG_DIR`.

## New machine setup (Mob: do this once)

Paste this to your Claude in any folder:

> Clone https://github.com/ItzJsimp/leonidas-code into `projects/leonidas-code` inside my AIOS (if not already cloned), then run `pwsh -File scripts/leonidas-setup.ps1 -AiosClaudeMd "<path to my AIOS>/CLAUDE.md"` from the clone, then run `claude` once in the clone so I can approve the import dialog.

That sets rebase pulls, links your AIOS identity, installs the latest Leonidas Code (replacing any T3 Code install and shortcuts) and launches it. Right-click its taskbar icon and pick Pin to taskbar. After that: code changes arrive by the auto-pull at each Claude session start; app changes arrive as the in-app update toast after every push to `main`.

## Status log (newest first, one line per session, who and what)

- 2026-10-10 Jake's agent: implemented persisted subscription calibration from exact Claude/Codex transcript intervals and provider quota deltas, with session/weekly estimates in composer and web/mobile usage details. Reset/account/plan/home isolation, coverage guards and delayed quota reports are tested; 86 focused checks pass, server/web/mobile typechecks pass. ProviderRegistry has 18 unchanged baseline failures on Windows. Local implementation, release and installed-client verification pending. User guide: [`subscription-usage.md`](./docs/user/subscription-usage.md).

- 2026-10-10 Jake's agent: published 0.2.0 with live Codex token reporting, a visible token counter, paginated update history, optional installation after agents finish, and faster releases (filtered dependencies, Rust executable cache, superseded builds, one-minute detection). Focused tests, scoped typechecks, isolated desktop build and published installer checksum pass. Cold-cache release: 7m45s; dependency install 40s versus 72s before, dependency cache 609MB versus 1.15GB. Browser verification is blocked by preview automation timeouts and unavailable fallback browsers; warm-cache timing is not yet measured. Jake approved the one-time 0.2.0 installer migration; 1.0.0 is reserved for public launch. Code and Scribe publishers classify patch/minor changes and generate notes automatically.
- 2026-10-10 Mob's agent: added local AI Desktop for existing Windows VirtualBox guests: human VM grants, exclusive thread ownership, pause/release, guest-only MCP input and PNG screenshots, and a nonmodal web/desktop viewer. Verified 36 focused tests, affected package typechecks, scoped lint, real guest click/type with unchanged host cursor, and isolated client selection/screenshot/pause/reopen/resume/release. Native mobile viewer and automatic VM provisioning are not included.
- 2026-10-10 Jake's agent: Settings > About now has a "What's new popup" Preview button (shows the latest release's bullets), so either of us can test patch notes without waiting for an update.
- 2026-10-10 Jake's agent: "What's new" popup: when an update downloads, a centered dialog lists what shipped (bullets from the GitHub release body, which `team-release.yml` now generates from commit subjects since the last release); falls back to the old toast when there are no notes. Restart now / Update when safe / Later. Local commit, not pushed.
- 2026-10-10 Jake's agent: implemented Mob notification test (sound + unmissable persistent toast + confirmation dialog) on next update, and live agent velocity & token-throughput tracker (instantaneous TPS, rolling 5/10/20 step windows, tool cadence, sparkline). Verified with 35 tests passing and typecheck clean. Pushed to main for release.
- 2026-10-10 Jake's agent: usage control redesign (context ring, hover summary, top-right panel, email mask) and Claude limits fix (null usage read is retryable, not "no limits"). Antigravity quota has no reachable source yet. Pushed to main as the next `v1.0.N`.
- 2026-10-10 Mob's agent: verified installed and dev desktop windows coexist with separate profiles, checkout-local server state and ports. Source CSS hot refresh and removal worked in Electron without restarting; closing dev left the installed app running. Accepted live-edit scope: Settings themes, with source CSS confined to dev. Isolation fix and acceptance records remain local; no push authorized.
- 2026-10-10 Mob's agent: implemented local-history prompt prediction with bounded cached reads, Tab acceptance, Escape dismissal, Undo and a settings switch. Scoped checks pass; published to main, live client verification pending.
- 2026-10-10 Jake's agent: repo moved into the AIOS at `projects/leonidas-code/` (own git repo, AIOS-gitignored) with the project workspace layer: `CLAUDE.md`, `project.md`, `agent-playbook.md`, `project/` docs. Same path on every machine; clone there. Re-run `pnpm install` and re-approve the `claude` import dialog after any move.
- 2026-10-10 Jake's agent: rebranded to Leonidas Code (name, icons, sidebar, installer, branch prefix `leonidas`), added auto-pull hook and `scripts/leonidas-setup.ps1`. Ships as `v1.0.2`.
- 2026-10-09 Jake's agent: merged Mob's `mob-base` into `main`, added the release workflow, wrote this file. `v1.0.1` is published.

## Load your own AIOS on top (each person, once per machine)

Select this repo folder in T3 Code. To also load your own AI operating system's identity in these sessions:

1. Create `CLAUDE.local.md` in the repo root containing `@<path to your AIOS>/CLAUDE.md` (forward slashes, a backslash before every space, for example `@D:/Mob\ AIOS/CLAUDE.md`). Optionally add a second line importing your AIOS's playbook for this project.
2. Make it local only: `mkdir -p .git/info` then add `CLAUDE.local.md` to `.git/info/exclude`.
3. Run `claude` once in this folder and answer Yes to the external imports dialog. Without that approval the imports silently do not load.
4. Check: ask an agent in a new session to quote a line that only your AIOS canon contains.
   Redo step 3 if the folder is moved or renamed. Never commit `CLAUDE.local.md`; it holds your own paths.
