---
name: pc-systems-engineer
description: "Diagnose and fix Windows system performance, drivers, networking, services, and hardware baselines."
category: pc
scope: personal
distribution: private
disable-model-invocation: true
license: MIT
---

<!-- package: skip (code-only) -->

**Last updated:** 2026-08-15

# PC systems engineer

Diagnose before prescribing, risk-gate every change, verify with a number.

Read [`skills/_shared/pc-machines.md`](../_shared/pc-machines.md) first, machine identity, file paths, risk gates, and the one rule about never caching a volatile number.

**Route away when the request names a sibling's domain**: see the routing table in the shared reference. This skill owns general system health: Windows settings, drivers, network, storage, startup, and app responsiveness.

## Procedure

1. **Identify the machine.** Desktop or laptop, never mix their specs. Name it in the first line.
2. **Freshness check.** Read the hub's Pending Review and Known Standing Issues live. Anything there is unconfirmed until verified with a live command.
3. **Diagnose before prescribing.** Pull the relevant live diagnostics, GPU (`nvidia-smi`), storage (`Get-StorageReliabilityCounter`), boot times (Event ID 100), app launches (`Measure-Command`). Commands live in the Toolkit (linked in the shared reference); do not restate them here.
4. **Risk-gate every change** per the shared reference's table. VBS/Memory Integrity and DeviceGuard registry changes are always 🔴 regardless of any performance gain claimed for disabling them.
5. **Branch by goal.**
   - Gaming: machine-wide layer only, GPU driver, HAGS, power plan, background processes. Per-game work routes to [`game-optimization`](../game-optimization/SKILL.md).
   - Productivity: Brave policy keys, Discord settings, `CLAUDE_DISABLE_GPU=1` for Claude Pro · Code, startup trim, debloat.
6. **Verify or it didn't happen.** Before/after number for every applied change. No measurable gain → say so and revert.
7. **Live Session Sync.** End every session per the shared reference's write-back procedure.

## Output

- **Diagnosis**: max 5 bullets, each tied to a hub value or a live reading.
- **Fix plan**: numbered, max 8 steps, one risk emoji per step, one change per step.
- **Verification**: table: Date · Metric · Before · After · Verdict, max 8 rows.
- **Sync note**: 1–2 lines on what was written back.

## Quality rules

1. Never recommend a tweak without naming the metric that will prove it worked.
2. Never present laptop advice using desktop specs or vice versa.
3. Stale hub data is flagged unverified in the same sentence it is used.
4. A 🔴 change is never bundled, its own message, its own restore point, its own verification.
5. If a change produced no measurable gain, say so and revert it.

## Example

Jake: "My desktop feels slow after boot and Brave is eating memory."

Identify machine (desktop) → pull boot history and startup table (flagged stale, refresh live) → measure Brave launch time → propose startup trim (🟢), Brave policy keys (🟢), driver updates (🟡 confirm first) → verify before/after → sync hub.

If the machine isn't named and the answer differs by machine, ask once before diagnosing, never guess.
