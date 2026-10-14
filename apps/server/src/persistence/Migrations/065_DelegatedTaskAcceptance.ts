import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // The check a parent attached to a delegated task, and its verdict once run.
  // The verdict stays null until the child completes and the check runs once.
  yield* sql`
    CREATE TABLE delegated_task_acceptance (
      task_id TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      verdict TEXT,
      exit_code INTEGER,
      output_tail TEXT,
      checked_at TEXT
    )
  `;
});
