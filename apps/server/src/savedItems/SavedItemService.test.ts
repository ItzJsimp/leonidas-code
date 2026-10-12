import { assert, it } from "@effect/vitest";
import { CommandId, ProjectId, SavedItemId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as SavedItems from "./SavedItemService.ts";

const create = (suffix: string) => ({
  commandId: CommandId.make(`create:${suffix}`),
  id: SavedItemId.make(suffix),
  kind: "prompt" as const,
  title: 'Quotes: "雪"',
  body: "---\r\nHello\n```code```\n",
  tags: ["later"],
  projectId: null,
});
const layer = SavedItems.layer.pipe(Layer.provideMerge(Sqlite.layerMemory));

it.effect("rolls back the event and receipt if projecting a create fails", () =>
  Effect.gen(function* () {
    const service = yield* SavedItems.SavedItemService;
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TRIGGER fail_saved_projection BEFORE INSERT ON projection_saved_items BEGIN SELECT RAISE(ABORT, 'test failure'); END`;
    assert.equal((yield* Effect.result(service.create(create("atomic"))))._tag, "Failure");
    assert.equal((yield* sql`SELECT * FROM saved_item_events`).length, 0);
    assert.equal((yield* sql`SELECT * FROM saved_item_commands`).length, 0);
    yield* sql`DROP TRIGGER fail_saved_projection`;
    assert.equal((yield* service.create(create("atomic"))).id, "atomic");
  }).pipe(Effect.provide(layer)),
);

it.effect("restores the prior status and rejects changed command retries", () =>
  Effect.gen(function* () {
    const service = yield* SavedItems.SavedItemService;
    const item = yield* service.create(create("state"));
    assert.equal(
      (yield* Effect.result(service.create({ ...create("state"), body: "different" })))._tag,
      "Failure",
    );
    yield* service.transition({ id: item.id, commandId: CommandId.make("done"), action: "done" });
    yield* service.transition({
      id: item.id,
      commandId: CommandId.make("archive-done"),
      action: "archive",
    });
    assert.equal(
      (yield* service.transition({
        id: item.id,
        commandId: CommandId.make("restore-done"),
        action: "restore",
      })).status,
      "done",
    );
    assert.equal(
      (yield* service.transition({
        id: item.id,
        commandId: CommandId.make("requeue-done"),
        action: "requeue",
      })).status,
      "queued",
    );
  }).pipe(Effect.provide(layer)),
);

it.effect("persists events and projection atomically and replays command receipts", () =>
  Effect.gen(function* () {
    const service = yield* SavedItems.SavedItemService;
    const sql = yield* SqlClient.SqlClient;
    const item = yield* service.create(create("one"));
    assert.equal(item.status, "queued");
    assert.equal(item.createdBy, "user");
    assert.deepEqual(yield* service.create(create("one")), item);
    assert.equal((yield* service.list({})).items.length, 1);
    assert.equal((yield* sql`SELECT * FROM saved_item_events`).length, 1);
    yield* service.update({ commandId: CommandId.make("update"), id: item.id, body: "changed" });
    const restored = yield* service.transition({
      commandId: CommandId.make("archive"),
      id: item.id,
      action: "archive",
    });
    assert.equal(restored.status, "archived");
    assert.equal((yield* service.list({})).items.length, 0);
    assert.equal((yield* service.list({ status: "archived" })).items.length, 1);
    assert.equal(
      (yield* service.transition({
        commandId: CommandId.make("restore"),
        id: item.id,
        action: "restore",
      })).status,
      "queued",
    );
    yield* service.rebuild;
    assert.equal((yield* service.get(item.id)).body, "changed");
  }).pipe(Effect.provide(layer)),
);

it.effect("filters projects including the no-project bucket and imports portable text", () =>
  Effect.gen(function* () {
    const service = yield* SavedItems.SavedItemService;
    yield* service.create(create("unscoped"));
    yield* service.create({ ...create("scoped"), projectId: ProjectId.make("project") });
    assert.equal((yield* service.list({ projectId: null })).items.length, 1);
    assert.equal((yield* service.list({ projectId: ProjectId.make("project") })).items.length, 1);
    const item = yield* service.importMarkdown({
      commandId: CommandId.make("import"),
      markdown: '---\nleonidas: 1\nkind: note\ntitle: "note"\ntags: []\n---\nbody',
      projectId: null,
    });
    assert.equal(item.kind, "note");
    assert.equal(item.body, "body");
  }).pipe(Effect.provide(layer)),
);

it.effect("rejects missing items, duplicate ids, invalid lifecycle and invalid import", () =>
  Effect.gen(function* () {
    const service = yield* SavedItems.SavedItemService;
    assert.equal((yield* Effect.result(service.get(SavedItemId.make("missing"))))._tag, "Failure");
    const item = yield* service.create(create("one"));
    assert.equal(
      (yield* Effect.result(
        service.create({ ...create("one"), commandId: CommandId.make("other") }),
      ))._tag,
      "Failure",
    );
    assert.equal(
      (yield* Effect.result(
        service.transition({
          commandId: CommandId.make("restore"),
          id: item.id,
          action: "restore",
        }),
      ))._tag,
      "Failure",
    );
    assert.equal(
      (yield* Effect.result(
        service.importMarkdown({
          commandId: CommandId.make("bad"),
          markdown: "plain",
          projectId: null,
        }),
      ))._tag,
      "Failure",
    );
  }).pipe(Effect.provide(layer)),
);
