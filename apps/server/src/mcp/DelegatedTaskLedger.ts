import type { OrchestratorMcpDelegatedTaskUsage } from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";

export interface DelegatedTaskLedgerEntry {
  readonly taskId: string;
  readonly parentThreadId: string;
  readonly childThreadId: string;
  readonly providerInstanceId: string;
  readonly model: string;
  readonly status: string;
  readonly usage: OrchestratorMcpDelegatedTaskUsage;
  readonly branch: string | null;
  readonly recordedAt: string;
}

export interface DelegatedTaskLedgerSummary {
  readonly providerInstanceId: string;
  readonly model: string;
  readonly taskCount: number;
  readonly completedCount: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly wallTimeMs: number;
}

export class DelegatedTaskLedger extends Context.Service<
  DelegatedTaskLedger,
  {
    /** Upsert by task id: a continued task overwrites its earlier row. */
    readonly record: (entry: DelegatedTaskLedgerEntry) => Effect.Effect<void>;
    /** Totals per provider and model, newest activity first. */
    readonly summarize: () => Effect.Effect<ReadonlyArray<DelegatedTaskLedgerSummary>>;
  }
>()("t3/mcp/DelegatedTaskLedger") {}

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  return DelegatedTaskLedger.of({
    // The ledger is telemetry: a failed write is logged, never shown to the task caller.
    record: (entry) =>
      sql`
        INSERT INTO delegated_task_ledger (
          task_id, parent_thread_id, child_thread_id, provider_instance_id, model, status,
          usage_status, input_tokens, output_tokens, cached_input_tokens, reasoning_tokens,
          wall_time_ms, branch, recorded_at
        ) VALUES (
          ${entry.taskId}, ${entry.parentThreadId}, ${entry.childThreadId},
          ${entry.providerInstanceId}, ${entry.model}, ${entry.status},
          ${entry.usage.usageStatus}, ${entry.usage.inputTokens}, ${entry.usage.outputTokens},
          ${entry.usage.cachedInputTokens}, ${entry.usage.reasoningTokens},
          ${entry.usage.wallTimeMs}, ${entry.branch}, ${entry.recordedAt}
        )
        ON CONFLICT(task_id) DO UPDATE SET
          status = excluded.status, usage_status = excluded.usage_status,
          input_tokens = excluded.input_tokens, output_tokens = excluded.output_tokens,
          cached_input_tokens = excluded.cached_input_tokens,
          reasoning_tokens = excluded.reasoning_tokens, wall_time_ms = excluded.wall_time_ms,
          branch = excluded.branch, recorded_at = excluded.recorded_at
      `.pipe(
        Effect.asVoid,
        Effect.catch((error) => Effect.logWarning("delegated task ledger write failed", error)),
      ),
    summarize: () =>
      sql<{
        readonly provider_instance_id: string;
        readonly model: string;
        readonly task_count: number;
        readonly completed_count: number;
        readonly input_tokens: number;
        readonly output_tokens: number;
        readonly cached_input_tokens: number;
        readonly wall_time_ms: number;
      }>`
        SELECT provider_instance_id, model, COUNT(*) AS task_count,
          SUM(status = 'completed') AS completed_count,
          COALESCE(SUM(input_tokens), 0) AS input_tokens,
          COALESCE(SUM(output_tokens), 0) AS output_tokens,
          COALESCE(SUM(cached_input_tokens), 0) AS cached_input_tokens,
          COALESCE(SUM(wall_time_ms), 0) AS wall_time_ms
        FROM delegated_task_ledger
        GROUP BY provider_instance_id, model
        ORDER BY MAX(recorded_at) DESC
      `.pipe(
        Effect.map((rows) =>
          rows.map((row) => ({
            providerInstanceId: row.provider_instance_id,
            model: row.model,
            taskCount: row.task_count,
            completedCount: row.completed_count,
            inputTokens: row.input_tokens,
            outputTokens: row.output_tokens,
            cachedInputTokens: row.cached_input_tokens,
            wallTimeMs: row.wall_time_ms,
          })),
        ),
        Effect.catch(() => Effect.succeed([])),
      ),
  });
});

export const layer = Layer.effect(DelegatedTaskLedger, make);
