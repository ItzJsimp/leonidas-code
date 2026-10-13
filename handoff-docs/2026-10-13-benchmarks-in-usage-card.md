# Session Handoff: Rebuild Benchmarks as a section of the unified usage card

**Date:** 2026-10-13 | **Operator:** Jake | **Status:** Checkpoint (card shipped, benchmarks section not started)
**Saved to:** `handoff-docs/2026-10-13-benchmarks-in-usage-card.md`

## 0. Resume Prompt

```text
Resume from `handoff-docs/2026-10-13-benchmarks-in-usage-card.md`. Read it fully, then the files its §2 lists. Verify git state matches §2 and do not redo anything marked done. Present §5, then start step 1 unless it needs my input.
```

## 1. Goal & Focus

Jake chose option B: bring model benchmarks back as a section inside the one usage card (`UsageOverlayCard`). The old Benchmarks tab was a tab in the removed top-right panel; half of it rendered off screen and its sorting and data looked poor. Rebuild it small, readable and inside the card width.

## 2. Changes Landed & Working Tree

- **Landed on `origin/main`:** `a1cfcfcbd8` feat(web): one usage card. Ring beside Send hovers for context and clicks to toggle the card. Limit bars drain (blue 50%+, amber under 50%, red under 10% left). Legacy context indicator setting removed. Pushed from worktree `C:/lcw/usagecard` (branch `feat/unified-usage-card`).
- **Deleted in that commit:** `ChatComposerUsageLimits.tsx` (held the Benchmarks tab), `ChatUsageHoverCard.tsx`, `DetailedContextBreakdownView.tsx`.
- **Orphaned, still present:** `apps/web/src/components/chat/ModelBenchmarksPanel.tsx` (231 lines, from `91305536fa`). Nothing imports it. Server side is live: `apps/server/src/benchmarks/ModelBenchmarks.ts`, RPC in `ws.ts`, MCP `model_benchmarks` tool.
- **Also lost with the panel:** the "start a chat with this model" hook (`onStartChat` / `handleNewThreadWithModel`, `providerEntries` props).
- **Removed on purpose:** the active-agent badge on account rows. Its files `useActiveAgentCounts.ts` and `ActiveAgentsBadge.tsx` are untracked in the main checkout (another agent's work). Re-add after they are committed.
- **Local `main` state:** 11 unpushed local commits, plus other agents' uncommitted edits. I reset my own edits there to HEAD. Another agent's hover-card badge edit is saved at `C:/lcw/other-agent-hovercard-badge.patch`.
- **Canon not updated:** `LEONIDAS.md` and `agent-playbook.md` have other agents' uncommitted edits, so I did not add status lines. Add one line to each when committing the benchmarks work.

## 3. Decisions & Constraints

- **Locked:** one card, one control (the ring). No second panel. Benchmarks must live inside `UsageOverlayCard` (w-80 card, scrolls inside `max-h`).
- **Constraints:** mind the card width; no continuously animating UI; use `UsageBar`-style components, no `className` restyling on `Button`; commit from a clean worktree with explicit `git add` paths; a push to `main` ships a release to Mob.

## 4. Dead Ends & Ruled Out Approaches

- **Typecheck in the main checkout:** `node_modules/.pnpm` is missing there, so `tsc` and the dev server fail. Use a worktree on `C:` (`pnpm install --frozen-lockfile` takes about 2 minutes) and the `typescript@7.0.2` bin from it.
- **`git rm` in the main checkout:** it stalled on the D: drive. Use plain `rm` or work on `C:/lcw`.
- **Browser check on `localhost:15733`:** nothing listened there. Run `pnpm run dev` in a worktree and mint a pairing URL with `T3CODE_HOME=<worktree>/.t3 node apps/server/src/bin.ts pair`.

## 5. Next Session Action Plan

1. [ ] Read `ModelBenchmarksPanel.tsx` and the `ModelBenchmarks` RPC in `ws.ts`. Note what data it returns and why the layout overflowed.
2. [ ] Create worktree `C:/lcw/benchmarks-card` from `origin/main`; run `pnpm install --frozen-lockfile`.
3. [ ] Add a collapsed "Model benchmarks" section to `UsageOverlayCard.tsx`: top models for the connected providers, one line each (rank, name, score), default sort by score, expand for more.
4. [ ] Decide with Jake whether to restore "start a chat with this model" on each row.
5. [ ] Check at 390 and 1280 px in the dev app, run focused tests, add a `Release-Note:` trailer, commit explicit paths, push only on Jake's go.

## 6. How to Run / Verify

- `cd C:/lcw/<worktree> && pnpm run dev`, pair with the minted URL, open a chat, click the ring.
- `apps/web/node_modules/.bin/vp.CMD test run <touched test files>` and `node node_modules/.pnpm/typescript@7.0.2/node_modules/typescript/bin/tsc --noEmit` from `apps/web`.

## 7. Suggested Skills for Next Agent

- `@skills/design-build`: layout of the new section.
- `@skills/performance-gate`: required before commit.
- `@skills/safe-parallel-commit`: the main checkout has other agents' edits.
