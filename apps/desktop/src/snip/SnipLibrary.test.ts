// @effect-diagnostics nodeBuiltinImport:off -- This test builds a temporary snips folder on disk.
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { afterEach, assert, beforeEach, it } from "vite-plus/test";

import { listSnipFiles, resolveSnipPath } from "./SnipLibrary.ts";

let directory: string;

beforeEach(async () => {
  directory = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "leonidas snip test "));
});

afterEach(async () => {
  await NodeFSP.rm(directory, { recursive: true, force: true });
});

async function touch(name: string, modifiedSeconds: number) {
  const file = NodePath.join(directory, name);
  await NodeFSP.writeFile(file, "x");
  await NodeFSP.utimes(file, modifiedSeconds, modifiedSeconds);
}

it("lists PNG snips newest first and caps the list at 12", async () => {
  for (let index = 0; index < 15; index += 1)
    await touch(`snip-${String(index)}.png`, 1000 + index);
  await touch("notes.txt", 5000);
  const list = await listSnipFiles(directory);
  assert.strictEqual(list.length, 12);
  assert.strictEqual(list[0]?.name, "snip-14.png");
  assert.strictEqual(list[0]?.path, NodePath.join(directory, "snip-14.png"));
});

it("returns an empty list when the folder does not exist yet", async () => {
  assert.deepStrictEqual(await listSnipFiles(NodePath.join(directory, "missing")), []);
});

it("accepts a PNG inside the snips folder, including a path with spaces", () => {
  const inside = NodePath.join(directory, "snip-1.png");
  assert.strictEqual(resolveSnipPath(directory, inside), inside);
});

it("rejects paths outside the folder, other file types and traversal", () => {
  assert.strictEqual(
    resolveSnipPath(directory, NodePath.join(directory, "..", "secret.png")),
    null,
  );
  assert.strictEqual(resolveSnipPath(directory, NodePath.join(directory, "snip-1.txt")), null);
  assert.strictEqual(
    resolveSnipPath(directory, `${directory}${NodePath.sep}..${NodePath.sep}x.png`),
    null,
  );
  assert.strictEqual(resolveSnipPath(directory, `${directory}-evil${NodePath.sep}a.png`), null);
  assert.strictEqual(resolveSnipPath(directory, ""), null);
});

it("rejects a nested folder path", () => {
  assert.strictEqual(resolveSnipPath(directory, NodePath.join(directory, "sub", "a.png")), null);
});
