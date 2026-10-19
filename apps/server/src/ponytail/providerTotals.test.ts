import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

import * as SqlitePersistence from "../persistence/Sqlite.ts";
import { readProviderTotals } from "./providerTotals.ts";

it.effect("sums turns, tokens and minutes per provider inside the period", () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    for (const [pt, provider] of [
      ["a", "codex"],
      ["b", "antigravity"],
    ] as const) {
      yield* sql`
        INSERT INTO orchestration_v2_projection_provider_threads
          (provider_thread_id, provider, status, updated_at, payload_json)
        VALUES (${pt}, ${provider}, 'active', '2026-10-10T00:00:00.000Z', '{}')
      `;
    }
    const add = (id: string, pt: string, start: string, end: string, out: number, ord: number) =>
      sql`
        INSERT INTO orchestration_v2_projection_provider_turns
          (provider_turn_id, thread_id, provider_thread_id, node_id, ordinal, status, started_at, completed_at, payload_json)
        VALUES (${id}, 't1', ${pt}, ${`n-${id}`}, ${ord}, 'completed', ${start}, ${end},
          ${JSON.stringify({ turnTokenUsage: { inputTokens: 100, cachedInputTokens: 60, outputTokens: out } })})
      `;
    yield* add("t1", "a", "2026-10-10T00:00:00.000Z", "2026-10-10T00:02:00.000Z", 10, 1);
    yield* add("t2", "a", "2026-10-11T00:00:00.000Z", "2026-10-11T00:01:00.000Z", 20, 2);
    yield* add("t3", "b", "2026-10-11T00:00:00.000Z", "2026-10-11T00:03:00.000Z", 5, 3);
    yield* add("old", "b", "2026-09-01T00:00:00.000Z", "2026-09-01T00:03:00.000Z", 99, 4);

    const rows = yield* readProviderTotals(sql, "2026-10-01T00:00:00.000Z");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      provider: "codex",
      turns: 2,
      outputTokens: 30,
      inputTokens: 200,
    });
    expect(rows[0]?.agentMinutes).toBeCloseTo(3);
    expect(rows[1]).toMatchObject({ provider: "antigravity", turns: 1, outputTokens: 5 });
  }).pipe(Effect.provide(SqlitePersistence.layerMemory)),
);
