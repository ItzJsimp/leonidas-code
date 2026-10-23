---
name: game-optimization
description: "Research and tune game engine settings, launch options, shader caches, and graphics benchmarks."
category: pc
scope: personal
distribution: private
disable-model-invocation: true
license: MIT
---

<!-- package: skip (code-only) -->

**Last updated:** 2026-08-15

# Game optimization profile builder

One page, one game, evidence-only. No tweak without a tested source or a measured before/after.

Read [`skills/_shared/pc-machines.md`](../_shared/pc-machines.md) first. Machine-wide changes (GPU drivers, power plan, HAGS, VBS) are **out of scope**: route to [`pc-systems-engineer`](../pc-systems-engineer/SKILL.md). Capture files go to `Benchmarks\` in the PC Audit tree.

## Procedure

# ## Phase 1 : Game intelligence

Identify the engine and what it implies before touching a setting: Unity (heavily CPU/GC-bound, entity count and grass/tree cvars drive frametime more than GPU settings), Unreal Engine 5 (Lumen/Nanite cost, shader-compilation stutter, `r.*` cvars, upscaler choice), Source-family (`.cfg` files, `fps_max`). Verify the current engine version, don't assume from memory.

Locate and read every config the game exposes: UE, `%LOCALAPPDATA%\<Game>\Saved\Config\Windows\GameUserSettings.ini` and `Engine.ini`; Unity, Steam launch options plus in-game console convars; Source, `autoexec.cfg` and `videoconfig.txt`. Inventory the full settings surface and note what each option costs, CPU, GPU, or VRAM.

Map to the machine: desktop (12GB VRAM, often CPU-bound at high refresh) vs laptop (8GB VRAM, thermally constrained).

# ## Phase 2 : Deep research (evidence only)

Live web search for tested evidence on this game on similar hardware, benchmark videos with on-screen FPS overlays, community A/B tests, reputable optimization sources. **Admission rule:** a tweak enters the plan only with credible tested evidence dated after the game's latest major patch (12 months max), or it gets benchmarked in Phase 4. Record every source: link, date, what it tested, claimed result.

# ## Phase 3 : Baseline benchmark

Capture before changing anything. A repeatable scenario matters more than the tool, same server, same map, same time of day, 60 seconds.

1. Record a 60-second run in CapFrameX or PresentMon.
2. Export to CSV in `Benchmarks\`, named `<game>_<machine>_<date>_<baseline|change-N>.csv`.
3. Compute Avg FPS, 1% low, 0.2% low from the frametime column.
4. Check `nvidia-smi` GPU utilisation during the run: sustained 95–100% = GPU-bound; noticeably lower with high CPU load = CPU-bound.

Write the baseline before any change.

# ## Phase 4 : Change loop, one at a time

Apply exactly one change → re-capture the identical scenario → compare. Risk-label every change per the shared reference. Keep a change only on a measured gain (roughly ≥2% average or a meaningful 1%-low improvement); otherwise revert and log "no effect." A result inside ±2% is noise, not a win. In population-based games, note the server population on every capture, it can move frametime more than any setting.

# ## Phase 5 : Write-back

Update the game's profile page: settings table (setting · value · why · source), launch options, per-game GPU overrides, benchmark log, change log.

### Patch rule

A major patch invalidates prior verification. Re-read config files (patches often reset them) and re-run Phase 2 for post-patch evidence before re-verifying.

## Output

- **Engine dossier**: max 10 bullets: engine, config paths, key cvars, known bottlenecks.
- **Settings table**: every row cites a source or a benchmark. No uncited rows.
- **Benchmark log**: Date · Scenario · Avg FPS · 1% Low · 0.2% Low · Bottleneck · Notes.
- **Change log**: Date · Change · Risk · Result (measured delta).
- **Chat summary**: max 10 lines: baseline vs final, top 3 highest-impact changes.

## Quality rules

1. No tweak without evidence, "people say it helps" is banned.
2. One change per capture.
3. Check every guide's date against the game's patch history before trusting it.
4. Machine-wide changes never enter a game profile, route them out.
5. 1% and 0.2% lows outrank average FPS.

## Example

Jake: "Optimize Rust on my desktop." → Unity engine dossier, read Rust's launch options and F1-console convar families → deep research on Rust-tested settings, post-patch only → 60-second baseline on a populated server → one change at a time with re-captures → write everything back.

Game not yet profiled → create its page first, set launcher and machine, then run the phases. Never optimize without a page to record against.
