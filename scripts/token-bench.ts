// Measures tokens, cost and success per config on a fixed task suite, so a default
// (efficient-work rule, model choice) is kept only if it saves tokens without losing passes.
// Usage: node scripts/token-bench.ts            prints the plan, spends nothing
//        node scripts/token-bench.ts --run [--repeat 2] [--model <id>] [--out <file.json>]
// --run starts real `claude -p` sessions in temp folders and spends subscription tokens.
import { Console, DateTime, Effect, FileSystem, Path, Schema, Stream } from "effect";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as NodeServices from "@effect/platform-node/NodeServices";

import { EFFICIENT_AGENT_RULES } from "../packages/provider-core/src/server/efficientAgentRules.ts";

export interface Variant {
  readonly id: string;
  readonly appendRules?: boolean;
  readonly model?: string;
}
export interface BenchTask {
  readonly id: string;
  readonly prompt: string;
  readonly files: Readonly<Record<string, string>>;
  readonly check: string;
}
export interface RunResult {
  readonly variant: string;
  readonly task: string;
  readonly passed: boolean;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly turns: number;
  readonly durationMs: number;
}

const services = Effect.provide(NodeServices.layer);

function log(line: string) {
  Effect.runSync(Console.log(line));
}

const asNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

/** Reads the `claude -p --output-format json` object; missing usage counts as zero. */
export function parseClaudeResult(
  stdout: string,
): Omit<RunResult, "variant" | "task" | "passed"> | null {
  let raw: unknown;
  try {
    raw = JSON.parse(stdout);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const result = raw as Record<string, unknown>;
  const usage = (
    typeof result.usage === "object" && result.usage !== null ? result.usage : {}
  ) as Record<string, unknown>;
  return {
    // Everything sent: fresh input plus cache reads and writes.
    inputTokens:
      asNumber(usage.input_tokens) +
      asNumber(usage.cache_read_input_tokens) +
      asNumber(usage.cache_creation_input_tokens),
    outputTokens: asNumber(usage.output_tokens),
    costUsd: asNumber(result.total_cost_usd),
    turns: asNumber(result.num_turns),
    durationMs: asNumber(result.duration_ms),
  };
}

export interface VariantSummary {
  readonly variant: string;
  readonly runs: number;
  readonly passRate: number;
  readonly meanTokens: number;
  readonly meanCostUsd: number;
  /** Mean total tokens versus the baseline variant; negative means fewer tokens. */
  readonly tokensVsBaseline: number | null;
}

export function summarize(
  results: ReadonlyArray<RunResult>,
  baselineId = "baseline",
): VariantSummary[] {
  const mean = (xs: ReadonlyArray<number>) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const rows = [...Map.groupBy(results, (r) => r.variant)].map(([variant, runs]) => ({
    variant,
    runs: runs.length,
    passRate: runs.filter((r) => r.passed).length / runs.length,
    meanTokens: mean(runs.map((r) => r.inputTokens + r.outputTokens)),
    meanCostUsd: mean(runs.map((r) => r.costUsd)),
  }));
  const base = rows.find((r) => r.variant === baselineId)?.meanTokens;
  return rows.map((r) => ({
    ...r,
    tokensVsBaseline: base && r.variant !== baselineId ? r.meanTokens / base - 1 : null,
  }));
}

async function runOne(
  variant: Variant,
  task: BenchTask,
  modelOverride?: string,
): Promise<RunResult> {
  return await Effect.runPromise(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "token-bench-" });
      for (const [name, body] of Object.entries(task.files)) {
        const target = paths.join(dir, name);
        yield* fs.makeDirectory(paths.dirname(target), { recursive: true });
        yield* fs.writeFileString(target, body);
      }
      const model = variant.model ?? modelOverride;
      const started = DateTime.toEpochMillis(DateTime.nowUnsafe());
      // Keep prompt data on stdin and quote the path passed through the Windows shell.
      const rulesFile = paths.join(dir, ".rules.txt");
      if (variant.appendRules) yield* fs.writeFileString(rulesFile, EFFICIENT_AGENT_RULES);
      const command = ChildProcess.make(
        "claude",
        [
          "-p",
          "--output-format",
          "json",
          "--permission-mode bypassPermissions",
          "--no-session-persistence",
          "--setting-sources project",
          ...(variant.appendRules
            ? ["--append-system-prompt-file", `"${rulesFile.replaceAll('"', '\\"')}"`]
            : []),
          ...(model ? ["--model", model] : []),
        ],
        {
          cwd: dir,
          stdin: Stream.encodeText(Stream.make(task.prompt)),
          extendEnv: true,
          shell: true,
        },
      );
      const output = yield* spawner.string(command).pipe(Effect.timeout(600_000));
      const parsed = parseClaudeResult(output);
      const checkCode = yield* spawner
        .exitCode(ChildProcess.make(task.check, [], { cwd: dir, extendEnv: true, shell: true }))
        .pipe(Effect.timeout(60_000));
      return {
        variant: variant.id,
        task: task.id,
        passed: Number(checkCode) === 0,
        inputTokens: parsed?.inputTokens ?? 0,
        outputTokens: parsed?.outputTokens ?? 0,
        costUsd: parsed?.costUsd ?? 0,
        turns: parsed?.turns ?? 0,
        durationMs: parsed?.durationMs ?? DateTime.toEpochMillis(DateTime.nowUnsafe()) - started,
      };
    }).pipe(Effect.scoped, services),
  );
}

if (import.meta.main) {
  const path = Effect.runSync(Path.Path.pipe(Effect.provide(NodeServices.layer)));
  const fileSystem = Effect.runSync(FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)));
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i === -1 ? undefined : args[i + 1];
  };
  const suitePath = await Effect.runPromise(
    path.fromFileUrl(new URL("./token-bench/suite.json", import.meta.url)).pipe(services),
  );
  const suite = Schema.decodeSync(Schema.fromJsonString(Schema.Unknown))(
    await Effect.runPromise(fileSystem.readFileString(suitePath)),
  ) as { variants: Variant[]; tasks: BenchTask[] };
  const repeat = Number(flag("--repeat") ?? 1);
  if (!args.includes("--run")) {
    const total = suite.variants.length * suite.tasks.length * repeat;
    log(
      `Plan: ${suite.variants.length} variants x ${suite.tasks.length} tasks x ${repeat} = ${total} real claude sessions.`,
    );
    log("Nothing run. Add --run to spend tokens.");
  } else {
    const results: RunResult[] = [];
    for (let i = 0; i < repeat; i++)
      for (const task of suite.tasks)
        for (const variant of suite.variants) {
          const result = await runOne(variant, task, flag("--model"));
          results.push(result);
          const tokens = result.inputTokens + result.outputTokens;
          log(`${variant.id} ${task.id} ${result.passed ? "pass" : "FAIL"} ${tokens} tokens`);
        }
    for (const s of summarize(results)) {
      const delta =
        s.tokensVsBaseline === null
          ? ""
          : ` (${(s.tokensVsBaseline * 100).toFixed(0)}% tokens vs baseline)`;
      const pass = (s.passRate * 100).toFixed(0);
      log(
        `${s.variant}: ${pass}% pass, ${Math.round(s.meanTokens)} mean tokens, $${s.meanCostUsd.toFixed(3)}${delta}`,
      );
    }
    const out = flag("--out");
    if (out)
      await Effect.runPromise(fileSystem.writeFileString(out, JSON.stringify(results, null, 2)));
  }
}
