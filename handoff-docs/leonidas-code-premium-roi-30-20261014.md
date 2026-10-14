---
type: handoff
id: handoff-leonidas-code-premium-roi-30-20261014
title: "Leonidas Code: 30 high-ROI premium upgrades"
description: "Ranked upgrades across Coding, Harness and App, each tagged systemic leak or legitimate workload per the token-optimizer two-bucket rule."
scope: personal
owner: leonidas
verified: 2026-10-14
---

# Leonidas Code: 30 high-ROI premium upgrades (2026-10-14)

Source rule: [token-optimizer grill session](../../../logs/grill-sessions/2026-09-11-token-optimizer-and-harness-auditor.md), Round 2 Q2. **Leak** = Bucket 2 (preventable waste: repeated context, process fan-out, polling, waits). **Work** = Bucket 1 (load the user asked for; make it faster or clearer, do not cut it). Base audit: [perf audit 2026-10-12](./leonidas-code-perf-audit-20261012.md).

## Already landed (do not redo)

G2 (Windows git concurrency 2), G3 (checkpoint stages from status paths), G4 (fsync batch + ref fsync), P1 (context7 runs by `node`, not `npx`), P7 partial (provider failure detail, `0f620ca25e`), S9 partial (async log retention, `b57c16ae7c`).

## Ranking

ROI = impact / effort. Effort: S under half a day, M 1 to 2 days, L more. Evidence: [M] measured, [C] read in source this session or in the audit, [H] hypothesis.

### Tier 1: do first (high impact, small effort)

| #   | Area    | Upgrade                                                                                                                                                                                                                                                                                                                  | Bucket | Effort | Evidence |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------ | -------- |
| 1   | Harness | Delete the duplicated `### Decision seams and UI verification` block in [orchestrationInstructions.ts](../packages/provider-core/src/server/orchestrationInstructions.ts) (lines 28 and 38). It ships twice in every turn of every provider. Add a test that fails on duplicate `###` headings in injected instructions. | Leak   | S      | [C]      |
| 2   | Harness | Budget test for all injected text (output standard, orchestration, browser tools, ACP fallback): fail CI if the total grows past a set token count. Stops silent prompt growth.                                                                                                                                          | Leak   | S      | [C]      |
| 3   | Harness | Inject browser-tool and ACP-fallback instructions only when those tools are live for the thread (today they are static text).                                                                                                                                                                                            | Leak   | S      | [C]      |
| 4   | Harness | Lazy MCP start: start mem0 and meetings on first tool call, or share one server per machine (P2). 5 sessions = 5 Python bridges today.                                                                                                                                                                                   | Leak   | M      | [M]      |
| 5   | Harness | Time each phase of Claude query open (spawn, MCP init, skills scan, auth) and store it (P3). The 61 s start is still unattributed.                                                                                                                                                                                       | Leak   | S      | [M]      |
| 6   | App     | Start phase label in the composer ("waiting on checkpoint", "starting tools") instead of a silent spinner (P9). Biggest perceived-speed gain per line of code.                                                                                                                                                           | Work   | S      | [M]      |
| 7   | App     | Split model time from wait time in the t/s counter (P10), so 2.2 t/s stops reading as a slow model.                                                                                                                                                                                                                      | Work   | S      | [C]      |
| 8   | Coding  | Do not block a new turn on the previous checkpoint finalize (G1). 113 s wait measured.                                                                                                                                                                                                                                   | Leak   | M      | [M]      |
| 9   | Coding  | Cache `probeCodexSkillsForCwd` per cwd with a TTL, off the start path (P5). 22.5 s measured.                                                                                                                                                                                                                             | Leak   | S      | [M]      |
| 10  | Coding  | Single-flight plus backoff for `VcsStatusBroadcaster.refreshStatus`; skip threads not on screen (G7). 35 s single call.                                                                                                                                                                                                  | Leak   | M      | [M]      |

### Tier 2: high impact, medium effort

| #   | Area    | Upgrade                                                                                                                                                            | Bucket | Effort | Evidence |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------ | -------- |
| 11  | Harness | Lazy skill announcement: send names only, load descriptions on use (P4). 117 skills announced per session.                                                         | Leak   | M      | [H]      |
| 12  | Harness | In-app context gauge from exact telemetry (Claude JSONL `input + cache_read`, Codex usage), per the grill session fix. No estimates.                               | Work   | M      | [C]      |
| 13  | Harness | Two-bucket efficiency ratio per thread ("82% productive / 18% preventable") in the usage view, with the 4 fixes as buttons (handoff, batch, split file, compress). | Work   | M      | [C]      |
| 14  | Harness | Auto handoff prompt at a measured context threshold (not turn count), with one click to fresh thread.                                                              | Leak   | M      | [C]      |
| 15  | Harness | Agent slot cap per machine with a visible "waiting for a free slot" state (E4). Prevents the 27-node fan-out.                                                      | Leak   | M      | [M]      |
| 16  | Coding  | Thread open pagination: last N items, older on scroll (S3). A 40-item read was 270K chars.                                                                         | Work   | M      | [M]      |
| 17  | Coding  | Spill large tool output to a blob with a preview row (S2). 157 MB table, 1 MB single item.                                                                         | Leak   | M      | [M]      |
| 18  | Coding  | Batch event writes per tick; keep big payloads out of the hot SQLite transaction (S4). 3.2 s transaction under 9 agents.                                           | Work   | M      | [M]      |
| 19  | Coding  | Jittered backoff and a circuit breaker on `runGitCommand` timeouts (G9).                                                                                           | Leak   | S      | [M]      |
| 20  | Coding  | Batch PR sync into one GraphQL query per repo, cache negative answers (G8). 53 calls in 70 min.                                                                    | Leak   | M      | [M]      |

### Tier 3: polish and hygiene (premium feel, low risk)

| #   | Area   | Upgrade                                                                                                                                                                                 | Bucket | Effort | Evidence |
| --- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | -------- |
| 21  | App    | Remove or lazy-route `LegacySidebar.tsx` (3.9K lines). Still imported by `AppSidebarLayout.tsx`, `_chat.tsx`, `useSettings.ts`: put it behind a dynamic import first, then delete (W2). | Leak   | S      | [C]      |
| 22  | App    | Load the 5 device `.glb` models (12 MB in `apps/web/src`) on demand only; confirm none enter the main chunk.                                                                            | Leak   | S      | [C]      |
| 23  | App    | Debounce composer draft writes to `localStorage` (W8).                                                                                                                                  | Leak   | S      | [C]      |
| 24  | App    | `usePermissionStatus` 1.5 s poll and prompt-prediction focus refresh: use visible-interval and stop on success (W3, W4).                                                                | Leak   | S      | [C]      |
| 25  | App    | "Details" expander on every provider error with the full cause chain (finish P7 in the UI).                                                                                             | Work   | S      | [C]      |
| 26  | App    | Split `ChatView.tsx` (12.6K lines) along the slices already started (`cec8b435e9`, `ae89deded4`). Continue, do not rewrite (W1).                                                        | Work   | L      | [C]      |
| 27  | Coding | Adaptive terminal subprocess poll, off when idle (S7); event-driven thread settlement (S8).                                                                                             | Leak   | S      | [M]      |
| 28  | Coding | Drop or sample the 3 noisiest trace spans (S6). Trace file rotated every 6 min.                                                                                                         | Leak   | S      | [M]      |
| 29  | Coding | Startup storage probe: warn "slow drive" and auto-tune git concurrency (X1). Makes it fast on Mob's machine too.                                                                        | Work   | M      | [new]    |
| 30  | Coding | 10-agent soak test with p50/p95 budgets for turn start, checkpoint, thread open, first token (X2). Locks in every gain above.                                                           | Work   | M      | [new]    |

## Not code (Jake, 10 minutes, biggest single win)

- Defender exclusions (E1) and `git gc` plus `git maintenance start` (E7). The HDD (E2) is still the root cause of most [M] waits; decide the SSD move with Mob.

## Inversion

Likeliest failure: work spent on Tier 3 polish while the HDD and start-path waits stay. Guard: do Tier 1 items 1 to 10 first, and measure turn start before and after with the same trace query.
