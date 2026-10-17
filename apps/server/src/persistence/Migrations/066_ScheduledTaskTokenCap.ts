import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // Per-task token budget for one run; NULL means no cap.
  yield* sql`ALTER TABLE scheduled_tasks ADD COLUMN token_cap INTEGER`;
});
