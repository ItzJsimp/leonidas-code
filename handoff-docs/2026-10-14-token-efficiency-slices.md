# Session Handoff: Leonidas token-efficiency programme (25 ideas; ideas 2, 3, 5 and 10 shipped to v0.59.3)

**Date:** 2026-10-14 | **Operator:** Jake | **Status:** Checkpoint (5 of about 25 slices done, nothing pushed)
**Saved to:** `handoff-docs/2026-10-14-token-efficiency-slices.md`

## 0. Resume Prompt

```text
Resume from `handoff-docs/2026-10-14-token-efficiency-slices.md`. Read it fully, then the files its §2 lists. Verify git state matches §2 and do not redo anything marked done. Present §5, then start step 1 unless it needs my input.
```

## 0. Open live checks (carried from 2026-10-14, shipped in v0.59.3)

Tested and typechecked, but not yet seen in the live app. Look when a chat shows the case:

1. [x] (seen live 2026-10-14: `MCP t3-code ~3.9k` against 6.9k MCP tools) **Trim MCP rows** (usage card): each server should show its share of the provider's loaded "MCP tools" total with `~` (about 3.3k for `t3-code`, 1.9k for `claude_ai_Gmail` in the screenshot chat), not the full schema size. Needs a chat where the breakdown has a provider split (source `provider` or `mixed`).
2. **Waste list** (usage card): shows after a file is read 3 or more times, a tool result of 20,000 or more tokens, or the same call failing 3 or more times.
3. **Cache-break warning** (token popover): shows when hits fall 40 points or more from a prior turn above 50%, on 5,000 or more input tokens.

Seen live already: setup and chat rows (39,633 + 134,772 = 174k context), and the "(not used in this chat)" tag. Idea 5 is partial (no unused-subagent output); idea 10 is per-thread only (the 14-day rule needs a server usage ledger shared with idea 17); idea 12 was checked and not built.

## 1. Goal & Focus

Make Leonidas Code and the Leonidas AIOS efficient by default: new users should not need to tune their agent, and Jake wants to see where every token goes. Claude out of the box lacks token-efficient defaults; Leonidas should ship them.

Jake reviewed all 25 ideas in a grill session and approved every one. He then asked for them to be implemented in chat, one slice at a time, each slice chosen by him. The grill capture is `D:/Leonidas AIOS/logs/grill-sessions/2026-10-13-leonidas-token-efficiency-ideas.md`. It holds only the idea numbers, so the definitions are in the table below.

### The 25 approved ideas (status)

| #   | Idea                                                                                                                                          | Status                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Per-turn token ledger (system, instructions, skills, MCP schemas, tool results, thinking, output)                                             | Core done (`turnLedger`), shown for input and cache only. Per-category split not built.                                                                                                                                                              |
| 2   | Context X-ray panel: what is loaded before the first message, with a Trim button                                                              | Audit script done. Not in the server or UI.                                                                                                                                                                                                          |
| 3   | Cache hit-rate meter, with a warning when a changing prompt prefix breaks caching                                                             | Hit rate shown in the popover. No warning yet.                                                                                                                                                                                                       |
| 4   | Cost attribution by skill, plugin, MCP server, subagent; top spenders                                                                         | Not started. Needs new data from adapters.                                                                                                                                                                                                           |
| 5   | Waste detector: repeated file reads, 20k+ tool results, retry loops, unused subagent output                                                   | Not started.                                                                                                                                                                                                                                         |
| 6   | Efficient Defaults profile: Economy, Balanced, Max switch (model, effort, thinking budget, auto-compact near 70%, output caps), on by default | Not started.                                                                                                                                                                                                                                         |
| 7   | Automatic model routing: small model for searches and renames, mid for edits, frontier for plan and review, with a "why this model" chip      | Not started. `packages/shared/src/autoRouter.ts` exists; read it first.                                                                                                                                                                              |
| 8   | Lean prompt-file linter: duplicates, stale text, budget overruns, one-click compact                                                           | Linter report done in `scripts/context-audit.ts`. No rewrite action, no UI.                                                                                                                                                                          |
| 9   | Lazy-load imports: keep the always-loaded core small, move playbooks and logs to on-demand files                                              | Done for the repo (`LEONIDAS.md`, `agent-playbook.md`). AIOS-side files not done.                                                                                                                                                                    |
| 10  | Tool and MCP diet: lazy MCP schemas, suggest disabling servers unused for 14 days                                                             | Not started.                                                                                                                                                                                                                                         |
| 11  | Built-in efficient-agent rule pack (under 400 tokens, every provider): grep first, line ranges, batch calls, no re-reads                      | Not started.                                                                                                                                                                                                                                         |
| 12  | Tool output compression: head and tail plus a log pointer, full text expandable in the UI                                                     | Not built, by design. Providers run their own tools, so only our MCP tools could be shortened, and the big ones already page (`t3_thread_read` caps items at 20,000 chars with offsets). Open: measure real tool result sizes before adding any cap. |
| 13  | Smart compaction and handoff with a structured summary (goal, decisions, open files, next step), reused for failover                          | Not started.                                                                                                                                                                                                                                         |
| 14  | Subagent budgets: token and time caps, short return format, live cost per child                                                               | Not started.                                                                                                                                                                                                                                         |
| 15  | Plan-before-act gate for tasks touching 5 or more files                                                                                       | Not started. Most likely to be made opt-in.                                                                                                                                                                                                          |
| 16  | Capability inventory page: everything loaded this thread, with source and token cost                                                          | Not started.                                                                                                                                                                                                                                         |
| 17  | Skill and plugin usage log, with pruning and overlap detection                                                                                | Not started.                                                                                                                                                                                                                                         |
| 18  | Final prompt preview: the exact system prompt and tool list sent                                                                              | Not started.                                                                                                                                                                                                                                         |
| 19  | Decision trace in plain English, one line per turn                                                                                            | Not started.                                                                                                                                                                                                                                         |
| 20  | First-run Efficiency Check wizard step with a score                                                                                           | Not started. First-run wizard lives in `apps/web/src/onboarding/`.                                                                                                                                                                                   |
| 21  | Starter ignore files and a short repo map per new project                                                                                     | Not started.                                                                                                                                                                                                                                         |
| 22  | Weekly savings report                                                                                                                         | Not started.                                                                                                                                                                                                                                         |
| 23  | Budget guardrails: soft and hard limits, warning at 80%, options to compact, downshift or fail over                                           | Not started. Build after the ledger is solid.                                                                                                                                                                                                        |
| 24  | Recipe library: tuned task templates (fix a bug, add a feature, review a PR)                                                                  | Not started.                                                                                                                                                                                                                                         |
| 25  | Self-benchmark loop: fixed task suite measuring tokens and success per config change                                                          | Not started. Gate for 6, 7, 12 and 15.                                                                                                                                                                                                               |

**Agreed build order:** measurement first (1 to 5, 16 to 19, 25), then defaults and overhead (6 to 13), then guardrails and onboarding (14, 15, 20 to 24). Auto-routing (7), output compression (12) and the plan gate (15) ship behind the Economy/Balanced/Max switch and are checked by the benchmark loop (25).

## 2. Changes Landed & Working Tree

Branch `ship-tasks-20261013` in `D:/Leonidas AIOS/projects/leonidas-code`. **Nothing is pushed.** A push to `main` ships a release to both machines, and Jake has not asked for one.

My commits, newest first:

- `78867ca194` feat(web): token counter popover shows an Input tokens section. [`AgentVelocityMeter.tsx`](../apps/web/src/components/chat/AgentVelocityMeter.tsx), [`AgentVelocityMeter.logic.ts`](../apps/web/src/components/chat/AgentVelocityMeter.logic.ts) (`ledger` field, `deriveLedger`, `formatCacheHitRate`), and its test file. Carries a `Release-Note:` trailer.
- `bed4890ba9` feat(shared): `cacheWriteTokens` in the ledger. [`turnLedger.ts`](../packages/shared/src/turnLedger.ts), [`turnLedger.test.ts`](../packages/shared/src/turnLedger.test.ts).
- `3d2e066e48` feat(shared): turn ledger (`buildTurnLedger`, `sumTurnLedgers`), export `@t3tools/shared/turnLedger` in [`package.json`](../packages/shared/package.json).
- `11128bc226` docs: moved setup, status log and gotchas out of the always-loaded files. New files: [`project/leonidas-setup.md`](../project/leonidas-setup.md), [`project/status-log.md`](../project/status-log.md), [`project/agent-gotchas.md`](../project/agent-gotchas.md). Slimmed [`LEONIDAS.md`](../LEONIDAS.md) and [`agent-playbook.md`](../agent-playbook.md).
- `6d17c74061` feat(scripts): [`scripts/context-audit.ts`](../scripts/context-audit.ts) and its test.

**Measured result:** the repo `CLAUDE.md` chain went from about 14.3k to about 9.7k tokens (4 characters per token estimate). The AIOS chain is about 14.9k, plus about 4.6k for 126 skill descriptions. Re-measure with `node scripts/context-audit.ts CLAUDE.md` and `node scripts/context-audit.ts CLAUDE.local.md --skills ../../.agents/skills`.

**Canon updated this handoff:** a status-log line in [`project/status-log.md`](../project/status-log.md) and a session note in [`project/agent-gotchas.md`](../project/agent-gotchas.md). Both are uncommitted (see below).

**Uncommitted state** (`git status -s` at handoff). Everything except the first two lines below belongs to other agents; do not commit or revert it:

```text
M  .github/workflows/team-release.yml        (staged by someone else)
 M apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.test.ts
 M apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts
 M apps/web/src/agentActivity.test.ts
 M apps/web/src/agentActivity.ts
 M apps/web/src/components/chat/ComposerActivityDetails.tsx
 M apps/web/src/components/chat/ComposerTasksBadge.tsx
 M scripts/Open-LeonidasDev.ps1
M  services/feedback-relay/src/relay.ts      (staged by someone else)
M  services/feedback-relay/wrangler.toml     (staged by someone else)
?? handoff-docs/2026-10-13-onboarding-next-steps.md   (someone else)
```

Mine and uncommitted: `project/status-log.md`, `project/agent-gotchas.md`, and this file. Git refused to commit them because another agent's merge of `origin/main` into `ship-tasks-20261013` was in progress (`.git/MERGE_HEAD` present, `LEONIDAS.md` conflicted). I left that merge alone. **First check:** if the merge is done, commit these three files with explicit paths. If `LEONIDAS.md` is still conflicted, the right resolution is to keep the "Read on demand" pointer section from commit `11128bc226` and move any new status-log line that `origin/main` added into `project/status-log.md`; do not restore the old setup and status sections.

## 3. Decisions & Constraints

- **Decisions locked:** all 25 ideas approved; build order above; slice sizes of one to three ideas per turn, each chosen by Jake with a recommendation and a "what flips it" line.
- **Cache numbers:** completed turns already carry `cacheCreationTokens` in `TurnTokenUsage` ([`providerRuntime.ts`](../packages/contracts/src/providerRuntime.ts) near line 335), and the Claude adapter fills it. No contract change was needed. The live mid-turn `OrchestrationV2ProviderTurnTokenUsage` has no cache-write field; add it only if a feature needs mid-turn writes.
- **Ledger overhead split is an estimate.** No provider reports fixed overhead. `buildTurnLedger` takes `fixedOverheadTokens` from the caller; nothing passes it yet. Show it as "estimated" wherever it appears.
- **A low hit rate can mean a cold cache, not a bug.** The prompt cache lives 5 minutes or 1 hour. Do not raise a cache warning (idea 3) from the hit rate alone.
- **Rules from `AGENTS.md`:** every change passes the `performance-gate` skill before "done"; run only scoped checks, never repo-wide ones; ask before opening a browser; no continuously repainting animation; new files over edits to upstream files; no em dashes; patch notes follow the `leonidas-release` skill.
- **Never push, open a PR, or restart the live app** without Jake saying so. Commit with explicit paths only; other agents work in this tree.

## 4. Dead Ends & Ruled Out Approaches

- **Adding a cache-write field to the contract and Claude adapter.** I planned this, then found completed-turn usage already has it. Check the existing contract before adding fields.
- **`python3` heredocs in this shell.** One hung for over two minutes and left a stuck background job. Use `node -e` or the edit tool.
- **Recursive `grep -r` from the repo root.** It walks `node_modules` and times out. Use `git grep` or scope the path.
- **Running `vp` from `node_modules/.bin`.** That folder disappeared while another agent reinstalled. Use `node_modules/vite-plus/bin` on `PATH` (see §6). Do not bypass the pre-commit hook.
- **Doing all 25 in one pass.** Not realistic: each idea touches the server, contracts, web and often mobile and six provider adapters, and needs tests and a client check. Slice it.

## 5. Next Session Action Plan

1. [ ] Ask Jake for a go to open `http://localhost:15733` and check the Input tokens section of the token counter popover at 390 and 1280 px. This slice is tested but never seen. Follow the `test-t3-app` skill; do not restart anything.
2. [ ] Slice 6, recommended: Context X-ray (idea 2). Move the `auditContext` logic from `scripts/context-audit.ts` into a server service, pass its token estimate as `fixedOverheadTokens` into `deriveLedger`, and show "fixed overhead vs conversation" in the popover. The server pattern is in [`docs/internals/effect-services.md`](../docs/internals/effect-services.md); a service method, a thin transport, a contract in `packages/contracts`.
3. [ ] Slice for the AIOS side (rest of idea 9): slim `D:/Leonidas AIOS/AGENTS.md` (4.9k), `.agents/rules/leonidas-code-overlay.md` (2k), `memory/soul.md` (1.7k) and `modes/router.md` (1.3k). Show Jake the diffs before committing; this is his canon.
4. [ ] Then idea 3 warning (after step 2), idea 11 rule pack, idea 6 defaults profile, and idea 25 benchmark loop. Re-grill only if the design changes.
5. [ ] After each slice: tests first, scoped lint and typecheck, `performance-gate` numbers, explicit-path commit, a line in `project/status-log.md`, then the dock with a recommendation for the next slice.

## 6. How to Run / Verify

Run from `D:/Leonidas AIOS/projects/leonidas-code`. Put `vp` on the path first (needed for tests and for the pre-commit hook):

```text
export PATH="$PWD/node_modules/vite-plus/bin:$PATH"
node scripts/context-audit.ts CLAUDE.md
vp test run scripts/context-audit.test.ts
(cd packages/shared && vp test run src/turnLedger.test.ts)
(cd apps/web && vp test run src/components/chat/AgentVelocityMeter.logic.test.ts)
(cd apps/web && vp exec tsc --noEmit -p .)
```

Expected: context-audit 5 tests, turnLedger 10, AgentVelocityMeter 27, tsc exit 0. Lint a touched file with `vp lint <file>`; the existing warning at `AgentVelocityMeter.logic.ts` line 204 (`reverse`) is not mine.

## 7. Suggested Skills for Next Agent

- `implement`: the test-first slice loop Jake invoked for this work.
- `performance-gate`: required before any commit or "done".
- `test-t3-app`: for the browser check in step 1, after Jake agrees.
- `grill-me`: only if a slice needs a new design decision.
- `safe-parallel-commit`: other agents are editing this working tree.
