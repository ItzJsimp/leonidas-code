// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";

import { toSafeThreadAttachmentSegment } from "../attachmentStore.ts";
import * as ServerConfig from "../config.ts";
import * as SqlitePersistence from "../persistence/Sqlite.ts";
import * as AttachmentArchive from "./AttachmentArchive.ts";
import {
  indexAfterCursor,
  kindOfExtension,
  parseStoredName,
  sortNewestFirst,
  type DiskFile,
} from "./attachmentArchive.logic.ts";

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const layerTest = AttachmentArchive.layer.pipe(
  Layer.provideMerge(ServerConfig.layerTest(process.cwd(), { prefix: "t3-archive-" })),
  Layer.provideMerge(SqlitePersistence.layerMemory),
  Layer.provideMerge(NodeServices.layer),
);

it.effect(
  "lists files newest first with chat and name, pages by cursor, and keeps files in use",
  () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const config = yield* ServerConfig.ServerConfig;
      const segment = toSafeThreadAttachmentSegment("thread-1")!;
      const shot = `${segment}-${UUID(1)}`;
      const doc = `${segment}-${UUID(2)}-pdf`;
      const pending = `pending-${UUID(3)}-txt`;
      const write = (name: string, body: string, ageSeconds: number) => {
        const path = NodePath.join(config.attachmentsDir, name);
        NodeFS.writeFileSync(path, body);
        const time = new Date(Date.now() - ageSeconds * 1000);
        NodeFS.utimesSync(path, time, time);
      };
      write(`${shot}.png`, "png", 30);
      write(`${doc}.pdf`, "pdf-bytes", 20);
      write(`${pending}.txt`, "note", 10);
      write(`${segment}-${UUID(4)}.part`, "half", 5);
      yield* sql`
      INSERT INTO orchestration_v2_projection_threads
        (thread_id, project_id, title, default_provider, runtime_mode, interaction_mode, created_at, updated_at, payload_json)
      VALUES ('thread-1', 'p', 'Plan the trip', 'claude', 'full-access', 'default', 'x', 'x', '{}')
    `;
      yield* sql`
      INSERT INTO orchestration_v2_projection_messages
        (message_id, thread_id, role, streaming, created_at, updated_at, payload_json)
      VALUES ('m1', 'thread-1', 'user', 0, 'x', 'x', ${JSON.stringify({
        attachments: [
          { type: "image", id: shot, name: "map.png", mimeType: "image/png", sizeBytes: 3 },
          { type: "file", id: doc, name: "tickets.pdf", mimeType: "application/pdf", sizeBytes: 9 },
        ],
      })})
    `;
      const archive = yield* AttachmentArchive.AttachmentArchive;

      const all = yield* archive.list({ tab: "all", limit: 2 });
      expect(all.counts).toEqual({ all: 3, images: 1, documents: 2 });
      expect(all.files.map((file) => file.name)).toEqual(["File.txt", "tickets.pdf"]);
      expect(all.files[0]?.thread).toBeNull();
      expect(all.files[1]?.thread?.title).toBe("Plan the trip");
      expect(all.nextCursor).not.toBeNull();
      const next = yield* archive.list({ tab: "all", limit: 2, cursor: all.nextCursor! });
      expect(next.files.map((file) => [file.name, file.kind])).toEqual([["map.png", "image"]]);
      expect(next.nextCursor).toBeNull();

      const images = yield* archive.list({ tab: "images" });
      expect(images.files.map((file) => file.name)).toEqual(["map.png"]);
      const found = yield* archive.list({ tab: "all", query: "trip" });
      expect(found.files.map((file) => file.name)).toEqual(["tickets.pdf", "map.png"]);
      const byName = yield* archive.list({ tab: "documents", query: "TICKETS" });
      expect(byName.files.map((file) => file.id)).toEqual([doc]);

      const refused = yield* Effect.flip(archive.remove({ attachmentId: shot }));
      expect(refused.reason).toBe("in_use");
      expect(NodeFS.existsSync(NodePath.join(config.attachmentsDir, `${shot}.png`))).toBe(true);
      const missing = yield* Effect.flip(archive.remove({ attachmentId: `${segment}-${UUID(9)}` }));
      expect(missing.reason).toBe("not_found");
      yield* archive.remove({ attachmentId: pending });
      expect(NodeFS.existsSync(NodePath.join(config.attachmentsDir, `${pending}.txt`))).toBe(false);
      const after = yield* archive.list({ tab: "all" });
      expect(after.counts.all).toBe(2);
    }).pipe(Effect.provide(layerTest)),
);

it("reads the kind and id from a stored name and pages with a stable cursor", () => {
  expect(kindOfExtension("PNG")).toBe("image");
  expect(kindOfExtension("pdf")).toBe("pdf");
  expect(kindOfExtension("md")).toBe("text");
  expect(kindOfExtension("zip")).toBe("other");
  expect(parseStoredName("a-b.part")).toBeNull();
  expect(parseStoredName("not-an-id.png")).toBeNull();
  const file = (id: string, createdMs: number): DiskFile => ({
    id,
    extension: "png",
    kind: "image",
    sizeBytes: 1,
    createdMs,
    segment: "s",
  });
  const sorted = sortNewestFirst([file("b", 5), file("a", 5), file("c", 9)]);
  expect(sorted.map((f) => f.id)).toEqual(["c", "a", "b"]);
  expect(indexAfterCursor(sorted, "5:a")).toBe(2);
  expect(indexAfterCursor(sorted, "1:z")).toBe(3);
  expect(indexAfterCursor(sorted, undefined)).toBe(0);
});
