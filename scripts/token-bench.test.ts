import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

import {
  collectBenchmarkOutput,
  parseClaudeResult,
  summarize,
  type RunResult,
} from "./token-bench.ts";

const run = (variant: string, passed: boolean, tokens: number): RunResult => ({
  variant,
  task: "t",
  passed,
  inputTokens: tokens,
  outputTokens: 0,
  costUsd: 0.01,
  turns: 1,
  durationMs: 1,
});

describe("token-bench", () => {
  it.effect("retains the process output limit in bytes", () =>
    Effect.gen(function* () {
      const limit = 1024 * 1024;
      const output = yield* collectBenchmarkOutput(Stream.make(Buffer.alloc(limit, "a")));
      expect(output).toHaveLength(limit);
      const error = yield* Effect.flip(
        collectBenchmarkOutput(Stream.make(Buffer.alloc(limit), Buffer.from("x"))),
      );
      expect(error.message).toContain("exceeded 1 MiB");
    }),
  );
  it("counts cache reads and writes as input and tolerates missing fields", () => {
    const out = parseClaudeResult(
      JSON.stringify({
        usage: {
          input_tokens: 10,
          cache_read_input_tokens: 100,
          cache_creation_input_tokens: 5,
          output_tokens: 7,
        },
        total_cost_usd: 0.5,
        num_turns: 3,
      }),
    );
    expect(out).toMatchObject({ inputTokens: 115, outputTokens: 7, costUsd: 0.5, turns: 3 });
    expect(parseClaudeResult("{}")?.inputTokens).toBe(0);
    expect(parseClaudeResult("not json")).toBeNull();
  });

  it("compares each variant's pass rate and tokens to the baseline", () => {
    const rows = summarize([
      run("baseline", true, 1000),
      run("baseline", true, 1000),
      run("rules", true, 800),
      run("rules", false, 800),
    ]);
    expect(rows.find((r) => r.variant === "baseline")?.tokensVsBaseline).toBeNull();
    const rules = rows.find((r) => r.variant === "rules");
    expect(rules?.tokensVsBaseline).toBeCloseTo(-0.2);
    expect(rules?.passRate).toBe(0.5);
  });
});
