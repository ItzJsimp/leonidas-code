import * as Effect from "effect/Effect";
import type * as SqlClient from "effect/sql/SqlClient";

import type { PonytailUsage } from "@t3tools/contracts";

interface TotalsRow {
  readonly provider: string;
  readonly turns: number;
  readonly input_tokens: number | null;
  readonly cached_input_tokens: number | null;
  readonly output_tokens: number | null;
  readonly minutes: number | null;
}

/**
 * Per-provider totals from the app's own turn records, so Claude, Codex and Gemini are all counted
 * with no ledger write. Counts only: no message text is selected.
 */
export const readProviderTotals = (
  sql: SqlClient.SqlClient,
  sinceIso: string,
  untilIso = "9999-12-31T00:00:00.000Z",
) =>
  sql<TotalsRow>`
    SELECT
      thread.provider AS provider,
      COUNT(*) AS turns,
      SUM(json_extract(turn.payload_json, '$.turnTokenUsage.inputTokens')) AS input_tokens,
      SUM(json_extract(turn.payload_json, '$.turnTokenUsage.cachedInputTokens')) AS cached_input_tokens,
      SUM(json_extract(turn.payload_json, '$.turnTokenUsage.outputTokens')) AS output_tokens,
      SUM((julianday(turn.completed_at) - julianday(turn.started_at)) * 1440.0) AS minutes
    FROM orchestration_v2_projection_provider_turns AS turn
    JOIN orchestration_v2_projection_provider_threads AS thread
      ON thread.provider_thread_id = turn.provider_thread_id
    WHERE turn.started_at >= ${sinceIso} AND turn.started_at < ${untilIso}
    GROUP BY thread.provider
    ORDER BY turns DESC
  `.pipe(
    Effect.map((rows): PonytailUsage["providers"] =>
      rows.map((row) => ({
        provider: row.provider,
        turns: row.turns,
        inputTokens: row.input_tokens ?? 0,
        cachedInputTokens: row.cached_input_tokens ?? 0,
        outputTokens: row.output_tokens ?? 0,
        agentMinutes: Math.max(0, row.minutes ?? 0),
      })),
    ),
  );
