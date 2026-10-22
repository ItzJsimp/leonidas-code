// Read-only latency report over server trace NDJSON files (live or isolated).
// Usage: node scripts/trace-latency-report.ts [--dir <logs dir>] [--top 40] [--json <out>]
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePathLayer from "@effect/platform-node/NodePath";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";
import * as NodeOS from "node:os";
import * as NodeUtil from "node:util";

const fs = await Effect.runPromise(Effect.provide(FileSystem.FileSystem, NodeFileSystem.layer));
const path = Effect.runSync(Effect.provide(Path.Path, NodePathLayer.layer));
const log = (...args: ReadonlyArray<unknown>) => Effect.runSync(Console.log(...args));

const { values } = NodeUtil.parseArgs({
  options: {
    dir: { type: "string", default: path.join(NodeOS.homedir(), ".t3", "userdata", "logs") },
    prefix: { type: "string", default: "server.trace.ndjson" },
    top: { type: "string", default: "40" },
    json: { type: "string" },
    // Saves a dated snapshot here and prints spans that moved against the previous one.
    snapshot: { type: "string" },
    // Long-lived spans (subscriptions, waits for the user) measure lifetime, not latency.
    exclude: {
      type: "string",
      default: "subscribe|Subscribe|runCachePersistence|awaitClaudeUserInputAnswers|canUseTool",
    },
    focus: {
      type: "string",
      default: "runGitCommand,branchPullRequest,readAntigravityUsage.readFile",
    },
  },
});
const top = Number(values.top);

interface Stat {
  durations: number[];
  errors: number;
  // Sub-threshold spans the sink counted instead of writing (trace-drop-summary).
  fast: number;
}
const bySpan = new Map<string, Stat>();
const bySql = new Map<string, Stat>();
let minStart = Number.POSITIVE_INFINITY;
let maxEnd = 0;
let lines = 0;
// spanId -> [name, parentSpanId, durationMs], for caller attribution of focus spans.
const graph = new Map<string, [string, string | undefined, number]>();
let bytes = 0;

const add = (map: Map<string, Stat>, key: string, ms: number, failed: boolean) => {
  let stat = map.get(key);
  if (!stat) map.set(key, (stat = { durations: [], errors: 0, fast: 0 }));
  stat.durations.push(ms);
  if (failed) stat.errors += 1;
};

const files = (await Effect.runPromise(fs.readDirectory(values.dir)))
  .filter((name) => name.startsWith(values.prefix))
  .map((name) => path.join(values.dir, name));

for (const file of files) {
  bytes += Number((await Effect.runPromise(fs.stat(file))).size);
  const reader = Stream.toAsyncIterable(
    fs.stream(file).pipe(Stream.decodeText(), Stream.splitLines),
  );
  for await (const line of reader) {
    lines += 1;
    let record: {
      type?: string;
      counts?: Record<string, number>;
      name?: string;
      durationMs?: number;
      startTimeUnixNano?: string;
      endTimeUnixNano?: string;
      resourceAttributes?: Record<string, unknown>;
      attributes?: Record<string, unknown>;
      spanId?: string;
      parentSpanId?: string;
      exit?: { _tag?: string };
      status?: { code?: string };
    };
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (record.type === "trace-drop-summary") {
      for (const [name, count] of Object.entries(record.counts ?? {})) {
        add(bySpan, name, 0, false);
        const stat = bySpan.get(name)!;
        stat.durations.pop();
        stat.fast += count;
      }
      continue;
    }
    if (!record.name || typeof record.durationMs !== "number") continue;
    const service = String(record.resourceAttributes?.["service.name"] ?? "t3code-server");
    const key = service === "t3code-server" ? record.name : `[web] ${record.name}`;
    const failed = record.exit?._tag === "Failure" || record.status?.code === "2";
    add(bySpan, key, record.durationMs, failed);
    if (record.spanId) graph.set(record.spanId, [key, record.parentSpanId, record.durationMs]);
    if (record.name === "sqlite") {
      const text = String(record.attributes?.["db.query.text"] ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 110);
      add(bySql, text, record.durationMs, failed);
    }
    const start = Number(record.startTimeUnixNano) / 1e6;
    const end = Number(record.endTimeUnixNano) / 1e6;
    if (start > 0 && start < minStart) minStart = start;
    if (end > maxEnd) maxEnd = end;
  }
}

const windowMin = Math.max((maxEnd - minStart) / 60000, 1 / 60);
const pct = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
const summarize = (map: Map<string, Stat>) =>
  [...map.entries()].map(([name, stat]) => {
    const sorted = stat.durations.toSorted((a, b) => a - b);
    const total = sorted.reduce((sum, value) => sum + value, 0);
    return {
      name,
      count: sorted.length + stat.fast,
      perMin: (sorted.length + stat.fast) / windowMin,
      fast: stat.fast,
      p50: pct(sorted, 0.5),
      p95: pct(sorted, 0.95),
      p99: pct(sorted, 0.99),
      max: sorted.at(-1) ?? 0,
      totalMs: total,
      errors: stat.errors,
    };
  });

const excluded = new RegExp(values.exclude);
const spans = summarize(bySpan).filter((row) => !excluded.test(row.name));
const sql = summarize(bySql);
const fmt = (n: number) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));
const table = (title: string, rows: ReturnType<typeof summarize>) => {
  log(`\n## ${title}`);
  // Percentiles cover written spans only; `fast` spans were under the sink threshold.
  log("count  /min    p50     p95     p99     max   total_s  err   fast  name");
  for (const r of rows.slice(0, top)) {
    log(
      [
        String(r.count).padStart(5),
        fmt(r.perMin).padStart(5),
        fmt(r.p50).padStart(7),
        fmt(r.p95).padStart(7),
        fmt(r.p99).padStart(7),
        fmt(r.max).padStart(7),
        (r.totalMs / 1000).toFixed(1).padStart(8),
        String(r.errors).padStart(4),
        String(r.fast).padStart(6),
        ` ${r.name}`,
      ].join(" "),
    );
  }
};

log(
  `files=${files.length} MB=${(bytes / 1e6).toFixed(1)} spans=${lines} window_min=${windowMin.toFixed(1)} MB_per_min=${(bytes / 1e6 / windowMin).toFixed(2)}`,
);
table(
  "Spans by total time",
  spans.toSorted((a, b) => b.totalMs - a.totalMs),
);
table(
  "Spans by p95 (count >= 5)",
  spans.filter((r) => r.count >= 5).toSorted((a, b) => b.p95 - a.p95),
);
table(
  "Spans by volume",
  spans.toSorted((a, b) => b.count - a.count),
);
table(
  "SQL by total time",
  sql.toSorted((a, b) => b.totalMs - a.totalMs),
);
// Caller attribution: which root operation (top of the parent chain) pays for each focus span.
for (const focus of values.focus.split(",").filter(Boolean)) {
  const byRoot = new Map<string, Stat>();
  for (const [name, parentId, ms] of graph.values()) {
    if (name !== focus) continue;
    const chain: string[] = [];
    let cursor = parentId ? graph.get(parentId) : undefined;
    while (cursor && chain.length < 12) {
      chain.push(cursor[0]);
      cursor = cursor[1] ? graph.get(cursor[1]) : undefined;
    }
    const path =
      chain.length === 0 ? "(no parent in window)" : chain.toReversed().slice(0, 3).join(" > ");
    add(byRoot, path, ms, false);
  }
  table(
    `Callers of ${focus} (root > child > child)`,
    summarize(byRoot).toSorted((a, b) => b.totalMs - a.totalMs),
  );
}
if (values.json) {
  await Effect.runPromise(
    fs.writeFileString(values.json, JSON.stringify({ windowMin, bytes, spans, sql }, null, 2)),
  );
}
if (values.snapshot) {
  await Effect.runPromise(fs.makeDirectory(values.snapshot, { recursive: true }));
  const previousName = (await Effect.runPromise(fs.readDirectory(values.snapshot)))
    .filter((name) => name.endsWith(".json"))
    .toSorted()
    .at(-1);
  const snapshot = {
    takenAt: DateTime.formatIso(DateTime.nowUnsafe()),
    windowMin,
    mbPerMin: bytes / 1e6 / windowMin,
    spans: spans.filter((row) => row.count >= 20),
  };
  await Effect.runPromise(
    fs.writeFileString(
      path.join(values.snapshot, `${snapshot.takenAt.replaceAll(":", "-")}.json`),
      JSON.stringify(snapshot),
    ),
  );
  if (previousName !== undefined) {
    const previous = JSON.parse(
      await Effect.runPromise(fs.readFileString(path.join(values.snapshot, previousName))),
    ) as typeof snapshot;
    const before = new Map(previous.spans.map((row) => [row.name, row]));
    // A move counts when p95 or rate changes by half and by a real amount.
    const moved = snapshot.spans.flatMap((row) => {
      const old = before.get(row.name);
      if (!old) return [];
      const p95Moved = Math.abs(row.p95 - old.p95) > 50 && row.p95 / Math.max(old.p95, 0.1) > 1.5;
      const p95Fell = Math.abs(row.p95 - old.p95) > 50 && old.p95 / Math.max(row.p95, 0.1) > 1.5;
      const rateMoved = Math.abs(row.perMin - old.perMin) > 5;
      if (!p95Moved && !p95Fell && !rateMoved) return [];
      return [
        `${p95Moved ? "SLOWER" : p95Fell ? "FASTER" : "RATE"} ${row.name}: p95 ${fmt(old.p95)} -> ${fmt(row.p95)} ms, ${fmt(old.perMin)} -> ${fmt(row.perMin)} /min`,
      ];
    });
    log(`
## Changes since ${previousName}`);
    log(
      `trace MB/min ${previous.mbPerMin.toFixed(2)} -> ${snapshot.mbPerMin.toFixed(2)}, window ${previous.windowMin.toFixed(0)} -> ${windowMin.toFixed(0)} min`,
    );
    for (const line of moved.slice(0, top)) log(line);
    if (moved.length === 0) log("No span moved by more than the thresholds.");
  }
}
