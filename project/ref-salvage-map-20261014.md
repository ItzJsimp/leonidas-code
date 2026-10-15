# Ref salvage map (2026-10-14)

Card: "Classify unique feature and recovery history". Base: `origin/main`. Nothing was merged, deleted or moved. Branch status source: `.git/leonidas/branch-status.md`, 27 refs marked "behind".

## How each ref was tested

- **Patch-equivalent:** `git cherry origin/main <ref>` marks a commit `-` when main already holds the same patch.
- **Present:** the commit's patch reverses cleanly on main (`git apply -R --check`), so main already has the change.
- **Applies cleanly:** the patch applies to main with no conflict, so main does not have it.
- **Drifted:** the patch conflicts both ways. Main changed the same files.

Dispositions: **Implemented** (main has it), **Actionable** (unique work worth a card), **Archival** (saved state, keep the ref, do not merge).

## Map

| Ref                                              | Owner | Unique commits                                                       | Disposition | Evidence                                                                                                                                           | Overlap owner          |
| ------------------------------------------------ | ----- | -------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `archive/stash-0`                                | Jake  | `5730188800`                                                         | Implemented | patch-equivalent (`-`); stash index commit                                                                                                         | Jake                   |
| `archive/stash-1`                                | Jake  | `bbf897bef2`, `584a96fadf`, `695f167f3e`                             | Implemented | all 3 `-`; usage range presets                                                                                                                     | Jake (usage card)      |
| `archive/stash-2`                                | Jake  | 8 commits, `bbfd420bde` to `0454327868`                              | Implemented | all 8 `-`; Antigravity velocity and OpenRouter router                                                                                              | Jake                   |
| `archive/wt-chat-identities`                     | Jake  | `3d646b9455`                                                         | Archival    | uncommitted state; identity dedupe shipped with failover work                                                                                      | Jake                   |
| `archive/wt-frontier`                            | Jake  | `4c2be757eb`                                                         | Archival    | uncommitted state; `feature/failover-speculative-frontier` is merged                                                                               | Jake                   |
| `archive/wt-main`                                | Jake  | `036dd3214a`, `96410a1de1`                                           | Archival    | `036dd3214a` is the daily task planning that shipped (card "Ship native daily task planning" done); `96410a1de1` is a 86-file uncommitted snapshot | Jake                   |
| `archive/wt-main-other-session`                  | Jake  | `a2efa45e8a`                                                         | Archival    | 53-file uncommitted snapshot; drifted                                                                                                              | Jake                   |
| `archive/wt-merge`                               | Jake  | `f02f2ca425`                                                         | Archival    | 1-file uncommitted snapshot                                                                                                                        | Jake                   |
| `archive/wt-next-action-release-minimal`         | Jake  | `a178bc3907`                                                         | Archival    | `next-action` skill exists in main; patch not compared line by line                                                                                | Jake                   |
| `archive/wt-split-release`                       | Jake  | `7ba270d556`                                                         | Archival    | 18-file uncommitted snapshot; drifted                                                                                                              | Jake                   |
| `archive/wt-walkthrough`                         | Jake  | `14795c222e`                                                         | Archival    | 4-file uncommitted snapshot                                                                                                                        | Jake                   |
| `archive/wt-wt-drain`                            | Jake  | `72007ee3b9`                                                         | Archival    | 2-file uncommitted snapshot                                                                                                                        | Jake                   |
| `feat/agent-output-standard-20261013`            | Jake  | `2f95b9d8a9`, `be61d16339`, `bea8e7d423`, `c72b2dac15`, `0666ba3206` | Actionable  | 0 of 17 new files in main; adds reply-shape compliance, AssistantOutput and canvas helpers; main only has `outputStandard.ts`                      | Jake (output standard) |
| `feat/codex-plan-tier-20261013`                  | Jake  | `3a362ff5ab`                                                         | Actionable  | applies cleanly; unfinished CLIProxy usage limit work                                                                                              | Mob (usage card)       |
| `feat/gui-onboarding`                            | Jake  | `86798ace5e`, `91bb7bc29b`, `8221b5e24a`, `70f9207d73`               | Actionable  | 0 of 8 new files in main; managed Claude install, Connect Claude, AI accounts page; `91bb7bc29b` applies cleanly                                   | Mob (first-run wizard) |
| `feat/leonidas-pet`                              | Jake  | `154503bbca`, `1ef7f2bd77`, `e053a4e609`, `327cf94db0`               | Actionable  | 0 of 10 new files in main; flagged feature; `154503bbca` and `327cf94db0` apply cleanly                                                            | Jake                   |
| `feature/claude-operator-usage-20261012`         | Mob   | `79e7a7e65a`, `ddd497ea16`                                           | Archival    | `79e7a7e65a` is `-` (in main); `ddd497ea16` is a 65-file unfinished snapshot. Local only, not on GitHub                                            | Mob (usage card)       |
| `feature/task-board-shared-history`              | Jake  | `45b38a3099`                                                         | Implemented | drifted; sharing shipped later (`adda7ffb50`); not compared line by line                                                                           | Jake (task board)      |
| `fix/antigravity-connection-lost`                | Jake  | `a5e0db9125`                                                         | Implemented | reverses cleanly; main has `7b5b1bd294`                                                                                                            | Jake                   |
| `fix/background-command-running-chip`            | Jake  | `a056910e2d`                                                         | Implemented | both new files already in main; 2 modified files differ                                                                                            | Jake                   |
| `perf/wp-git-20261012`                           | Jake  | `e7825b3fa8`                                                         | Implemented | one of the four parked perf fixes; card "Recover the four parked performance fixes" done; patch not compared                                       | Mob (perf)             |
| `perf/wp-provider-20261012`                      | Jake  | `9369ddbc06`                                                         | Implemented | same card; patch not compared                                                                                                                      | Mob (perf)             |
| `perf/wp-store-20261012`                         | Jake  | `277be84f28`                                                         | Implemented | patch-equivalent (`-`)                                                                                                                             | Mob (perf)             |
| `perf/wp-web-20261012`                           | Jake  | `7263d1173a`                                                         | Implemented | same card; patch not compared                                                                                                                      | Mob (perf)             |
| `recovery/autostash-20261011`                    | Mob   | `abfbb166c2`                                                         | Archival    | `-` (in main); stash index commit. Local only                                                                                                      | Mob                    |
| `recovery/usage-wip-before-integration-20261011` | Mob   | `9b4acec4cd`, `a7752e5cc6`                                           | Archival    | `a7752e5cc6` is `-`; `9b4acec4cd` holds 8 untracked files (929 lines) of usage WIP. Local only                                                     | Mob (usage card)       |
| `wip/event-log-async-retention`                  | Jake  | `eacc1bb54a`                                                         | Implemented | superseded by `b57c16ae7c` (async provider log retention); card done                                                                               | Jake                   |

Totals: 11 Implemented, 4 Actionable, 12 Archival. "Implemented" rows marked "not compared" rest on card and commit evidence, not a line-by-line patch check.

## Unpushed local work

- Local only (not on GitHub): `feature/claude-operator-usage-20261012`, `recovery/autostash-20261011`, `recovery/usage-wip-before-integration-20261011`.
- Secret scan of their unique diffs for key, token, password and private-key patterns: only code names matched (`TokenField`, `TurnTokenUsage`). No key-shaped values found.
- Tips unchanged: `ddd497ea16`, `a09c7b239b`, `4bd26146f2`.
- No worktree is attached to any of the 27 refs.

## Next steps (for a person to decide)

- Open one card each for the 4 Actionable refs, or park them.
- Keep the 3 local-only refs. Do not delete them until their owner agrees.
