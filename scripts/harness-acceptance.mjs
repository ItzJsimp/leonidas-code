import * as NodeChildProcess from "node:child_process";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import * as NodeUtil from "node:util";
import { summarize, timingVerdict } from "./harness-acceptance.metrics.ts";

const root = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "..");
const { values } = NodeUtil.parseArgs({
  options: { baseline: { type: "string", default: "339027a210" }, output: { type: "string" } },
});
const output = values.output
  ? NodePath.resolve(values.output)
  : NodePath.join(
      root,
      ".generated",
      "harness-acceptance",
      new Date().toISOString().replaceAll(":", "-"),
    );
// Never reuse an artifact directory: old metrics must not contaminate a new run.
NodeFS.mkdirSync(NodePath.dirname(output), { recursive: true });
NodeFS.mkdirSync(output, { recursive: false });
const git = (...args) =>
  NodeChildProcess.execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const baselineCommit = git("rev-parse", "--verify", `${values.baseline}^{commit}`);
const sourcePaths = [
  "packages/shared/src/promptPrediction.ts",
  "packages/shared/src/promptStyleStandard.json",
  "packages/shared/src/searchRanking.ts",
  "packages/client-runtime/src/state/threadRequests.ts",
  "apps/server/src/connectionRecovery.test.ts",
  "apps/server/src/harnessAcceptance.test.ts",
  "scripts/harness-acceptance.mjs",
  "scripts/harness-acceptance.metrics.ts",
  "scripts/harness-acceptance.record.ts",
  "pnpm-lock.yaml",
  "packages/client-runtime/src/connection/supervisor.ts",
  "packages/client-runtime/src/connection/driver.ts",
  "packages/client-runtime/src/rpc/session.ts",
  "packages/contracts/src/index.ts",
];
const hash = (value) => NodeCrypto.createHash("sha256").update(value).digest("hex");
const report = {
  schemaVersion: 1,
  fixtureVersion: 1,
  startedAt: new Date().toISOString(),
  baselineCommit,
  currentCommit: git("rev-parse", "HEAD"),
  dirtyPaths: git("status", "--porcelain").split("\n").filter(Boolean),
  environment: {
    node: process.version,
    // eslint-disable-next-line t3code/no-global-process-runtime -- Standalone CLI inventories its host, not an injected application runtime.
    platform: NodeOS.platform(),
    // eslint-disable-next-line t3code/no-global-process-runtime -- Standalone CLI inventories its host, not an injected application runtime.
    arch: NodeOS.arch(),
    osRelease: NodeOS.release(),
    cpu: NodeOS.cpus()[0]?.model,
    logicalCpus: NodeOS.cpus().length,
  },
  protocol: {
    warmupCalls: 20,
    measuredCallsPerImplementation: 101,
    ordering: "alternate baseline-first and current-first each sample",
    percentile: "nearest-rank individual-call wall time, includes GC and scheduling",
    recoveryRuns: 10,
    noiseBand: "20% or 0.05 ms, whichever is larger; triage only",
  },
  sourceHashes: Object.fromEntries(
    sourcePaths.map((path) => [path, hash(NodeFS.readFileSync(NodePath.join(root, path)))]),
  ),
  paired: [],
  runtime: [],
  correctness: null,
  errors: [],
  notMeasured: [
    "model first useful response",
    "real provider tool latency",
    "rendering or input frame time",
    "authenticated direct/relay recovery",
    "live provider failover",
    "desktop/mobile workflows",
    "competitor comparison",
  ],
};
const save = () =>
  NodeFS.writeFileSync(
    NodePath.join(output, "results.json"),
    JSON.stringify(report, null, 2) + "\n",
  );

async function loadBaseline(name, directory) {
  const path = `packages/shared/src/${name}.ts`;
  const source = NodeChildProcess.execFileSync("git", ["show", `${baselineCommit}:${path}`], {
    cwd: root,
  });
  NodeFS.writeFileSync(NodePath.join(directory, `${name}.ts`), source);
  return import(NodeURL.pathToFileURL(NodePath.join(directory, `${name}.ts`)).href);
}

function measure(run) {
  const started = performance.now();
  const result = run();
  return { elapsed: performance.now() - started, result };
}

function paired(id, fixture, before, after) {
  const beforeOutput = JSON.stringify(before());
  const afterOutput = JSON.stringify(after());
  const outputMatches = beforeOutput === afterOutput;
  for (let index = 0; index < 20; index++) {
    before();
    after();
  }
  const baseline = [];
  const current = [];
  let lastResult;
  for (let index = 0; index < 101; index++) {
    const order =
      index % 2
        ? [
            [after, current],
            [before, baseline],
          ]
        : [
            [before, baseline],
            [after, current],
          ];
    for (const [run, samples] of order) {
      const measurement = measure(run);
      samples.push(measurement.elapsed);
      lastResult = measurement.result;
    }
  }
  // Consume the final result outside timing; equality is checked independently.
  if (lastResult === undefined) throw new Error(`Missing result for ${id}`);
  const verdict = timingVerdict(baseline, current, outputMatches);
  report.paired.push({
    id,
    fixtureHash: hash(JSON.stringify(fixture)),
    outputMatches,
    baselineOutputHash: hash(beforeOutput),
    currentOutputHash: hash(afterOutput),
    baseline: summarize(baseline),
    current: summarize(current),
    samplesMs: { baseline, current },
    verdict,
  });
  process.stdout.write(
    `${id}: ${verdict}; median ${summarize(baseline).medianMs.toFixed(3)} -> ${summarize(current).medianMs.toFixed(3)} ms\n`,
  );
}

async function main() {
  const scratch = NodeFS.mkdtempSync(NodePath.join(output, "baseline-"));
  NodeFS.writeFileSync(
    NodePath.join(scratch, "promptStyleStandard.json"),
    NodeChildProcess.execFileSync(
      "git",
      ["show", `${baselineCommit}:packages/shared/src/promptStyleStandard.json`],
      { cwd: root },
    ),
  );
  const beforePrompt = await loadBaseline("promptPrediction", scratch);
  const beforeSearch = await loadBaseline("searchRanking", scratch);
  const afterPrompt = await import(
    NodeURL.pathToFileURL(NodePath.join(root, "packages/shared/src/promptPrediction.ts")).href
  );
  const afterSearch = await import(
    NodeURL.pathToFileURL(NodePath.join(root, "packages/shared/src/searchRanking.ts")).href
  );
  const candidates = Array.from({ length: 256 }, (_, index) => ({
    text: `Review feature ${index} and improve harness execution performance. Add reliable provider recovery tests.`,
    count: 1 + (index % 4),
    lastSeen: index,
  }));
  for (const count of [100, 1_000, 10_000]) {
    const messages = Array.from({ length: count }, (_, index) => ({
      role: index % 5 === 0 ? "system" : index % 2 ? "assistant" : "user",
      text: `Review harness execution performance ${index}`,
    }));
    paired(
      `prompt-ranking/${count}-messages`,
      { candidates, messages },
      () => beforePrompt.contextualPromptCandidates(candidates, messages),
      () => afterPrompt.contextualPromptCandidates(candidates, messages),
    );
  }
  const paths = Array.from(
    { length: 1_000 },
    (_, index) => `packages/feature-${index}/src/provider-recovery-controller.test.ts`,
  );
  paired(
    "search/1000-paths",
    { paths, query: "prrc" },
    () => paths.map((value) => beforeSearch.scoreSubsequenceMatch(value, "prrc")),
    () => paths.map((value) => afterSearch.scoreSubsequenceMatch(value, "prrc")),
  );
  save();
  const testPaths = [
    "scripts/harness-acceptance.metrics.test.ts",
    "apps/server/src/harnessAcceptance.test.ts",
    "apps/server/src/connectionRecovery.test.ts",
    "apps/server/src/orchestration-v2/ThreadTransportPerformance.test.ts",
    "packages/client-runtime/src/operations/commands.performance.test.ts",
    "packages/client-runtime/src/state/threadHistoryMerge.test.ts",
    "packages/shared/src/httpReadiness.test.ts",
  ];
  report.testSourceHashes = Object.fromEntries(
    testPaths.map((path) => [path, hash(NodeFS.readFileSync(NodePath.join(root, path)))]),
  );
  const started = performance.now();
  const tests = NodeChildProcess.spawnSync(
    process.execPath,
    [
      NodePath.join(root, "node_modules/vite-plus/bin/vp"),
      "test",
      "run",
      ...testPaths,
      "--maxWorkers=1",
      "--reporter=default",
      "--reporter=json",
      `--outputFile=${NodePath.join(output, "tests.json")}`,
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 180_000,
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        LEONIDAS_ACCEPTANCE_OUTPUT_DIR: output,
        LEONIDAS_ACCEPTANCE_RECOVERY_SAMPLES: "10",
      },
    },
  );
  NodeFS.writeFileSync(
    NodePath.join(output, "test-output.txt"),
    (tests.stdout ?? "") + (tests.stderr ?? ""),
  );
  process.stdout.write(tests.stdout ?? "");
  process.stderr.write(tests.stderr ?? "");
  const testReport = JSON.parse(NodeFS.readFileSync(NodePath.join(output, "tests.json"), "utf8"));
  report.correctness = {
    exitCode: tests.status,
    passed: testReport.numPassedTests,
    failed: testReport.numFailedTests,
    skipped: testReport.numPendingTests,
    success: testReport.success,
    elapsedMs: performance.now() - started,
  };
  if (tests.error) report.errors.push(tests.error.message);
  const rows = NodeFS.readFileSync(NodePath.join(output, "runtime.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const grouped = new Map();
  for (const row of rows) grouped.set(row.id, [...(grouped.get(row.id) ?? []), ...row.samplesMs]);
  report.runtime = [...grouped].map(([id, samplesMs]) => ({
    id,
    ...summarize(samplesMs),
    samplesMs,
    verdict: "baseline-only",
    note: id.includes("reconnected")
      ? "Includes detection, supervisor backoff and resubscription; not network RTT"
      : "Internal fixture wall time",
  }));
  for (const id of [
    "loopback.initial-connect",
    "loopback.drop-to-reconnected",
    "loopback.initial-rpc-probe",
    "loopback.recovered-rpc-probe",
  ]) {
    if (grouped.get(id)?.length !== 10)
      report.errors.push(`Expected 10 complete recovery measurements for ${id}`);
  }
  for (const size of [100, 1_000, 10_000]) {
    if (grouped.get(`pending-question/${size}-older-items`)?.length !== 101)
      report.errors.push(`Missing long-thread samples at ${size}`);
  }
  report.finishedAt = new Date().toISOString();
  for (const [path, expected] of Object.entries({
    ...report.sourceHashes,
    ...report.testSourceHashes,
  })) {
    if (hash(NodeFS.readFileSync(NodePath.join(root, path))) !== expected)
      report.errors.push(`Source changed during measurement: ${path}`);
  }
  report.internalStatus =
    tests.status !== 0 ||
    !testReport.success ||
    report.errors.length ||
    report.paired.some((entry) => entry.verdict === "fail-output" || entry.verdict === "regression")
      ? "fail"
      : "pass";
  save();
  process.stdout.write(
    `Internal acceptance: ${report.internalStatus}. Results: ${NodePath.join(output, "results.json")}\n`,
  );
  if (report.internalStatus !== "pass") process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  report.errors.push(String(error));
  report.internalStatus = "fail";
  save();
  process.stderr.write(`${String(error)}\nResults: ${NodePath.join(output, "results.json")}\n`);
  process.exitCode = 1;
}
