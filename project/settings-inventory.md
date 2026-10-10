---
type: reference
id: t3-code-settings-inventory
title: "Leonidas Code: settings inventory and proposed team values"
description: "Where every Leonidas Code setting is persisted, which can never be shipped (secrets, accounts, machine paths), the seed mechanism to replicate settings to Mob, and Leonidas's proposed values awaiting Jake's approval."
scope: structural
owner: leonidas
verified: 2026-10-10
---
# Leonidas Code settings inventory

Source: read-only sweep of `this repo` on 2026-10-10 (`packages/contracts/src/settings.ts`, `apps/server/src/serverSettings.ts`, `apps/desktop/src/settings/DesktopAppSettings.ts`). Companion: [`settings-walkthrough.md`](./settings-walkthrough.md). Card: [`leonidas-code-settings-parity-for-jake-and-mob`](../../../tasks/leonidas-code-settings-parity-for-jake-and-mob.md).

## Where settings live (`~/.t3/userdata`)
- **S** `settings.json` (server; keys marked PROJ also have per-project overrides keyed by machine-local project id, so never ship those overrides).
- **C** client settings (`client-settings.json` on desktop, localStorage `t3code:client-settings:v1` in a browser).
- **D** `desktop-settings.json` (window, WSL, Tailscale, update channel: machine state).
- **K** `keybindings.json` (seeded from `DEFAULT_KEYBINDINGS` when missing).
- **LS** localStorage (theme keys `t3code:theme*`).
Pages: Project, General, Appearance, Keybindings, SnapShots, Providers, Integrations, Scheduled Tasks, Source Control, Storage, Connections, Archive (Archive and Scheduled Tasks hold data, not settings).

## Never ship
- **Secrets:** GitHub and Bitbucket tokens, usage-limit management keys, provider env values (secret store); `antigravity.apiKey` (plaintext in `settings.json`).
- **Accounts:** `github.hosts[].account`, `bitbucket.email`, `antigravity.gcpProject`, the T3 Connect/Clerk session, DPoP keys in IndexedDB, `onboardingCompletedAt`, Claude and Codex home dirs (`auth.json`, `.claude.json`).
- **Machine:** every D key, `worktreesDirectory`, `addProjectBaseDirectory`, binary and home paths, `deviceHosts`, `browserProfiles`, `mainWindowBounds`, observability URLs.
- **Each person logs in on their own machine:** Claude account(s), GitHub (`gh`), Codex if used. Nothing here can be copied across.

## Seed mechanism (does not exist yet; smallest build)
1. `loadSettingsFromDisk` (`apps/server/src/serverSettings.ts` L772-799) starts from `DEFAULT_SERVER_SETTINGS`. Add an optional repo-shipped `team-defaults.json` that fills only keys missing from the user's file, behind an **allowlist** so secrets and machine keys can never come from it.
2. Client keys: seed `client-settings.json` (path in `apps/desktop/src/app/DesktopEnvironment.ts` L210) only when absent. Precedent: `syncDefaultKeybindingsOnStartup` in `apps/server/src/keybindings.ts`.
3. Trap: a key the user resets to default is absent on disk, so the seed refills it on next start. Acceptable; document it.
4. Keybindings: change `DEFAULT_KEYBINDINGS` in `packages/shared/src/keybindings.ts` instead of a seed.

## Proposed values (NOT approved; Jake reviews, then they become the seed)
| Page | Key | Proposed | Why |
|---|---|---|---|
| General | timestampFormat | 12-hour | Jake's standing rule: no 24-hour time |
| General | continueThreadsAfterServerUpdate | true | Update toasts must not kill running threads |
| General | autoResumeLimitedThreads, snoozeLimitedThreads | true | Two Claude accounts hit limits; resume without babysitting |
| General | notificationMode / inAppNotificationsEnabled | notifications / true | Finished-turn alerts without double sound over the voice daemon |
| General | planModeEnabled, contextWindowMeterEnabled | true | Plan before big work; Jake's 400K context threshold needs the meter |
| General | showSkillsInSlashMenu, composerRichTextEnabled | true | Skills are the main AIOS entry point |
| General | sendShortcut | enter | Keep default; revisit if dictation sends mid-sentence |
| General | followUpBehavior | queue | Default; keep |
| General | confirmThreadDelete | true | Default; keep |
| Appearance | chatWidth | wide | Dense output, tables |
| Appearance | panelAnimationDurationMs | 0 | Default; snappy |
| Providers | claudeAgent enabled; codex, others | claudeAgent on, rest off | Only provider Jake uses; fewer toggles |
| Providers | claudeAgent.autoCompactWindow | 400000 | Jake's context ceiling |
| Source Control | branchNamePrefix | leonidas | Default `t3` is T3 branding |
| Source Control | branchNamingMode | semantic | Readable branches |
| Integrations | enableAgentBrowserAccess | true | Default; keep |
| Integrations | enableAgentDeviceAccess | false | Default; keep |
| Storage | storageCleanup | worktrees 14 days, browser artifacts 14, logs 30 | Stops silent disk growth |
| Connections | loadBalancingEnabled | false | Balances machines, not accounts; no use |
| Connections | updateChannel | latest | Our releases are plain semver |
| Keybindings | defaults | keep; list Jake's wants | Awaiting Jake |
| SnapShots | snapShotEnabled | false | Unclear value; Jake to say |

Unknown and needing Jake: theme choice (LS key), font sizes and families, SnapShots, sidebar sort and grouping, which accounts to sign into.
