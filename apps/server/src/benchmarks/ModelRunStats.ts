/**
 * Per-model results from the user's own chats: how often a model and effort
 * finished, failed or needed a retry, and how long it took. The benchmark
 * explorer shows these beside the public scores.
 */
import type { ModelRunStat, ModelRunStats } from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

/** Long enough to cover habits, short enough that retired models age out. */
const WINDOW_DAYS = 90;
const FAILED = new Set(["failed", "interrupted"]);

interface RunRow {
  readonly model: string | null;
  readonly effort: string | null;
  readonly status: string;
  readonly requestedAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly attempts: number;
}

const median = (values: ReadonlyArray<number>): number | undefined => {
  if (values.length === 0) return undefined;
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

/** Pure fold over run rows, exported for tests. */
export function aggregateRunStats(rows: ReadonlyArray<RunRow>): ReadonlyArray<ModelRunStat> {
  const groups = new Map<string, { model: string; effort?: string; rows: RunRow[] }>();
  for (const row of rows) {
    if (!row.model || row.status === "running" || row.status === "queued") continue;
    const effort = row.effort?.toLowerCase() || undefined;
    const key = `${row.model}\u0000${effort ?? ""}`;
    const group = groups.get(key) ?? { model: row.model, ...(effort ? { effort } : {}), rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(({ model, effort, rows: list }) => {
      const durations = list.flatMap((row) =>
        row.status === "completed" && row.startedAt && row.completedAt
          ? [(Date.parse(row.completedAt) - Date.parse(row.startedAt)) / 1000]
          : [],
      );
      const medianSeconds = median(
        durations.filter((value) => Number.isFinite(value) && value >= 0),
      );
      const lastUsedAt = list.reduce((latest, row) =>
        row.requestedAt > latest.requestedAt ? row : latest,
      ).requestedAt;
      return {
        model,
        ...(effort ? { effort } : {}),
        runs: list.length,
        completed: list.filter((row) => row.status === "completed").length,
        failed: list.filter((row) => FAILED.has(row.status)).length,
        cancelled: list.filter((row) => row.status === "cancelled").length,
        retried: list.filter((row) => row.attempts > 1).length,
        ...(medianSeconds === undefined ? {} : { medianSeconds }),
        lastUsedAt,
      };
    })
    .toSorted((a, b) => b.runs - a.runs);
}

export const readModelRunStats = () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    const since = DateTime.formatIso(DateTime.makeUnsafe(now - WINDOW_DAYS * 86_400_000));
    const rows = yield* sql<RunRow>`
      SELECT
        json_extract(r.payload_json, '$.modelSelection.model') AS "model",
        (
          SELECT json_extract(option.value, '$.value')
          FROM json_each(json_extract(r.payload_json, '$.modelSelection.options')) AS option
          WHERE json_extract(option.value, '$.id') IN ('effort', 'reasoningEffort', 'reasoning', 'variant')
          LIMIT 1
        ) AS "effort",
        r.status AS "status",
        r.requested_at AS "requestedAt",
        json_extract(r.payload_json, '$.startedAt') AS "startedAt",
        r.completed_at AS "completedAt",
        (
          SELECT COUNT(*) FROM orchestration_v2_projection_run_attempts a WHERE a.run_id = r.run_id
        ) AS "attempts"
      FROM orchestration_v2_projection_runs r
      WHERE r.requested_at >= ${since}
    `;
    return { since, stats: aggregateRunStats(rows) } satisfies ModelRunStats;
  }).pipe(
    Effect.tapError((error) => Effect.logWarning("model run stats unavailable", error)),
    Effect.catch(() =>
      Clock.currentTimeMillis.pipe(
        Effect.map((now): ModelRunStats => ({
          since: DateTime.formatIso(DateTime.makeUnsafe(now)),
          stats: [],
        })),
      ),
    ),
  );
