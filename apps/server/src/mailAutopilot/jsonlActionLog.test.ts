// @effect-diagnostics nodeBuiltinImport:off - the log is a plain file, tests use a temp folder.
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { assert, describe, it } from "@effect/vitest";
import { serializeEntry, type ActionLogEntry } from "@t3tools/mail-autopilot";

import { makeJsonlActionLog } from "./jsonlActionLog.ts";

const entry = (id: string): ActionLogEntry => ({
  v: 1,
  id,
  ts: "2026-10-21T12:00:00.000Z",
  inbox: "sg",
  messageId: "m1",
  threadId: "t1",
  action: { type: "archive" },
  status: "intent",
});

const tmp = () => NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "mail-log-"));

describe("jsonl action log", () => {
  it("returns nothing when the file does not exist yet", async () => {
    const log = makeJsonlActionLog({ stateDir: await tmp(), inbox: "sg" });
    assert.deepEqual(await log.readAll(), []);
  });

  it("appends one line per entry in a per-inbox file", async () => {
    const dir = await tmp();
    const log = makeJsonlActionLog({ stateDir: dir, inbox: "sg" });
    await log.append(entry("e1"));
    await log.append(entry("e2"));
    assert.deepEqual(
      (await log.readAll()).map((e) => e.id),
      ["e1", "e2"],
    );
    const text = await NodeFSP.readFile(NodePath.join(dir, "mail-autopilot", "sg.jsonl"), "utf8");
    assert.equal(text.split("\n").filter(Boolean).length, 2);
  });

  it("survives a crash mid-line: old entries stay readable and the next entry is not glued on", async () => {
    const dir = await tmp();
    const file = NodePath.join(dir, "mail-autopilot", "sg.jsonl");
    await NodeFSP.mkdir(NodePath.dirname(file), { recursive: true });
    await NodeFSP.writeFile(
      file,
      serializeEntry(entry("e1")) + serializeEntry(entry("e2")).slice(0, 30),
    );
    const log = makeJsonlActionLog({ stateDir: dir, inbox: "sg" });
    await log.append(entry("e3"));
    assert.deepEqual(
      (await log.readAll()).map((e) => e.id),
      ["e1", "e3"],
    );
  });

  it("keeps order when many appends start in the same tick", async () => {
    const log = makeJsonlActionLog({ stateDir: await tmp(), inbox: "sg" });
    await Promise.all(Array.from({ length: 50 }, (_, i) => log.append(entry(`e${i}`))));
    assert.deepEqual(
      (await log.readAll()).map((e) => e.id),
      Array.from({ length: 50 }, (_, i) => `e${i}`),
    );
  });

  it("cannot be pointed outside its folder by the inbox id", async () => {
    const dir = await tmp();
    for (const inbox of ["../evil", "..\\evil", "a/b", "C:\\x", "..", "."]) {
      const log = makeJsonlActionLog({ stateDir: dir, inbox });
      await log.append(entry("e1"));
    }
    const names = await NodeFSP.readdir(NodePath.join(dir, "mail-autopilot"));
    assert.isAbove(names.length, 0);
    for (const n of names) assert.match(n, /^[A-Za-z0-9._@-]+\.jsonl$/);
    assert.deepEqual((await NodeFSP.readdir(dir)).sort(), ["mail-autopilot"]);
    assert.notInclude(names, ".jsonl");
  });

  it("refuses an empty inbox id", () => {
    assert.throws(() => makeJsonlActionLog({ stateDir: "x", inbox: "" }));
  });
});
