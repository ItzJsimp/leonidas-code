import { assert, describe, it } from "@effect/vitest";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { runMigrations } from "../persistence/Migrations.ts";
import { DelegatedTaskLedger, layer } from "./DelegatedTaskLedger.ts";

const usage = (inputTokens: number | null) => ({
  usageStatus: "complete" as const,
  inputTokens,
  outputTokens: 10,
  cachedInputTokens: null,
  reasoningTokens: null,
  providerTurnCount: 1,
  runCount: 1,
  wallTimeMs: 1000,
});
const entry = (taskId: string, model: string, status: string, inputTokens: number | null) => ({
  taskId,
  parentThreadId: "parent",
  childThreadId: `child-${taskId}`,
  providerInstanceId: "claude",
  model,
  status,
  usage: usage(inputTokens),
  branch: null,
  recordedAt: "2026-10-14T12:00:00.000Z",
});

const run = <A, E>(effect: Effect.Effect<A, E, DelegatedTaskLedger>) =>
  Effect.gen(function* () {
    yield* runMigrations();
    return yield* effect;
  }).pipe(
    Effect.provide(Layer.provideMerge(layer, NodeSqliteClient.layer({ filename: ":memory:" }))),
  );

describe("DelegatedTaskLedger", () => {
  it.effect("overwrites a task row and sums per model", () =>
    run(
      Effect.gen(function* () {
        const ledger = yield* DelegatedTaskLedger;
        yield* ledger.record(entry("a", "haiku", "running", 5));
        yield* ledger.record(entry("a", "haiku", "completed", 100));
        yield* ledger.record(entry("b", "haiku", "failed", null));
        yield* ledger.record(entry("c", "sonnet", "completed", 40));
        const rows = yield* ledger.summarize();
        const haiku = rows.find((row) => row.model === "haiku");
        assert.deepStrictEqual(
          [rows.length, haiku?.taskCount, haiku?.completedCount, haiku?.inputTokens],
          [2, 2, 1, 100],
        );
      }),
    ),
  );
});
