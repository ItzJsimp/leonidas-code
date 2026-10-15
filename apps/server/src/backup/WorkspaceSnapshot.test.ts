import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as Snapshot from "./WorkspaceSnapshot.ts";

const tempDir = (label: string) =>
  NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), `snap-${label}-`));

const seedCards = (dir: string) => {
  NodeFS.mkdirSync(NodePath.join(dir, "sub"), { recursive: true });
  NodeFS.writeFileSync(NodePath.join(dir, "one.md"), "---\nid: one\n---\nHistory: 雪 \r\nline\n");
  NodeFS.writeFileSync(NodePath.join(dir, "sub", "two.md"), "---\nid: two\n---\nBody\n");
};

const seedItem = (sql: SqlClient.SqlClient, id: string) =>
  Effect.gen(function* () {
    yield* sql`INSERT INTO saved_item_events (command_id, item_id, event_type, item_json, occurred_at)
      VALUES (${`cmd-${id}`}, ${id}, 'created', '{"id":"x"}', '2026-10-15T00:00:00Z')`;
    yield* sql`INSERT INTO projection_saved_items (item_id, project_id, status, kind, moved_to_board, item_json, updated_at)
      VALUES (${id}, NULL, 'open', 'prompt', 0, '{"title":"Quotes \\"雪\\""}', '2026-10-15T00:00:00Z')`;
    yield* sql`INSERT INTO saved_item_commands (command_id, request_json, result_json)
      VALUES (${`cmd-${id}`}, '{}', '{}')`;
  });

const readAll = (dir: string): Record<string, string> => {
  const out: Record<string, string> = {};
  const walk = (current: string) => {
    for (const entry of NodeFS.readdirSync(current, { withFileTypes: true })) {
      const full = NodePath.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else
        out[NodePath.relative(dir, full).replaceAll("\\", "/")] = NodeFS.readFileSync(full, "utf8");
    }
  };
  walk(dir);
  return out;
};

it.effect("round trips task cards and saved items into fresh state", () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const tasks = tempDir("tasks");
    const snapshot = tempDir("out");
    seedCards(tasks);
    yield* seedItem(sql, "a");
    yield* seedItem(sql, "b");

    const manifest = yield* Snapshot.createSnapshot({ tasksDir: tasks, snapshotDir: snapshot });
    assert.equal(manifest.cards.length, 2);
    assert.equal(manifest.savedItems.projection_saved_items, 2);

    const before = readAll(tasks);
    NodeFS.rmSync(tasks, { recursive: true });
    yield* sql`DELETE FROM saved_item_events`;
    yield* sql`DELETE FROM projection_saved_items`;
    yield* sql`DELETE FROM saved_item_commands`;

    yield* Snapshot.restoreSnapshot({ snapshotDir: snapshot, tasksDir: tasks });
    assert.deepEqual(readAll(tasks), before);
    assert.equal((yield* sql`SELECT * FROM projection_saved_items`).length, 2);
    assert.equal((yield* sql`SELECT * FROM saved_item_events`).length, 2);
    assert.equal((yield* sql`SELECT * FROM saved_item_commands`).length, 2);
  }).pipe(Effect.provide(Sqlite.layerMemory)),
);

const failureReason = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.map(Effect.result(effect), (result) =>
    result._tag === "Failure" && result.failure instanceof Snapshot.WorkspaceSnapshotError
      ? result.failure.reason
      : "succeeded",
  );

const makeSnapshot = (sql: SqlClient.SqlClient, itemId = "a") =>
  Effect.gen(function* () {
    const tasks = tempDir("tasks");
    const snapshotDir = tempDir("out");
    seedCards(tasks);
    yield* seedItem(sql, itemId);
    yield* Snapshot.createSnapshot({ tasksDir: tasks, snapshotDir });
    return { tasks, snapshotDir };
  });

it.effect("create only reads the source: cards and rows are unchanged", () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const tasks = tempDir("tasks");
    seedCards(tasks);
    yield* seedItem(sql, "a");
    const before = readAll(tasks);
    yield* Snapshot.createSnapshot({ tasksDir: tasks, snapshotDir: tempDir("out") });
    assert.deepEqual(readAll(tasks), before);
    assert.equal((yield* sql`SELECT * FROM projection_saved_items`).length, 1);
  }).pipe(Effect.provide(Sqlite.layerMemory)),
);

it.effect("rejects an unfinished snapshot and leaves current data alone", () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const { tasks, snapshotDir } = yield* makeSnapshot(sql);
    NodeFS.rmSync(NodePath.join(snapshotDir, "manifest.json"));
    const before = readAll(tasks);
    assert.equal(
      yield* failureReason(Snapshot.restoreSnapshot({ snapshotDir, tasksDir: tasks })),
      "malformed",
    );
    assert.deepEqual(readAll(tasks), before);
    assert.equal((yield* sql`SELECT * FROM projection_saved_items`).length, 1);
  }).pipe(Effect.provide(Sqlite.layerMemory)),
);

it.effect("rejects a tampered card or saved items file before changing anything", () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const { tasks, snapshotDir } = yield* makeSnapshot(sql);
    const before = readAll(tasks);
    NodeFS.appendFileSync(NodePath.join(snapshotDir, "cards", "one.md"), "tampered");
    assert.equal(
      yield* failureReason(Snapshot.restoreSnapshot({ snapshotDir, tasksDir: tasks })),
      "mismatch",
    );
    const other = yield* makeSnapshot(sql, "b");
    NodeFS.appendFileSync(NodePath.join(other.snapshotDir, "saved-items.json"), " ");
    assert.equal(
      yield* failureReason(
        Snapshot.restoreSnapshot({ snapshotDir: other.snapshotDir, tasksDir: tasks }),
      ),
      "mismatch",
    );
    assert.deepEqual(readAll(tasks), before);
  }).pipe(Effect.provide(Sqlite.layerMemory)),
);

it.effect("rejects a snapshot from a newer schema or format", () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const { tasks, snapshotDir } = yield* makeSnapshot(sql);
    const file = NodePath.join(snapshotDir, "manifest.json");
    const manifest = JSON.parse(NodeFS.readFileSync(file, "utf8"));
    NodeFS.writeFileSync(file, JSON.stringify({ ...manifest, schemaVersion: 9999 }));
    assert.equal(
      yield* failureReason(Snapshot.restoreSnapshot({ snapshotDir, tasksDir: tasks })),
      "unsupported",
    );
    NodeFS.writeFileSync(file, JSON.stringify({ ...manifest, formatVersion: 2 }));
    assert.equal(
      yield* failureReason(Snapshot.restoreSnapshot({ snapshotDir, tasksDir: tasks })),
      "unsupported",
    );
  }).pipe(Effect.provide(Sqlite.layerMemory)),
);

it.effect("an interrupted restore (database write fails) keeps old cards and rows", () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const { tasks, snapshotDir } = yield* makeSnapshot(sql);
    NodeFS.writeFileSync(NodePath.join(tasks, "newer.md"), "created after the snapshot\n");
    yield* seedItem(sql, "later");
    const cardsBefore = readAll(tasks);
    yield* sql`CREATE TRIGGER fail_restore BEFORE INSERT ON projection_saved_items BEGIN SELECT RAISE(ABORT, 'test failure'); END`;
    assert.equal(
      (yield* Effect.result(Snapshot.restoreSnapshot({ snapshotDir, tasksDir: tasks })))._tag,
      "Failure",
    );
    yield* sql`DROP TRIGGER fail_restore`;
    assert.deepEqual(readAll(tasks), cardsBefore);
    assert.equal((yield* sql`SELECT * FROM projection_saved_items`).length, 2);
    assert.deepEqual(
      NodeFS.readdirSync(NodePath.dirname(tasks)).filter((n) =>
        n.startsWith(`${NodePath.basename(tasks)}.`),
      ),
      [],
    );
  }).pipe(Effect.provide(Sqlite.layerMemory)),
);

it.effect("restore replaces newer state with the snapshot state", () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const { tasks, snapshotDir } = yield* makeSnapshot(sql);
    const snapshotCards = readAll(tasks);
    NodeFS.writeFileSync(NodePath.join(tasks, "newer.md"), "created after the snapshot\n");
    yield* seedItem(sql, "later");
    yield* Snapshot.restoreSnapshot({ snapshotDir, tasksDir: tasks });
    assert.deepEqual(readAll(tasks), snapshotCards);
    assert.deepEqual(
      (yield* sql<{ item_id: string }>`SELECT item_id FROM projection_saved_items`).map(
        (r) => r.item_id,
      ),
      ["a"],
    );
  }).pipe(Effect.provide(Sqlite.layerMemory)),
);
