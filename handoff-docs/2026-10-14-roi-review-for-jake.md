# ROI list review for Jake (2026-10-14)

From: Mob's session. To: Jake. Source list: [leonidas-code-premium-roi-30-20261014.md](./leonidas-code-premium-roi-30-20261014.md).

## What we need from you

- **The perf audit file.** The ROI list links `handoff-docs/leonidas-code-perf-audit-20261012.md`. It is not in the repo and not on Mob's machine. Please commit it to `handoff-docs/`.
- **Where "270K chars for a 40-item read" came from** (ROI #16, audit finding S3). Was it the app opening a thread, or the agent tool `t3_thread_read`? The app already pages thread opens (bounded snapshot, cursor, "Load earlier turns" button). The agent tool defaults to 50 items and 20,000 characters per item, so 40 items at about 7K each fits the number. This is a reading of the numbers, not a measurement.

## Status of the 30 items (checked against main by reading source and git log)

| Group              | Items                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Done               | 1, 2, 3, 6, 7, 9, 10, 14, 22, 23, 24, 28                                                                        |
| Partial            | 5, 12, 17, 19, 27                                                                                               |
| Not done           | 11, 13, 15, 16, 18, 20, 21, 25, 29, 30                                                                          |
| In progress        | 26 (ChatView split, still 12,633 lines)                                                                         |
| Skipped on purpose | 8 (checkpoint decoupling lets a later turn's edits land in the earlier snapshot, which breaks restore and diff) |
| Outside the repo   | 4 (lazy MCP start lives in the AIOS)                                                                            |

Items 3 and 10 were built in this session (below). Nothing was run for the other items; "done" means the code is on main.

## What was built

- **#3, instructions only when live.** The ACP prompt added the browser block and the ACP fallback block whenever any MCP server was attached. Now each block goes in only when its tools are live. An ACP thread with MCP but no browser or fallback goes from 11,070 to 8,407 characters per injection (-2,663). A plain thread without MCP did not change.
- **#10, shared status refresh.** `VcsStatusBroadcaster.refreshStatus` ran the full invalidate, fetch and status on every call. Callers that arrive during a run now share one trailing run that starts after it ends. Only failures back off (2 s). A first design reused the running result and blocked repeat calls for 10 s after a slow run. That left status stale after a commit or checkout, so it was changed. No latency number was measured on a real repo.

## Known problems found on the way

- `packages/provider-acp` has 21 failing tests on main and on the parent commit. They spawn fake `uv` and `npm` files from Windows paths and fail with ENOENT. Not caused by this work.
- The scoped server typecheck printed 7 `error TS` lines in `src/relativeImportExtensions.test.ts` and `src/taskBoard/aiosDetect*.ts`. Not in the files changed here. Not checked against a clean main.

## Not done

- #16 pagination: not built. Gaps found if the app is the problem: no item cap inside a 10-turn window (`threadHistoryPaging.ts:183`) and no scroll-triggered load (`MessagesTimeline.tsx:1689`).
- Manual, about 10 minutes: Defender exclusions (E1) and `git gc` plus `git maintenance start` (E7). The HDD is still the root cause of most measured waits.
