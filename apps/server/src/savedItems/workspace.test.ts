// @effect-diagnostics nodeBuiltinImport:off - temp folders are plain Node fixtures.
import { assert, it } from "@effect/vitest";
import { CommandId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as Sqlite from "../persistence/Sqlite.ts";
import * as SavedItems from "./SavedItemService.ts";

it.effect("isolates same-named folder prompts and their edits across workspaces", () =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const temp = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "saved workspace 雪-"));
      const roots = ["personal", "business"].map((id) => {
        const root = NodePath.join(temp, id);
        NodeFS.mkdirSync(NodePath.join(root, "prompts"), { recursive: true });
        NodeFS.mkdirSync(NodePath.join(root, "tasks"));
        NodeFS.writeFileSync(
          NodePath.join(root, "workspace.json"),
          JSON.stringify({ id, name: id, type: id, schemaVersion: 1 }),
        );
        NodeFS.writeFileSync(
          NodePath.join(root, "prompts", "same.md"),
          `---\r\ntype: prompt\r\ntitle: ${id}\r\n---\r\n${id}`,
        );
        return root;
      });
      const previous = [process.env.LEONIDAS_AIOS_ROOT, process.env.AIOS_ROOT];
      process.env.LEONIDAS_AIOS_ROOT = roots[0];
      process.env.AIOS_ROOT = roots[1];
      return { temp, roots, previous };
    }),
    ({ roots }) =>
      Effect.gen(function* () {
        const service = yield* SavedItems.SavedItemService;
        const business = yield* service.list({ workspaceId: "business" });
        assert.deepEqual(
          business.items.map((item) => item.body),
          ["business"],
        );
        assert.deepEqual(
          (yield* service.list({})).items.map((item) => item.body),
          ["personal"],
        );
        assert.deepEqual(
          (yield* service.list({ workspaceId: "business" })).items.map((item) => item.id),
          business.items.map((item) => item.id),
        );
        const denied = yield* service
          .update({
            commandId: CommandId.make("foreign-edit"),
            id: business.items[0]!.id,
            workspaceId: "personal",
            body: "foreign",
          })
          .pipe(Effect.flip);
        assert.equal(denied.reason, "not_found");
        assert.equal(
          (yield* service.get(business.items[0]!.id, "personal").pipe(Effect.flip)).reason,
          "not_found",
        );
        assert.equal(
          (yield* service.get(business.items[0]!.id, "missing").pipe(Effect.flip)).reason,
          "not_found",
        );
        const deniedDelete = yield* service
          .transition({
            commandId: CommandId.make("foreign-delete"),
            id: business.items[0]!.id,
            workspaceId: "personal",
            action: "delete",
          })
          .pipe(Effect.flip);
        assert.equal(deniedDelete.reason, "not_found");
        yield* service.update({
          commandId: CommandId.make("edit-business"),
          id: business.items[0]!.id,
          body: "changed",
        });
        assert.ok(
          NodeFS.readFileSync(NodePath.join(roots[1]!, "prompts", "same.md"), "utf8").endsWith(
            "changed\n",
          ),
        );
        assert.ok(
          NodeFS.readFileSync(NodePath.join(roots[0]!, "prompts", "same.md"), "utf8").endsWith(
            "personal",
          ),
        );
        assert.deepEqual((yield* service.list({ workspaceId: "missing" })).items, []);
        yield* service.transition({
          commandId: CommandId.make("delete-business"),
          id: business.items[0]!.id,
          action: "delete",
        });
        assert.equal(NodeFS.existsSync(NodePath.join(roots[1]!, "prompts", "same.md")), false);
        assert.equal((yield* service.list({})).items.length, 1);
      }).pipe(Effect.provide(SavedItems.layer.pipe(Layer.provideMerge(Sqlite.layerMemory)))),
    ({ temp, previous }) =>
      Effect.sync(() => {
        for (const [i, key] of ["LEONIDAS_AIOS_ROOT", "AIOS_ROOT"].entries()) {
          if (previous[i] === undefined) delete process.env[key];
          else process.env[key] = previous[i];
        }
        NodeFS.rmSync(temp, { recursive: true, force: true });
      }),
  ),
);
