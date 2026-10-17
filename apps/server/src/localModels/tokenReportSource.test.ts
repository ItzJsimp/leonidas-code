import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

import * as SqlitePersistence from "../persistence/Sqlite.ts";
import { readTokenReportRows } from "./tokenReportSource.ts";

const addTurn = (
  sql: SqlClient.SqlClient,
  id: string,
  startedAt: string,
  usage: Record<string, number> | null,
  items: ReadonlyArray<string>,
  ordinal: number,
) =>
  Effect.gen(function* () {
    const payload = JSON.stringify(usage === null ? {} : { turnTokenUsage: usage });
    yield* sql`
      INSERT INTO orchestration_v2_projection_provider_turns
        (provider_turn_id, thread_id, provider_thread_id, node_id, ordinal, status, started_at, payload_json)
      VALUES (${id}, 't1', 'pt1', ${`node-${id}`}, ${ordinal}, 'completed', ${startedAt}, ${payload})
    `;
    for (const [index, type] of items.entries()) {
      yield* sql`
        INSERT INTO orchestration_v2_projection_turn_items
          (turn_item_id, thread_id, provider_turn_id, ordinal, type, status, updated_at, payload_json)
        VALUES (${`${id}-${String(index)}`}, 't1', ${id}, ${index}, ${type}, 'completed', ${startedAt}, '{"secret":"never read"}')
      `;
    }
  });

it.effect("reads token counts and activity counts only, inside the period", () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* addTurn(
      sql,
      "short",
      "2026-10-10T00:00:00.000Z",
      { inputTokens: 50, outputTokens: 7 },
      ["user_message", "assistant_message"],
      1,
    );
    yield* addTurn(
      sql,
      "tools",
      "2026-10-11T00:00:00.000Z",
      { inputTokens: 90, outputTokens: 20 },
      ["assistant_message", "command_execution", "file_change"],
      2,
    );
    yield* addTurn(
      sql,
      "noitems",
      "2026-10-12T00:00:00.000Z",
      { inputTokens: 5, outputTokens: 5 },
      [],
      3,
    );
    yield* addTurn(sql, "nousage", "2026-10-13T00:00:00.000Z", null, ["assistant_message"], 4);
    yield* addTurn(
      sql,
      "old",
      "2026-09-01T00:00:00.000Z",
      { inputTokens: 999, outputTokens: 999 },
      ["assistant_message"],
      5,
    );

    const rows = yield* readTokenReportRows(sql, "2026-10-01T00:00:00.000Z");
    const sorted = [...rows].sort((a, b) => (a.inputTokens ?? -1) - (b.inputTokens ?? -1));
    expect(sorted).toEqual([
      { inputTokens: undefined, outputTokens: undefined, toolCalls: 0 },
      { inputTokens: 5, outputTokens: 5, toolCalls: null },
      { inputTokens: 50, outputTokens: 7, toolCalls: 0 },
      { inputTokens: 90, outputTokens: 20, toolCalls: 2 },
    ]);
    expect(JSON.stringify(rows)).not.toContain("never read");
  }).pipe(Effect.provide(SqlitePersistence.layerMemory)),
);
