import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // One row per delegated task: provider-reported cost beside the outcome, so
  // routing and review can compare models on measured data.
  yield* sql`
    CREATE TABLE delegated_task_ledger (
      task_id TEXT PRIMARY KEY,
      parent_thread_id TEXT NOT NULL,
      child_thread_id TEXT NOT NULL,
      provider_instance_id TEXT NOT NULL,
      model TEXT NOT NULL,
      status TEXT NOT NULL,
      usage_status TEXT NOT NULL,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cached_input_tokens INTEGER,
      reasoning_tokens INTEGER,
      wall_time_ms INTEGER,
      branch TEXT,
      recorded_at TEXT NOT NULL
    )
  `;
  yield* sql`
    CREATE INDEX idx_delegated_task_ledger_model
    ON delegated_task_ledger(provider_instance_id, model, recorded_at DESC)
  `;
});
