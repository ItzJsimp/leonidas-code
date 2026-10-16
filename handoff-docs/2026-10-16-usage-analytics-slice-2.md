---
status: open
---

# Session Handoff: Usage analytics slice 2 and privacy setup

**Date:** 2026-10-16 | **Operator:** Jake | **Status:** Checkpoint (slice 1 committed locally, not pushed)
**Saved to:** `handoff-docs/2026-10-16-usage-analytics-slice-2.md`

## 0. Resume Prompt

```text
Resume from `handoff-docs/2026-10-16-usage-analytics-slice-2.md`. Read it fully, then the files its §2 lists. Verify git state matches §2 and do not redo anything marked done. Present §5, then start step 1 unless it needs my input.
```

## 1. Goal & Focus

Jake wants to see who uses Leonidas Code and how much, without breaking privacy law, so the app can be sold to the public. Slice 1 is done. This session builds **slice 2: the other 24 of 29 usage events**, plus the privacy and release work around them.

Next session focus: setup funnel, AIOS counts, usage events, health events, and the privacy pieces (policy text, consent version, data deletion, release key).

## 2. Changes Landed & Working Tree

- **Canon Updated**: [`CONTEXT.md`](../../../CONTEXT.md) now defines **Install ID** and **Usage event**. Full interview, decisions and the 29-event list: [`logs/grill-sessions/2026-10-16-product-usage-analytics.md`](../../../logs/grill-sessions/2026-10-16-product-usage-analytics.md).
- **Task card**: `task-1abf4c02-80d5-43e7-b91d-c26e1be6cc79` ("Add opt-in product usage analytics"), status `review`. Close it only after slices 2 and 3 pass.
- **Created (commit `24d1511edc`, local, not pushed)**:
  - `apps/web/src/lib/usageAnalytics/usageEvents.ts`: event names, allowlisted fields, `sanitizeUsageProperties`, `buildPostHogPayload`.
  - `apps/web/src/lib/usageAnalytics/usageAnalyticsStore.ts`: persisted store (`leonidas:usage-analytics:v1`) with install ID, consent, friend label, counters.
  - `apps/web/src/lib/usageAnalytics/sendUsageEvent.ts`: the only sender. Sends only when consent is `granted` and `VITE_POSTHOG_KEY` exists.
  - `apps/web/src/lib/usageAnalytics/usageEvents.test.ts`: 9 tests.
  - `apps/web/src/components/usageAnalytics/UsageAnalyticsConsentDialog.tsx` and `UsageAnalyticsCoordinator.tsx` (mounted in `apps/web/src/routes/__root.tsx`).
  - `apps/web/src/components/settings/UsageAnalyticsSettings.tsx` (Settings, General, Privacy; wired in `SettingsPanels.tsx`).
- **Created (commit `6fd4198ae5`, local)**: `.github/workflows/team-release.yml` passes `VITE_POSTHOG_KEY: ${{ vars.POSTHOG_PROJECT_KEY }}`.
- **Local only, git-ignored**: `apps/web/.env.local` holds `VITE_POSTHOG_KEY` (the public `phc_` project key for PostHog EU project 308841). Do not commit it.
- **Restored this session**: 11 core skills (`session-handoff`, `chat-sync`, `chat-closeout`, `recap`, `find-skills`, `ask-leonidas`, `implement`, `to-spec`, `to-tickets`, `wayfinder`) were deleted from `.agents/skills/` in the working tree at about 11:20. I ran `git restore` on them. Cause of the deletion is unknown (see §4).
- **Uncommitted State**: other sessions have uncommitted edits (cache awareness, context meter, settings). Run `git status -s` and commit only your own paths with `git commit --only -- <paths>`.

## 3. Decisions & Constraints

- **Decisions Locked**:
  - PostHog Cloud EU (`https://eu.i.posthog.com/capture/`). Direct `fetch` from the web app, no SDK.
  - Identity is a random install ID. No login or account. Optional "tester name" label for friends.
  - **Full opt-in** for everything. Nothing is sent before the user clicks "Yes, share usage".
  - "Discard client IP data" is **on** in PostHog (Jake confirmed). Every event also sends `$geoip_disable` and `$process_person_profile: false`.
  - Selling: direct download with a merchant of record (Paddle or Lemon Squeezy) for tax. Not decided: which one.
- **Constraints**:
  - Never send prompts, replies, code, file names, paths, card titles, skill names, keys or emails. Only counts, ids from a fixed list, and timings.
  - Every new field must go through `sanitizeUsageProperties`. Free text is not allowed; use enums or numbers.
  - A new data category after consent needs a new consent version and a re-ask (see §5 step 7).
  - Do not push to `main` without Jake's word. A push ships to both machines.
  - ASD-STE100 prose; no em dash; release notes as `Release-Note:` trailers.

## 4. Dead Ends & Ruled Out Approaches

- **Default browser profile in the Browser panel**: returns a blank page with HTTP 431 (too many localhost cookies). Use `profileId: "incognito"`.
- **`vp` not on PATH**: dev-runner fails with `spawn vp ENOENT`. Run with `PATH="$PWD/node_modules/.bin:$PATH"` and `T3CODE_NO_BROWSER=1`. Use `--home-dir C:/lc-analytics-home` so the dev app never touches `~/.t3`.
- **PostHog Activity list lags** several minutes behind ingestion. Check `https://eu.posthog.com/project/308841/data-management/events` instead; it lists event names first.
- **Finding the IP switch by script**: wasted time. Settings are at `/project/308841/settings/project-privacy`.
- **`vitest` import in tests**: typecheck fails. Import from `vite-plus/test`, as other tests do.
- **Install ID timing**: zustand persists only on the first `set`, so the ID and `installedAt` are saved when the user answers the dialog, not at first launch. Setup time therefore starts at the consent click. Fix it in slice 2 by calling a `touch()` in the store at app start, or accept it.
- **Skill disappearance**: `projects/leonidas-code/.agents/skills/session-handoff/` was empty although git tracked `SKILL.md`. The AIOS root `.agents/skills/session-handoff` is a symlink into that folder and `.claude/skills/session-handoff` links to the root one, so both showed nothing. `Sync-DefaultSkills.ps1` (line 71) warns "Core skills missing" at session start. Unknown which process deleted the files at 11:20. If it happens again, check `git status -s .agents/skills` first.

## 5. Next Session Action Plan

1. [ ] Run `git status -s .agents/skills` and confirm the 11 core skills are still present. Run `git log -3 --oneline` and confirm `24d1511edc` and `6fd4198ae5` exist.
2. [ ] **Setup funnel** in `apps/web/src/components/onboarding/WelcomeWizard.tsx` (`step`/`setStep`, `STEP_ORDER`): add `setup_started`, `setup_step_completed` (field `step` from the `WizardStep` enum), `setup_abandoned_at_step` (send from `pagehide` if onboarding is not complete), and `time_to_first_message` (first send after `onboardingCompletedAt`; hook in `ChatView.tsx` `onSend`, line about 9233). Update `NUMERIC_FIELDS` and add an enum allowlist for step ids in `usageEvents.ts`.
3. [ ] **AIOS shape (counts only)**: the web app cannot read disk. Add one small server RPC that reuses `apps/server/src/taskBoard/aiosDetect.ts` and returns `{ aiosDetected: boolean, skillsCount, taskCardsCount, memoryFilesPresent }`. Define it in `packages/contracts/src/rpc.ts`, with auth and instrumentation entries (see `project/agent-gotchas.md`: RPC methods need both). Send `aios_detected`, `skills_count`, `task_cards_count`, `memory_files_present` once per launch. Add `providers_connected` as a list of provider kind names from a fixed enum.
4. [ ] **Usage events**: `threads_created` and `messages_sent` (counts only, from `ChatView.tsx` `onSend` and thread creation), `model_used` (provider and model id from a fixed list; drop unknown ids), `delegated_tasks_started` (server side in `apps/server/src/mcp/`; send to the web via the existing push channel or count in the RPC from step 3), `settings_changed` (key name from the settings schema only), `ui_element_clicked` (one delegated click listener that reads a `data-usage-id` attribute against an allowlist; start with 10 to 15 elements).
5. [ ] **Health events**: `error_shown` (error code or class name only, from `RootRouteErrorView` in `__root.tsx`), `crash` (desktop main process; add a small flag file and report it on next launch), `update_downloaded` and `update_installed` (from `DesktopUpdateCoordinator.tsx` state), `feedback_sent` (from `components/feedback/feedbackRelay.ts`, no message text).
6. [ ] **Tests**: extend `usageEvents.test.ts`. Add one test that fuzzes every event with strings such as `C:/Users/x`, `my prompt` and `sk-123`, and asserts none appears in the payload. Run `node_modules/.bin/vp test run apps/web/src/lib/usageAnalytics` and the scoped typecheck from `apps/web` (`../../node_modules/.bin/vp run typecheck`).
7. [ ] **Consent version**: add `consentVersion` to the store. Bump it when step 2 to 5 events ship, and re-ask users who said Yes for the older version. Update the dialog text to list the new categories (setup steps, counts of skills and task cards, errors).
8. [ ] **Privacy work (slice 3)**: add a "Delete my usage data" action. PostHog can delete by `distinct_id`; for now show the install ID in Settings with a copy button and a support email. Write privacy policy text in plain words (what, why, where: PostHog EU, how long kept, how to turn off, how to delete). Publish it at a public URL for the site and link it from the consent dialog. Add an ADR through `scripts/New-ADR.ps1` for "opt-in analytics, random install ID, PostHog EU".
9. [ ] **Release key**: after Jake says yes, run `gh variable set POSTHOG_PROJECT_KEY -R ItzJsimp/leonidas-code` with the `phc_` key. Never run `gh` without `-R`. Do not push without Jake's word.
10. [ ] **PostHog dashboard**: build one dashboard with these insights: daily and weekly active installs, median session length, setup completion funnel and median time to setup, top features, errors per version. Filter out `delivery_test`, `app_origin_test`, `curl_test2` (test events from this session).
11. [ ] Run [`performance-gate`](../.agents/skills/performance-gate/SKILL.md) with a before and after number (events are small and async; measure idle CPU and bundle size). Update the task card with the verified note and move it to `done`.

## 6. How to Run / Verify

```bash
cd "D:/Leonidas AIOS/projects/leonidas-code"
export PATH="$PWD/node_modules/.bin:$PATH" T3CODE_NO_BROWSER=1
node scripts/dev-runner.ts dev --home-dir "C:/lc-analytics-home"   # note pairingUrl in output
```

- Open the pairing URL with `preview_open` and `profileId: "incognito"`. Click "Yes, share usage". Then read `https://eu.posthog.com/project/308841/data-management/events` in the PostHog tab.
- Stop only the PIDs that own ports 5733 and 13773 after you check their command line. Never kill by pattern.
- Unit tests: `node_modules/.bin/vp test run apps/web/src/lib/usageAnalytics` (9 pass today).
- The PostHog tab may be open in the Browser panel as a user tab; it is unclaimed, so you can drive it.

## 7. Suggested Skills for Next Agent

- `@skills/implement`: test-first slices with atomic commits for steps 2 to 6.
- `@skills/performance-gate`: required before "done".
- `@skills/leonidas-release`: read before committing user-visible changes (`Release-Note:` trailers).
- `@skills/safe-parallel-commit`: other sessions edit this checkout at the same time.
- `@skills/domain-modeling`: add terms such as "consent version" to `CONTEXT.md` when they settle.
