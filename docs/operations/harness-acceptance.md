# Internal harness acceptance

Run from the repository root on Node 24 with the existing dependencies installed:

```sh
node scripts/harness-acceptance.mjs
```

Optional arguments: `--baseline <git-commit>` selects the shared-helper baseline;
`--output <new-directory>` selects the artifacts directory. The default baseline
is `339027a210`, the origin commit immediately before this branch's transplanted
harness fixes. It is reachable on the pushed branch, unlike a source-only commit
the branch never carried. Its `promptPrediction`, `searchRanking` and
`promptStyleStandard` blobs are the same pre-fix helpers the earlier
44-improvement pass compared against, so the paired benchmarks stay comparable.
The default output is a new timestamped directory under
`.generated/harness-acceptance`. An existing output directory is rejected to
prevent mixed results. No provider calls, live database writes, browser,
installed-app restart or additional dependency is needed.

## What the result means

The command exits zero only when the selected correctness tests pass, outputs
match in paired benchmarks, all expected timing samples exist, measured source
files stay unchanged during the run, and paired timing stays inside the initial
regression tolerance. This is internal acceptance, not complete product acceptance.

| Measure               | Fixture and repetitions                                                                                 | Rule                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt ranking        | 256 candidates; 100, 1000 and 10000 messages; 20 warmup calls and 101 measured calls per implementation | Identical output; median and p95 may not worsen by more than 20% or 0.05 ms, whichever is larger                                      |
| Search                | Same 1000 paths and query; same paired protocol                                                         | Same output and timing rule                                                                                                           |
| Pending question      | Newest question followed by 100, 1000 or 10000 older items; 101 calls after 20 warmups                  | Exactly one newest question remains actionable; timing establishes a baseline                                                         |
| Loopback recovery     | Ten separate real WebSocket sessions, each abruptly disconnected once                                   | New session, resubscription, correct environment, successful RPC probe and complete disconnect cleanup; timing establishes a baseline |
| Transport and history | Existing bounded snapshot, command payload, history merge and stalled-body readiness tests              | Existing behavioral and byte-budget assertions pass                                                                                   |

The timing tolerance is a conservative triage rule for a shared workstation. It
is not a confidence interval, user experience target or permission to ignore a
correctness failure. A timing regression returns nonzero; investigate workload,
source changes and host load before changing the rule. Do not rerun until green
and discard unsuccessful runs.

Baseline/current shared functions are loaded into the same Node process. Each
sample alternates which implementation runs first; fixtures are built before
timing, and output serialization/equality checks are outside timing. The baseline
uses its own committed style-standard asset. The report contains raw individual
call samples and nearest-rank median/p95, including scheduling and garbage
collection. RPC and recovery times are separate from the pure helper comparison.
Ten recovery samples are a small descriptive baseline, not a stable tail estimate;
its nearest-rank p95 is the slowest sample. Drop-to-reconnected includes detection,
supervisor backoff and resubscription, not just network latency. A loopback RPC
probe is not model inference or real provider tool execution.

## Artifacts and remaining scope

Each run writes `results.json`, the Vitest `tests.json`, `test-output.txt`, runtime
timing records and baseline helper copies. Results record the Git commits, dirty
paths, measured source hashes, fixture hashes, runtime version and CPU identity.
Dirty checkouts are allowed and explicitly identified. Paired comparisons apply
only to shared helpers; correctness and recovery run against the current checkout.
Do not interpret the Git commit alone as identifying an uncommitted checkout.

Keep all successful and unsuccessful runs when establishing a reference. Compare
raw results only with matching fixtures, settings and environments. The first
runtime measurements intentionally have no invented latency threshold; use several
representative host runs to propose one before making them a timing gate.

The suite does not measure first useful model response, actual provider tool
latency, input/render frame time, authentication or relay recovery, live provider
failover, desktop/mobile workflows, or comparative performance against other
harnesses. Those require separate end-to-end acceptance fixtures.

Sources: [runner](../../scripts/harness-acceptance.mjs),
[long-thread fixture](../../apps/server/src/harnessAcceptance.test.ts),
[real transport fixture](../../apps/server/src/connectionRecovery.test.ts).
