# Handoff: onboarding next steps (dev shortcut, T3 updates policy, AIOS folders script)

Written 2026-10-13 by Jake's agent (Claude Sonnet 5.5). Resume with: "Continue from handoff-docs/2026-10-13-onboarding-next-steps.md".

## Goal

Keep shrinking what a brand-new user has to click in Leonidas Code's first-run setup, and make the dev app easy for Mob to start. This handoff covers two follow-ups Jake picked: (2) the dev shortcut and the T3 updates policy, and (3) an AIOS folders script plus a one-command Claude install and sign-in.

## What is done

- Shipped to `main` as `fa457035c4` (release "Team release" succeeded). First-run order is now Welcome, Agents, Skills, Projects, AIOS. Connect is skipped for one computer, Skills is one "Install N skills and continue" button with `grill-me` and `session-handoff` always included, Projects is skipped when nothing is found, the AIOS setup chat is the last step. Added Back, Skip setup, broader goals, a plain AIOS intro; removed the manual AIOS tab and the "Ask my AI for more ideas" exit. `WelcomeWizard.tsx` shrank (1834 to 1668 lines) by moving the import list into `ImportCandidateList.tsx`.
- New loading screen (ember glow, one funny line, one real tip) and the Leonidas grid off by default shipped earlier in another session's commit (`eca2fd5349`).
- Dev-only new-user simulation with fake accounts, a click and keystroke counter, a note box, and autosaved reports (Downloads folder plus "Past runs"). Open `http://localhost:15733/?sim=onboarding` in the dev window. Code: `apps/web/src/components/onboarding/sim/`. It is excluded from production builds (verified).
- Best measured run: fresh computer about 9 real actions (goal picks aside), 2 keystrokes, down from 15 to 21 clicks.

## What is left, in order

### 1. Dev shortcut and T3 updates policy (Jake's option 2)

- The dev window opens a separate browser window every launch and was hard for Mob to start (meeting, 86 to 114s). Jake wants Mob to have the green "Leonidas Code Dev" shortcut next to Scribe and Code. Look at `scripts/Open-LeonidasDev.ps1`, `scripts/Install-DevShortcut.ps1`, and the "Always-on dev copy" section of `LEONIDAS.md`.
- `scripts/Open-LeonidasDev.ps1` has an uncommitted `-Simulate` switch (opens `?sim=onboarding`). It is mixed with another session's uncommitted edits (auto sign-in from `T3CODE_DEV_AUTH_TOKEN` in `.env`, `CI=true`, `Enable-ScheduledTask`). Review those edits, then commit the file whole or split it.
- T3 updates (meeting, 605 to 645s): an agent reviews upstream T3 updates and manages merge conflicts. Open questions: can an update corrupt Leonidas Code, and should we be able to turn updates off? Write a short policy proposal (pull weekly, review, merge, or pin) before changing anything. Upstream merges are Jake's job per `LEONIDAS.md`.

### 2. AIOS folders script and one-command install (Jake's option 3)

- Folders script: a script a user can run that creates the AIOS structure instantly (`CLAUDE.md`, `AGENTS.md`, `memory/`, `tasks/`, `projects/`, `.claude/skills/`). The structure and text live in `AIOS_PRESET` in `apps/web/src/onboarding/leonidasSetup.logic.ts`. "Run in Leonidas" already builds it through a chat; the script is the no-chat path for people who would otherwise do it by hand.
- One-command Claude install and sign-in: today the Agents step opens two separate terminals (install, then `claude auth login`), costing 2 clicks and 2 Enter presses. Chain them: `irm https://claude.ai/install.ps1 | iex; claude auth login` on Windows. Risk: the new `claude` may not be on PATH in the same terminal session, so sign-in fails. Test on a clean Windows machine or fresh user profile before shipping. Code: `resolveOnboardingProviderInstallCommand` and `resolveOnboardingProviderLoginCommand` in `apps/web/src/onboarding/providerReadiness.logic.ts`; terminal in `AgentInstallTerminal` inside `WelcomeWizard.tsx`; simulator copy in `sim/SimAgentsStep.tsx` (keep the two in step).
- Small extras seen in the last report: the "Open sign-in page" button gets clicked even though the page opens by itself, so consider hiding it for a few seconds; the real flow auto-opens it (`CodexSetupSection.tsx`, `openRequested`).

## Decisions made and why

- AIOS chat is the last step because starting it leaves the wizard; anything after it would be skipped.
- Removed "Ask my AI for more ideas" from Skills for the same reason; the AIOS setup prompt now also asks for 3 to 5 extra skills.
- Installing and continuing is one button because a plain Continue silently installed nothing.
- Pushed only my 19 files on top of `origin/main` (not the whole local branch) so other sessions' unpushed work did not ship.

## Files that matter

- `apps/web/src/components/onboarding/WelcomeWizard.tsx`, `LeonidasSkillsStep.tsx`, `LeonidasAiosStep.tsx`, `LeonidasGoalsStep.tsx`, `ImportCandidateList.tsx`, `FirstRunGate.tsx`
- `apps/web/src/onboarding/leonidasSetup.logic.ts`, `skillPacks.ts` (`CORE_SKILLS`), `providerReadiness.logic.ts`
- `apps/web/src/components/onboarding/sim/*` (simulation, mirrors the real steps; update both when a step changes)
- `scripts/Open-LeonidasDev.ps1` (uncommitted)

## Commands

- Typecheck: from `apps/web`, run `../../node_modules/.bin/tsc --noEmit`. The old playbook path `node_modules/.bin/tsc` inside `apps/web` does not exist here.
- Tests: from `apps/web`, run `node_modules/.bin/vp test run src/components/onboarding/sim src/onboarding`.
- Lint and format: `node_modules/.bin/vp lint <paths>` and `node_modules/.bin/vp fmt <paths>`.
- Open the simulation: `http://localhost:15733/?sim=onboarding`; turn it off with `?sim=off` or the Exit button.

## Traps learned tonight

- Never build a temporary worktree with junctions to the real `node_modules`. `git worktree remove` followed them and emptied `apps/*/node_modules`; recovery was `npx pnpm@11.10.0 install --frozen-lockfile` (about 14 minutes). Copy or unlink first.
- Other sessions share this working tree and have stashed or reset it while uncommitted work existed. Snapshot early: `bash /c/lcw/snap-onboarding.sh` saves the onboarding files to `refs/wip/onboarding-sim` without touching branches.
- This checkout is on another session's branch (`ship-tasks-20261013`), and a local commit `fdc9459165` there duplicates the shipped change. To ship only your own work, build a commit on `origin/main` with a temporary index and push it with `git push origin <commit>:refs/heads/main`.
- The dev server is slow on the D: drive; first load can take 10 to 60 seconds.
- Three `WelcomeWizard*.test.tsx` files fail to load on a missing `publicConfig` mock; I did not confirm whether this predates my changes.

## Open questions

- Should Mob get the dev shortcut automatically from `leonidas-setup.ps1`, or only when asked?
- Pin, pause or keep automatic upstream T3 updates?
- Is the dialog backdrop blur what Jake meant by the "blurry" install terminal?
