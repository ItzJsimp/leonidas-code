---
name: "performance-gate"
description: "Mandatory pre-ship gate for every code change: audit memory, speed, component efficiency, bloat and quality with measured evidence. Use before any commit, PR or done on code in any project."
category: code
scope: structural
distribution: core
type: skill
id: skill-performance-gate
title: "Performance Gate: Pre-Ship Audit for Every Code Change"
kind: procedure
load: on-demand
owner: shared
verified: 2026-10-12
related:
  [
    "skills-index",
    "implement",
    "performance-optimization",
    "code-simplification",
    "memory-leak-debugging",
    "tdd",
    "code-skimmer",
  ]
generated: false
license: MIT
---

# Performance Gate: Pre-Ship Audit for Every Code Change

Runs after the work passes its tests and before commit, PR or "done". Not optional and not a rewrite pass: it audits the diff you made, fixes what it finds, and reports a verdict. Peak standard means measured, small and clean, not clever.

## When it fires

Any change to source, scripts, build config, styles or dependency manifests. Skip only for pure docs, copy or canon edits with no code. A one-line fix still runs the Fast lane.

## Lanes

- **Fast (diff under 40 net lines, no new dependency, no hot path):** run step 1 and the 12-item checklist silently, report one verdict line.
- **Full (anything else, or any hot path: render loops, startup, IPC and WebSocket traffic, audio or transcription threads, list rendering):** all five steps, with a before/after measurement.

## Steps

1. **Footprint (deterministic):** `pwsh .agents/skills/performance-gate/scripts/Measure-ChangeFootprint.ps1 -Repo <project root> [-Paths <changed files>]`. In a shared checkout, pass `-Paths` so other sessions' work is not counted. It reports net lines, new dependencies, oversized files that grew, and debug leftovers. Exit 1 means a hard check failed (new dependency, debug leftover): fix or justify in writing.
2. **Checklist (below):** answer each item from the diff, not from memory. Use [`code-skimmer`](../code-skimmer/SKILL.md) or `codebase-memory-mcp` to read callers instead of dumping files.
3. **Measure (Full lane):** one number before, one after, same method, per [`references/measure-recipes.md`](./references/measure-recipes.md). A claim of "faster" or "lighter" without both numbers is a guess. Never optimize what you did not measure; if nothing regressed and nothing was targeted, record "no regression" with the check you ran.
4. **Slim:** run [`code-simplification`](../code-simplification/SKILL.md) on the diff. Delete what the change made dead. Prefer removing a branch, layer or option over polishing it. Net lines should be flat or negative unless the feature needs more.
5. **Instrument:** a project that ships code must report latency through its perf emitter (`templates/perf-emitters/`, thresholds in `standards/perf-thresholds.json`) and be listed in `standards/perf-registry.json`. A new hot path (dictation, agent turn, routine) gets a metric and a threshold row in the same change. `pwsh scripts/Detect-Drift.ps1 -Gates 13` verifies it.
6. **Verdict:** emit the block below. FAIL means fix and re-run; never ship on FAIL without the user accepting the named risk.

## The 12-item checklist

**Memory (3)**

1. Every listener, timer, subscription, signal connection and child process created has a matching teardown on the same lifecycle.
2. No unbounded cache, array, log buffer or history; every collection has a cap or eviction.
3. Large payloads (models, audio, images, snapshots) are loaded once, streamed or released; none is copied per call.

**Speed (3)** 4. Nothing blocks the UI or main thread: no sync I/O, heavy loops or model calls on it. 5. No work repeated per render, per tick or per message that could be computed once, memoized or batched; no N+1 reads. 6. Startup and hot paths gained no eager imports, no new top-level work, no extra round trips or payload fields.

**Component efficiency (2)** 7. UI changes re-render only what changed (stable props and keys, no new global store reads in lists); long lists are virtualized; animations use transform and opacity, not layout. 8. Data sent over WebSocket, IPC or HTTP is the minimum the receiver uses; no whole-object resends for a field change.

**Bloat and quality (4)** 9. Zero new dependencies unless the standard library or an existing dependency cannot do it; a new one names size, maintenance and why. 10. No duplicate of an existing helper, no speculative option, no abstraction with one caller, no commented-out or dead code, no compat shim nobody calls. 11. Names, types and error paths are explicit; no silent catch, no gratuitous `any`, no swallowed failure that hides a broken invariant. 12. A test or check proves the behavior and, for a perf-motivated change, guards the number (budget, benchmark or assertion).

Stack-specific traps: [`references/stack-checks.md`](./references/stack-checks.md).

## Standing set (use automatically)

- **Every code change:** `performance-gate`, [`implement`](../implement/SKILL.md), [`tdd`](../tdd/SKILL.md), [`code-simplification`](../code-simplification/SKILL.md), [`code-skimmer`](../code-skimmer/SKILL.md), [`safe-parallel-commit`](../safe-parallel-commit/SKILL.md).
- **On trigger:** [`performance-optimization`](../performance-optimization/SKILL.md) when a speed or load target exists; [`memory-leak-debugging`](../memory-leak-debugging/SKILL.md) when memory grows; [`improve-codebase-architecture`](../improve-codebase-architecture/SKILL.md) and [`codebase-design`](../codebase-design/SKILL.md) when a file or module is oversized or tangled.
- **By stack:** [`node`](../node/SKILL.md), [`vercel-react-best-practices`](../vercel-react-best-practices/SKILL.md), [`react-native-best-practices`](../react-native-best-practices/SKILL.md).
- **Harness built-ins:** `/simplify` after the change, `/code-review` for correctness, `/security-review` when input, auth or secrets are touched.

## Verdict block

```
Performance Gate: PASS | FAIL | PASS-WITH-RISK
Lane: Fast | Full   Footprint: net <n> lines, <n> new deps, <n> debug
Measured: <metric> <before> -> <after> via <method>   (or: no regression, <check>)
Fixed during gate: <what> | Risk accepted: <what, why>
```

## Never

- Claim a speed or memory win without a before and after number.
- Add a dependency, cache, worker or abstraction "for performance" without a measurement that justifies it.
- Skip the gate because tests are green: tests prove behavior, this proves cost.
- Rewrite working code outside the diff. Report out-of-scope findings as a task per canon rule 14.
