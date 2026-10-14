# Leonidas Code: how the Leonidas team builds it

Read this first if you are an agent working in this repo. It is the shared brief for both machines. Each builder's private notes live in their own AI operating system and are not visible here, so anything both sides need goes in this file.

## What Leonidas Code is (say it this way every time)

- **T3 Code** is an open-source, MIT-licensed AI coding harness by T3 Tools (`pingdotgg/t3code`). We forked it.
- **Leonidas Code** is our own product built from that fork by the Leonidas team, repo `ItzJsimp/leonidas-code`. It is not T3 Code: it gets its own features and direction, and it ships inside the **Leonidas app** we are building at the same time.
- It replaces the Claude Code and Antigravity front ends for both of us, running on our own AI subscriptions, with extra built-in tools.
- Credit stays: keep the original MIT notice in `LICENSE`. Say "T3 Code" only when talking about upstream (merges, credit, internal ids like `@t3tools/*`, `T3CODE_*`, `~/.t3` that stay for data safety). Everywhere a user sees the app, it is Leonidas Code.

## Output standard (mandatory for every agent reply)

Leonidas Code fixes the shape of every substantive reply across all providers (Claude, Codex, Antigravity, Cursor, Grok, OpenCode) and all users. Personal files add voice, names and banners inside these zones; they never replace them.

### Top Slot: Opening Orientation HUD

- Line 1: `**Active Mode:** Mode XX: [Name]` (e.g. `Mode 00: Build Architect`, or active AIOS mode if loaded).
- Line 2: `🎯 **Focus:** `<project or topic>`· **Milestone:**`<active phase or step>``.
- Line 3: Blank line, followed immediately by findings, diffs, code, or execution steps. Zero conversational filler or pleasantries.

### Structural Body & Scanability Standards

- **Landmark Cards:** Bold lead-ins (`- **<Area>:** <fact or action>`). Narrative paragraphs are at most 2 sentences, solely for causal logic.
- **Delta Micro-Cards (`🔴 Was` -> `🟢 Now`):** High-contrast pairs for fixes, edits, and refactors.
- **Verification Proof Receipts:** State exact proof (`- ✅ **Verified:** <test/check> · <result>`). Never claim a check you did not run.
- **List Ceiling (5-Item Rule):** Cap visible lists to max 5 items per group, ranked by relevance.
- **Dividers & Headings:** Separate themes with `---`. Technical depth goes under `###` headings with one leading semantic emoji (🔍 findings, 🛠️ build, ⚠️ warning, ✅ verification). Tables only for 2+ attributes across 3+ items.

### Terminal Executive Dock (Literal Absolute Screen Bottom)

Every substantive turn MUST terminate at the absolute screen bottom with this exact sequence and headings:

---

### 🎯 TL;DR

- <1-2 punchy bullets: tangible wins, working features, or settled decisions; never a repeat of the Body>

### ⚡ Immediate Next Actions

- [ ] 🤖 **Leonidas:** <specific command or file edit queued next>
- [ ] 👤 **You:** <single step doable in <=2 minutes with exact link, command or phrase> _(unblocks: <milestone>)_

### ❓ Input & Decisions Needed

- **A)** <option and what it triggers> _(Wins when: <condition>)_
- **B)** <option> _(Wins when: <condition>)_
  ➡️ **Recommended: <letter>** · <reason>. **What flips it:** <condition>.
  💬 Quick Replies: "<short phrase>" | "<short phrase>"

### Session Completion Override

When work is finished, verified, committed, and zero queued tasks remain, replace `### ⚡ Immediate Next Actions` with `### 🏁 Session Complete (Ready to Close)`:

- ✅ **Objective Achieved:** <1-line summary>
- 🧼 **Substrate Clean:** Committed (`<hash>`), 0 pending diffs, tests passing.
- 🚀 **Next Best Action:** Close this chat. Open fresh chat for next objective to keep context lean.

### Pushed-to-main banner

After a successful push to `main`, end with the `🏁 SESSION COMPLETE · SHIPPED TO MAIN` block (or `⏳ PUSHED, SESSION CONTINUES` if any ask is still open). Exact wording: `.agents/rules/output-standard.md`. A `PostToolUse` hook (`scripts/Hook-PushCompleteSignal.ps1`, wired in `.claude/settings.json` and `.codex/hooks.json`) reminds the agent.

### Mid-Turn Execution Rules

Quick lookups, one-line answers, or fast mid-execution turns omit full dock: `⚡ Next: <step> | 👤 You: <step> | ❓ Input: None`.

## Task-driven work (mandatory for every agent)

Agents find or create a task before substantive work, keep it updated and close it with a verified note. Full procedure: @.agents/rules/task-driven-work.md. The plan to fold the AIOS Command Center Tasks tab into this page is in [task-system-unification](./docs/internals/task-system-unification.md).

## Tiered models (mandatory when delegating)

Match the model to the work: frontier plans and reviews, mid edits, light scans, Codex researches. Full rule: @.agents/rules/tiered-models.md.

## Roadmap (in order, tick when merged to main)

- [x] Subscription token calibration: shipped in [v0.2.0](https://github.com/ItzJsimp/leonidas-code/releases/tag/v0.2.0); session/weekly estimates pair local Claude/Codex tokens with provider quota percentages. Google AI Pro needs a reliable quota source and token reader before calibration is available.

- [x] Shared repo, based on a teammate's build (branch `mob-base`, now `main`)\n- [x] Push-to-update: every push to `main` builds the Windows installer and publishes a semantic development release (`0.x` until public launch); the desktop app's updater shows the update toast
- [x] Prove the update toast across both machines (sound, OS notification, and confirmation dialog for a teammate to test on next update)
- [x] Token counter: provider-reported output and thinking tokens, current-turn average t/s, and recent-turn averages; missing telemetry is visible rather than hiding the counter
- [x] Synced task board panel in the web UI. Store: GitHub Issues on this repo (decided). Agents add tasks with `gh issue create`; the panel polls and shows the same list on both machines within about 10 seconds
- [x] Prompt predictor: ghost text of the prompt the user is most likely to send next, built from the user's own Leonidas Scribe `history.jsonl` (filtered to agent apps), Tab accepts, nothing is typed until Tab. Port of Jake's Claude Code mod `voice-predict`
- [x] Rebrand to Leonidas Code as a thin layer (name, icons, window title, installer, About). Keep the MIT notice. Internal ids stay (`@t3tools/*`, `T3CODE_*`, `~/.t3`, app id `com.t3tools.t3code`) so data survives and old installs upgrade in place
- [x] Leonidas shell: Command Center views as a tab; Scribe stays a tray app with a localhost API
- [x] Dev instance isolation: agents test on a separate dev app (own profile and ports) and never restart the live app; Settings theme changes apply live, source CSS refreshes in dev and installed assets ship through releases
- [x] Agent activity bar: a live sliver above the composer (current step, step count, elapsed, file chips) that expands to the full plan, next steps, files and reasoning; updates instantly when the plan changes
- [x] Limit failover: when one provider subscription hits its limit, another provider (for example Codex) takes over the same chat in one click, using the existing context handoff

Not in this repo: the Scribe Copy tab and shared clipboard (lives in Leonidas Scribe).

## Version roadmap and who does what (v0.35 to v1.0.0)

The plan lives in [project-roadmap.json](./project-roadmap.json): one milestone per version, each task ending in a `Roadmap key:` line and a `## Lane` section. Jake approved it on 2026-10-13. Windows plus remote web ships first; macOS is the first version after launch. v1.0.0 is the public launch and needs Jake's explicit approval.

- **Mob and his agents (lane "Mob"):** tasks that are already scoped, with a done-when check. Run them on your own account and tokens, in roadmap order. You should not need to ask Jake for details: if a card is unclear, write the gap in the task and take the next one.
- **Mob after a Jake go:** the same, but the task names a "Start when" condition (a purchase, a plan approval or a decision). Do not start until that is recorded in the status log.
- **Jake and his agents (lane "Jake"):** anything that decides what the app looks like or says, plus business, legal and money tasks. Mob does not pick these up; pricing, terms and partner papers are not in this repo.

Before pushing, run the scoped checks in "Run and verify". Add a status-log line for each finished task.

## Working together (two people, one `main`)

1. Claude and Codex sessions run [guarded source sync](scripts/Sync-LeonidasSource.ps1) through their startup hooks. It updates only clean `main` checkouts that can fast-forward; unfinished work, active Git operations and divergent histories are left alone. Run the same helper before other tools. Integrate divergent history deliberately, preserving upstream merge commits. Push small commits often; do not sit on a big branch.
   1a. **Branch status:** the session-start hook runs [`scripts/Write-BranchStatus.ps1`](scripts/Write-BranchStatus.ps1) in the background. It writes `<repo>/.git/leonidas/branch-status.md` (shared by every worktree, never committed): each in-progress branch with its owner, folder, distance from `origin/main` and a plain-English state (uncommitted, behind, stale, new, ready, merged). Before starting work, read it, tell Jake in plain words which branch you are on and whether it is behind `main`, and never delete or switch a branch it marks uncommitted. Run the script yourself if the file is missing or older than your session. It takes about 30 seconds on a large repo because it checks every worktree for unsaved changes.
2. **Every push to `main` ships to both of us.** The release workflow (`.github/workflows/team-release.yml`) builds and publishes, and the other machine gets a toast. Before pushing, run the scoped checks: `vp run typecheck` and `vp test run <files you touched>`. Do not push a broken build.\n3. Docs-only pushes (`*.md`) skip the release build.
3. If the other person's agent is editing the same area, say so in this file's status log first.
4. The repo is **public**. Never commit keys, tokens, `.env` files, personal paths or local launcher scripts (put those in `.git/info/exclude`).
5. Do not edit `team-release.yml` without telling the other person; it is the only workflow that runs (the upstream workflows are disabled in the repo's Actions settings).
6. Keep changes to upstream files small. Prefer new files over edits so `git merge upstream/main` stays cheap. Jake merges upstream periodically (`git fetch upstream`).
7. **Patch notes:** when you write a `Release-Note:` (or `Release-Detail:`) commit trailer, follow the patch-note standard in [.agents/skills/leonidas-release/SKILL.md](.agents/skills/leonidas-release/SKILL.md) (plain words for a non-technical user, verb first, 8 to 18 words, max 5 highlights, no file names or internal terms). Every `feat:` and `fix:` a user can see needs one.

## Run and verify

- Dev: `vp run dev` (all), `vp run dev:desktop` (Electron). Upstream `AGENTS.md` has the project's code rules (performance, no unrequested abstractions); they still apply to code quality. Its product statements describe T3, not us.
- Checks: `vp run typecheck`, `vp lint`, `vp fmt`, `vp test run <files>`.
- Updater logic lives in `apps/desktop/src/updates/DesktopUpdates.ts` and the toast in `apps/web/src/components/desktopUpdate.toast.tsx`. They already work; the repo they poll is whatever `GITHUB_REPOSITORY` was at build time.
- Versions use plain semver. Development is `0.MINOR.PATCH`; `1.0.0` is reserved for explicit public launch. `feat:` (and legacy `Build:`) advances minor; fixes/maintenance advance patch; breaking development changes advance minor. After launch, breaking changes advance major. Use `Release-Note:` commit trailers for clear patch-note bullets. See [release policy](.agents/skills/leonidas-release/SKILL.md).
- Existing `1.0.x` installs need a one-time migration using the latest `0.x` installer; app identity and user data stay intact. `scripts/leonidas-update.ps1 -WaitForExit` verifies the installer and waits for a normal app exit. Later development updates use the normal updater.
- Keep the `claude` CLI installed: T3's Claude provider runs the Claude Agent SDK, which is what loads `CLAUDE.md`, hooks and skills.\n\n## Always-on dev copy (agents: use this to see and test UI)

`scripts/Install-DevShortcut.ps1` (once per machine) registers the "Leonidas Code Dev Server" scheduled task, which keeps the isolated dev server running from sign-in (server port 23773, web port 15733, state in `.t3`), and puts a green-icon "Leonidas Code (Dev)" shortcut on the Desktop to pin; it opens the window via `scripts/Open-LeonidasDev.ps1`. It serves the main checkout's source, so web edits hot-reload there. Agents verify UI by opening `http://localhost:15733` with `preview_open` and following the `test-t3-app` skill; they never restart or touch the installed app. An agent editing in a separate worktree runs its own `vp run dev` there instead. Mob (or anyone) sets it up with `pwsh -File scripts/Install-DevShortcut.ps1` (also run by `leonidas-setup.ps1`), then pins the Desktop shortcut once; the first click installs dependencies. Log: `.t3/dev-server.log`; status: `Get-ScheduledTask 'Leonidas Code Dev Server'`.

## Gotchas already paid for\n\n- A copied AIOS git `pre-commit` hook can point at a script that does not exist in this repo and block commits. Fix: rename `.git/hooks/pre-commit` to `pre-commit.aios-disabled` in this clone (do not use `--no-verify`).

- First installs show a one-time Windows SmartScreen warning (unsigned). Updates still apply.
- Two Claude accounts do not share threads: threads move only between instances with the same `CLAUDE_CONFIG_DIR`.

## Read on demand (not loaded every turn)

- **Status log:** [project/status-log.md](./project/status-log.md). Add one line per finished session at the top; the newest entries are there.
- **Machine setup** (new machine, next-action skill, AIOS task views, loading your own AIOS): [project/leonidas-setup.md](./project/leonidas-setup.md).
