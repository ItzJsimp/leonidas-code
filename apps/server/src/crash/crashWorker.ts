// @effect-diagnostics nodeBuiltinImport:off
// Child process for CrashDurability.test.ts. The parent kills it by PID at a known point.
// Run with: node --experimental-strip-types crashWorker.ts <mode> <dir>
import * as NodePath from "node:path";
import * as NodeSqlite from "node:sqlite";

import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import { writeFileStringAtomically } from "@t3tools/shared/atomicWrite";

import * as ServerConfig from "../config.ts";
import { storeAttachmentUpload } from "../assets/AttachmentUpload.ts";

setInterval(() => {}, 1000);
const [mode, dir] = process.argv.slice(2) as [string, string];
const say = (line: string) => process.stdout.write(`${line}\n`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function openDb() {
  const db = new NodeSqlite.DatabaseSync(NodePath.join(dir, "state.sqlite"));
  db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
  db.exec("CREATE TABLE IF NOT EXISTS crash_probe (seq INTEGER PRIMARY KEY, body TEXT NOT NULL)");
  return db;
}

if (mode === "stream") {
  // One commit per streamed delta, the way the projection writes a reply.
  const db = openDb();
  const insert = db.prepare("INSERT INTO crash_probe (seq, body) VALUES (?, ?)");
  for (let seq = 1; ; seq += 1) {
    insert.run(seq, `delta-${seq}`);
    say(`ack ${seq}`);
    await sleep(1);
  }
} else if (mode === "transaction") {
  // An update install can cut the process off between BEGIN and COMMIT.
  const db = openDb();
  db.exec("BEGIN");
  const insert = db.prepare("INSERT INTO crash_probe (seq, body) VALUES (?, ?)");
  for (let seq = 1_000_000; seq < 1_000_500; seq += 1) insert.run(seq, "uncommitted");
  say("open");
  await sleep(60_000);
} else if (mode === "settings") {
  const filePath = NodePath.join(dir, "settings.json");
  for (let seq = 1; ; seq += 1) {
    const contents = JSON.stringify({ seq, pad: "x".repeat(40_000) });
    await Effect.runPromise(
      writeFileStringAtomically({ filePath, contents }).pipe(Effect.provide(NodeServices.layer)),
    );
    say(`ack ${seq}`);
  }
} else if (mode === "upload") {
  const config = ServerConfig.layerTest(dir, { prefix: "upload-" });
  const claims = {
    version: 1,
    kind: "attachment-upload",
    type: "image",
    attachmentId: "pending-00000000-0000-4000-8000-000000000001",
    name: "shot.png",
    mimeType: "image/png",
    sizeBytes: 1024,
    expiresAt: Date.now() + 60_000,
  } as const;
  const body = Stream.make(new Uint8Array(512)).pipe(
    Stream.concat(
      Stream.fromEffect(Effect.sync(() => say("half")).pipe(Effect.andThen(Effect.never))),
    ),
  );
  await Effect.runPromise(
    Effect.gen(function* () {
      const cfg = yield* ServerConfig.ServerConfig;
      say(`dir ${cfg.attachmentsDir}`);
      yield* storeAttachmentUpload(claims, body as never);
    }).pipe(Effect.provide(Layer.provideMerge(config, NodeServices.layer))),
  );
}
