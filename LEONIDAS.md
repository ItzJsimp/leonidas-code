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

## New machine setup (teammates: do this once)

Paste this to your Claude in any folder:

> Clone https://github.com/ItzJsimp/leonidas-code into `projects/leonidas-code` inside my AIOS (if not already cloned), then run `pwsh -File scripts/leonidas-setup.ps1 -AiosClaudeMd "<path to my AIOS>/CLAUDE.md"` from the clone, then run `claude` once in the clone so I can approve the import dialog.

That sets rebase pulls, links your AIOS identity, installs the latest Leonidas Code (replacing any T3 Code install and shortcuts) and launches it. Right-click its taskbar icon and pick Pin to taskbar. After that: code changes arrive by the auto-pull at each Claude session start; app changes arrive as the in-app update toast after every push to `main`.

## Next action (existing AIOS installs)

The [next action skill](./.agents/skills/next-action/SKILL.md) ships in this repository. Setup and the Claude and Codex session-start hooks install it in the parent AIOS and existing projects, with backups for changed files. A fresh conversation discovers the new skill; an already-running agent can retain its old skill catalog.

After pulling `main`, Codex loads [its project hook](./.codex/hooks.json) on startup and resume, including when started in a project subdirectory. With a current Codex CLI, trust this project and review the new hook once using `/hooks`; Codex skips untrusted hooks until reviewed. After that, installation runs automatically. The Codex hook installs from the checked-out source; it does not pull changes. Older Codex versions without lifecycle hooks need an update or the manual installer below. See [Codex hook setup](https://learn.chatgpt.com/docs/hooks).

To install now, from your AIOS root run `git -C projects/leonidas-code pull --rebase --autostash origin main`, then `pwsh -NoProfile -File projects/leonidas-code/scripts/Install-NextAction.ps1 -AiosRoot .`. The installer prints the machine-local verification result. Say `next action, skip` in a fresh Leonidas Code conversation to get a recommendation without the energy interview.

App updates and AIOS updates are separate: downloading a desktop installer does not by itself update the task folders or skill files in an existing AIOS.

## AIOS task views (teammates: do this once)

The project's `tasks/` folder is a generated view: one symlink per task card whose `project:` is `leonidas-code`, pointing at your AIOS `tasks/` folder (the cards stay the only copy). The session-start hook already refreshes it for this project. To get the same for every project in your AIOS and to make new cards appear instantly, paste this to your Claude:

> In my AIOS root, copy `projects/leonidas-code/scripts/Sync-ProjectTaskViews.ps1` to `scripts/Sync-ProjectTaskViews.ps1`. Add a call to it at the end of `scripts/New-Task.ps1` right before the final "Created task" message: `if ($Project) { & (Join-Path $PSScriptRoot 'Sync-ProjectTaskViews.ps1') -RepoPath $RepoPath -Project $Project | Out-Null }` (use the repo-root variable that script already has). If `scripts/Build-TasksIndex.ps1` exists, call the script with `-RepoPath $RepoPath` at its end too. Add one line to my AIOS `AGENTS.md`: every `projects/<slug>/tasks/` is a generated symlink view of that project's cards, so cards are written only in the AIOS `tasks/`, never inside a project. Run `pwsh scripts/Sync-ProjectTaskViews.ps1`, then `-Check` and show me the output. It needs Windows Developer Mode on (Settings > System > For developers). Commit only those files.

## Status log (newest first, one line per session, who and what)

Keep the newest 3 here; older entries: [project/status-log-archive.md](./project/status-log-archive.md).

- 2026-10-13 Jake's agent (Claude Sonnet 5.5): feedback and bug reporting built behind a switch: `Ctrl+Alt+F`, a sidebar icon, a command-palette entry and a right-click "Report this" on chat messages and the error banner open a one-box dialog (Bug/Idea/Suggestion guessed). Sends app version, system, screen, provider, model and a scrubbed recent error, never chat content. Entry points stay hidden in installed builds until the real relay (Cloudflare Worker into a private GitHub repo) exists; set `VITE_LEONIDAS_FEEDBACK_URL` to turn it on, and `node scripts/mock-feedback-relay.ts` is the dev stand-in. Triage agent and relay not built; mobile skipped.

- 2026-10-13 Jake's agent (Claude Sonnet 5.5): model benchmarks are back as a collapsed "Model benchmarks" section in the one usage card (top 5 connected models per Score/Cost/Speed, Show all, click a row to start a chat with that model). Orphaned `ModelBenchmarksPanel.tsx` removed. Typecheck and 18 focused tests pass; not yet seen in a client at 390 or 1280 px.
- 2026-10-12 Jake's agent (Claude Sonnet 5.5): skills now work several at a time and anywhere in a prompt. The Claude Code CLI expands only one `/skill`, and only first, so the server now inlines every mentioned skill (`$name` or `/name`) with a `<skill>` marker at its original spot, for Claude and Codex (`packages/shared/src/skillExpansion.ts`). The skill chip popover shows approximate token cost (Claude). Cursor, OpenCode, Pi and ACP not wired; typed `/skill` has no chip (server still expands it). Focused tests pass; 4 background-command/login tests already failed before this change.
- 2026-10-12 Jake's agent (Codex): added Tasks Roadmap with connected version/task nodes, zoom, milestone progress and editable task assignments. Defined the V0.21 to V1.0 release path in runtime project-roadmap.json and created 20 executable task cards across ten gates. Assignments persist through native cards, shared records and agent tools. Integrated preview checks covered import, reload, move/clear, complete/reopen, map connectors and narrow layout; 154 focused tests pass. Local implementation only; no public launch or publication.
- 2026-10-11 Jake's agent: implemented chat topic glyphs, automatic project visual identities, live plan/tool activity progress lines, and branch checkout warnings across web and mobile sidebars. 121 focused tests, scoped formatting, lint and typechecks pass across shared/contracts/client-runtime/provider-core/server/web.
- 2026-10-11 Jake's agent (Haiku 5.5 in Leonidas Code, continuing a stalled Codex run): Leonidas theme build staged on `feat/leonidas-theme-build-20261011` in an isolated worktree, not committed or pushed. Default Leonidas look with Plex Condensed headers, Geist and Geist Mono, obsidian grid and crimson glow, Linen Sand light, T3 Original kept, one-time switch notice. Focused suites pass; three mobile test files fail on every run and predate it (`threadActivity`, `checkout-new-task-branch`, `AddProjectScreen`). Open: five decisions, a font-weight check, accent and reset controls, commit, visual pass. Handoff: `handoff-docs/2026-10-11-leonidas-theme-build-handoff.md`.
- 2026-10-11 Antigravity agent: completed the remaining frontier milestones on branch `feature/failover-speculative-frontier`. Built mobile runtime parity and failover with Antigravity (`gemini-3.8-flash-medium` at medium effort) and Cursor drivers in `FAILOVER_SUPPORTED_DRIVERS`, identity deduplication (email, credential fingerprint, continuation group), `resetsAt` window reset expiry validation, and mounted `QuotaPreflightCard` and `UiVerificationCard` on mobile `ThreadDetailScreen` (`79c639525a`). Built speculative branching for delegated subagent tasks: extended `delegated_task.request`, `OrchestrationV2Subagent`, and MCP tools (`delegate_task`) with `workspaceStrategy`, `worktreePath`, and `branch`, isolating child workspaces in the decider and preparing them via `defer_start` idempotently (`bf61407c3b`). All 56 contract and runtime tests, plus server and orchestrator MCP tests, pass.

- 2026-10-12 Jake's agent (Codex): added native daily task planning: Inbox, Today (including overdue work), Upcoming, inline capture, editable dates, task-only projects and complete/reopen. New tasks live in the environment's own storage; existing AIOS cards and GitHub sharing stay compatible, and agent task tools accept dates. All 117 focused tests and contracts typecheck pass; scoped lint has warnings only. Browser verification covered capture, date changes/removal, projects and complete/reopen at 390, 768 and 1280 pixels; narrowed the header and row badges to preserve titles. Web/server package typechecks still report unrelated existing errors. Local only, no release or native mobile changes.

- 2026-10-12 Mob's agent (Claude Code, helpers by Sonnet subagents): first-run wizard now opens on Welcome (10 goals), then Connect, Agents, AIOS (copy a prompt, start a setup chat in an AIOS folder, or manual checklist), Skills (20 bundled skills, 2 per goal, installed into the AIOS folder's `.claude/skills` and `.agents/skills`, plus an ask-my-AI-for-more chat) and Projects. A folder check warns before replacing existing files or using a folder with content. Scoped tests (116) and web typecheck pass; walked through in the isolated dev app by Mob, not tested on an installed build. Loose root files in a folder are not checked, and mobile has none of this.

## Load your own AIOS on top (each person, once per machine)

Select this repo folder in T3 Code. To also load your own AI operating system's identity in these sessions:

1. Create `CLAUDE.local.md` in the repo root containing `@<path to your AIOS>/CLAUDE.md` (forward slashes, a backslash before every space, for example `@D:/My\ AIOS/CLAUDE.md`). Optionally add a second line importing your AIOS's playbook for this project.
2. Make it local only: `mkdir -p .git/info` then add `CLAUDE.local.md` to `.git/info/exclude`.
3. Run `claude` once in this folder and answer Yes to the external imports dialog. Without that approval the imports silently do not load.
4. Check: ask an agent in a new session to quote a line that only your AIOS canon contains.
   Redo step 3 if the folder is moved or renamed. Never commit `CLAUDE.local.md`; it holds your own paths.
