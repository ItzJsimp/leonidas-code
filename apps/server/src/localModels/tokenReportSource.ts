/**
 * Reads the numbers for the token report from the provider turns table. It selects counts
 * only: token totals and a count of activity items. It never selects message text.
 */
import * as Effect from "effect/Effect";
import type * as SqlClient from "effect/sql/SqlClient";

import type { TokenReportRow } from "./tokenReport.ts";

interface TurnRow {
  readonly input_tokens: number | null;
  readonly cached_input_tokens: number | null;
  readonly output_tokens: number | null;
  readonly tool_calls: number | null;
}

/** Item types that are talk, not work. Any other item type counts as activity (a tool call). */
const TALK_ITEM_TYPES = [
  "user_message",
  "assistant_message",
  "reasoning",
  "notification",
  "system_notice",
  "checkpoint",
  "proposed_plan",
  "todo_list",
];

export const readTokenReportRows = (sql: SqlClient.SqlClient, sinceIso: string) =>
  sql<TurnRow>`
    SELECT
      json_extract(turn.payload_json, '$.turnTokenUsage.inputTokens') AS input_tokens,
      json_extract(turn.payload_json, '$.turnTokenUsage.cachedInputTokens') AS cached_input_tokens,
      json_extract(turn.payload_json, '$.turnTokenUsage.outputTokens') AS output_tokens,
      CASE
        WHEN NOT EXISTS (
          SELECT 1 FROM orchestration_v2_projection_turn_items AS item
          WHERE item.provider_turn_id = turn.provider_turn_id
        ) THEN NULL
        ELSE (
          SELECT COUNT(*) FROM orchestration_v2_projection_turn_items AS item
          WHERE item.provider_turn_id = turn.provider_turn_id
            AND item.type NOT IN ${sql.in(TALK_ITEM_TYPES)}
        )
      END AS tool_calls
    FROM orchestration_v2_projection_provider_turns AS turn
    WHERE turn.started_at >= ${sinceIso}
  `.pipe(
    Effect.map((rows): ReadonlyArray<TokenReportRow> =>
      rows.map((row) => ({
        inputTokens: row.input_tokens ?? undefined,
        cachedInputTokens: row.cached_input_tokens ?? undefined,
        outputTokens: row.output_tokens ?? undefined,
        toolCalls: row.tool_calls,
      })),
    ),
  );
