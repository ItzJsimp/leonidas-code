import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`CREATE TABLE saved_item_events (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT, command_id TEXT NOT NULL UNIQUE,
    item_id TEXT NOT NULL, event_type TEXT NOT NULL, item_json TEXT NOT NULL, occurred_at TEXT NOT NULL
  )`;
  yield* sql`CREATE TABLE projection_saved_items (
    item_id TEXT PRIMARY KEY, project_id TEXT, status TEXT NOT NULL, kind TEXT NOT NULL,
    moved_to_board INTEGER NOT NULL, item_json TEXT NOT NULL, updated_at TEXT NOT NULL
  )`;
  yield* sql`CREATE INDEX idx_saved_items_project_status ON projection_saved_items(project_id, status, updated_at)`;
  yield* sql`CREATE TABLE saved_item_commands (
    command_id TEXT PRIMARY KEY, request_json TEXT NOT NULL, result_json TEXT NOT NULL
  )`;
  yield* sql`CREATE TABLE saved_item_effects (
    command_id TEXT PRIMARY KEY, item_id TEXT NOT NULL, action TEXT NOT NULL,
    request_json TEXT NOT NULL, actor TEXT NOT NULL, caller_thread_id TEXT,
    created_at TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0
  )`;
  yield* sql`CREATE INDEX idx_saved_item_effects_pending ON saved_item_effects(completed, created_at)`;
  yield* sql`CREATE INDEX idx_saved_item_agent_budget ON saved_item_effects(actor, created_at) WHERE action != 'task'`;
  yield* sql`CREATE INDEX idx_saved_item_launched_agent ON projection_saved_items(json_extract(item_json, '$.launchedThreadId')) WHERE json_extract(item_json, '$.launchedBy') = 'agent'`;
  yield* sql`CREATE INDEX idx_saved_item_scheduled_messages ON orchestration_v2_projection_messages(json_extract(payload_json, '$.scheduledTaskId'), thread_id)`;
});
