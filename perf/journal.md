# Perf journal

One entry per benchmark run, newest last. Data: [benchmarks.jsonl](./benchmarks.jsonl). Script: [perf-bench.mjs](../scripts/perf-bench.mjs). Agent prompt: [agent-prompt.md](./agent-prompt.md).

## 2026-10-15: baseline (commit bc20cdd351)

- Steps (see the first line of benchmarks.jsonl): typecheck_web 2648 ms warm (25744 ms cold), typecheck_server 58786 ms with 19 known errors, test_web 10387 ms (47 pass), test_desktop 4562 ms (21 pass), build_web 89393 ms, boot_web 13956 ms. Total 180110 ms.
- Bundle: dist 123058 KB, JS 28884 KB, largest JS chunk 2925 KB.
- Noise: an earlier run the same hour had typecheck_server 30715 ms and build_web 82334 ms. Other agents load this machine; expect up to 2x swings.
- Biggest targets: build_web (about 50% of total time) and the 2925 KB chunk.
- Next idea: find what is in the largest JS chunk and lazy-load it.

## 2026-10-15: scheduled run (commit 22f0224229)

- Merge: origin/main merge into perf/harness stopped. The vp pre-commit hook ran `vp fmt` on 125 staged files and failed with "The command line is too long". The hook was not bypassed. The merge was discarded with `git reset --hard HEAD`. Nothing was lost: the staged content came from origin/main.
- Result: this run measured the perf/harness tip (22f0224229), not the latest origin/main.
- Steps (before in the 14:45 baseline -> now): typecheck_web 2648 -> 1017 ms, typecheck_server 58786 -> 18947 ms (both runs: 19 known errors, same failure), test_web 10387 -> 9313 ms (47 pass), test_desktop 4562 -> 3088 ms (21 pass), build_web 89393 -> 49422 ms, boot_web 13956 -> 13600 ms. Total 180110 -> 95557 ms.
- Bundle: unchanged (dist 123058 KB, JS 28884 KB, largest JS chunk 2925 KB).
- Regressions: none. Every step is faster. The drop is load noise, not a code change.
- Largest chunk: heic-to (2925 KB) is already a dynamic import (imageCompression.ts). It does not load at boot. Not a target.
- Change tried: none. No clear static import of a heavy library in the 1307 KB _chat chunk was found in one pass. The commit blocker also stops larger changes for now.
- Kept or reverted: nothing to keep or revert.
- Next idea: fix the pre-commit hook for Windows (batch `vp fmt` files, or skip it for bench files). Then merge origin/main. Then map the modules in the _chat chunk (for example with a bundle visualizer) and lazy-load the largest one that is not used at boot.

## 2026-10-24: scheduled baseline (commit 2855b225b6, origin/main)

- Setup: the bench worktree C:/lcw/perf-bench did not exist. Created it as a detached worktree of origin/main and ran pnpm install --frozen-lockfile (2m 29s). The brief expected it to exist already.
- Steps (2026-10-15 15:00 run -> now): typecheck_web 1017 -> 13706 ms (cold cache in a fresh worktree, not a code change), typecheck_server 18947 ms with 19 errors -> 16040 ms with 0 errors, test_web 9313 ms (47 pass) -> 2559 ms (51 pass), test_desktop 3088 ms (21 pass) -> 3931 ms (21 pass), build_web 49422 -> 51662 ms, boot_web 13600 -> 13879 ms, server_live new step: 19330 ms (ready 10576 ms, idle 357 MB).
- Total: 95557 -> 121438 ms. Failures: none.
- Bundle: total 123058 -> 127486 KB, JS 28884 -> 29891 KB (+3.5%, under the 5% gate). Largest JS chunk unchanged at 2925 KB.
- Regressions: none at the 15% gate for steps. typecheck_web is cold-cache only. The JS size rise is under 5%.
- Change tried: none this run. Target by rule: slowest step is build_web (51.7 s). Not attempted because this run was the baseline; the journal idea is to map the _chat chunk and lazy-load a large module not used at boot.
- Kept or reverted: nothing to keep or revert.
- Next idea: run the build with a bundle visualizer, find the largest module in the _chat chunk that boot does not need, and lazy-load it. Re-run with --only build_web,boot_web.

## 2026-10-26: scheduled baseline (commit 2855b225b6, origin/main)

- Setup: the brief expected branch perf/harness. It was gone, and the 2026-10-24 run was committed on another checkout's local main. Recreated perf/harness from origin/main (2855b225b6, same as the 10-24 run) and restored that run's data. The upstream link was removed so a plain push cannot target main.
- Steps (2026-10-24 -> now): typecheck_web 13706 -> 1219 ms, typecheck_server 16040 -> 19106 ms (0 errors), test_web 2559 -> 2805 ms (51 pass), test_desktop 3931 -> 2413 ms (21 pass), build_web 51662 -> 56649 ms, server_live 19330 -> 18430 ms (ready 9568 ms, command 3985 ms, idle 357 MB), boot_web 13879 -> 13603 ms.
- Total: 121438 -> 114606 ms. Failures: none.
- Bundle: total 127486 KB, JS 29891 KB, largest JS chunk 2925 KB (heic-to, already a dynamic import). Unchanged from 10-24.
- Regressions: none over the gates. typecheck_server +19% and build_web +10%, both under 25%. idleMb unchanged. Only one earlier full run exists on this code, so the median of the last 5 lines is not yet available.
- Target: largest JS chunk is not a target. Slowest step is build_web. The _chat chunk (1485 KB) is the largest app chunk.
- Change tried: lazy-load BenchmarkExplorer in apps/web/src/components/chat/UsageBenchmarks.tsx (it renders only when open). Scoped tests: 7 of 7 pass (UsageOverlayCard refresh tests).
- Before -> after (two runs, affected steps): _chat 1485 -> 1454 KB (-2.1%). JS total 29891 -> 29897 KB (+0.02%). build_web 56649 -> 57364 and 56359 ms (+1.3% and -0.5%). boot_web 13603 -> 13599 and 13606 ms. typecheck_web 1219 -> 22459 and 1171 ms (cold-cache noise).
- Kept or reverted: reverted. No run beat the baseline by 5%, and JS total rose slightly. Branch perf/2026-10-26-lazy-benchmark-explorer deleted.
- Next idea: the main chunk (708 KB) is the largest chunk that loads at boot. Find its largest modules with the source map (same method as the _chat check) and lazy-load one that boot does not need. A 2% chunk cut cannot pass the 5% gate alone, so pick a module of 50 KB or more.

## 2026-10-28: scheduled run (commit 695902ef06, origin/main)

- Setup: switched to perf/harness and rebased onto origin/main (695902ef06). The rebase was clean. pnpm-lock.yaml did not change, so no install.
- Steps (2026-10-26 17:03 run -> now): typecheck_web 1219 -> 12006 ms, typecheck_server 19106 -> 15990 ms (0 errors), test_web 2805 -> 2446 ms (51 pass), test_desktop 2413 -> 2319 ms (21 pass), build_web 56649 -> 52616 ms, server_live 18430 -> 17186 ms (idle 352 MB), boot_web 13603 -> 13592 ms.
- Total: 114606 -> 116412 ms. Failures: none.
- Bundle: total 127486 KB, JS 29891 -> 29920 KB (+0.1%). Largest JS chunk unchanged at 2925 KB (heic-to, dynamic import).
- Regressions: typecheck_web 12006 ms against a median of 1934 ms. This is cold cache noise, the same pattern as the 10-24 and 10-26 runs. It is not a code change. Not rerun, so it stays flagged. Idle memory and JS size are under the gates.
- Target: the largest chunk is not a target. Slowest step is build_web (52.6 s). Journal idea: lazy-load a module of 50 KB or more from the main chunk (main-C5J6TrB7.js, 725 KB).
- Change tried: none. Candidates checked from the main chunk source map: CommandPalette.tsx (134 KB source, always mounted in __root.tsx, 2500 lines, not a small change) and ui/qr-code.tsx (used in two settings and nightly views, small gain). Neither fits a 1 to 3 file change that can clear the 5% gate. Build time noise (about 10%) is larger than the gain a chunk cut of this size can give.
- Kept or reverted: nothing to keep or revert.
- Next idea: split CommandPalette so the palette body loads on first open (keep children rendered in __root.tsx). Measure with build_web and boot_web, twice each. Expect a 2 to 5% main chunk cut, so the gate may still fail. Consider raising the build time target instead.
