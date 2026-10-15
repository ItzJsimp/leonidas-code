# Perf journal

One entry per benchmark run, newest last. Data: [benchmarks.jsonl](./benchmarks.jsonl). Script: [perf-bench.mjs](../scripts/perf-bench.mjs). Agent prompt: [agent-prompt.md](./agent-prompt.md).

## 2026-10-15: baseline (commit bc20cdd351)

- Steps (see the first line of benchmarks.jsonl): typecheck_web 2648 ms warm (25744 ms cold), typecheck_server 58786 ms with 19 known errors, test_web 10387 ms (47 pass), test_desktop 4562 ms (21 pass), build_web 89393 ms, boot_web 13956 ms. Total 180110 ms.
- Bundle: dist 123058 KB, JS 28884 KB, largest JS chunk 2925 KB.
- Noise: an earlier run the same hour had typecheck_server 30715 ms and build_web 82334 ms. Other agents load this machine; expect up to 2x swings.
- Biggest targets: build_web (about 50% of total time) and the 2925 KB chunk.
- Next idea: find what is in the largest JS chunk and lazy-load it.
