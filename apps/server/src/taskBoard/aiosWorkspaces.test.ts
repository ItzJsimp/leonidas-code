// @effect-diagnostics nodeBuiltinImport:off - synchronous node and global APIs are used on purpose in this file.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { isInsideRoot } from "./aiosCards.ts";
import {
  listAiosWorkspaces,
  readWorkspaceFile,
  resolveWorkspaceRoot,
  workspaceForPath,
  writeWorkspaceFile,
} from "./aiosWorkspaces.ts";

let temp: string;
const makeAios = (name: string, file?: unknown) => {
  const root = NodePath.join(temp, name);
  NodeFS.mkdirSync(NodePath.join(root, "tasks"), { recursive: true });
  NodeFS.mkdirSync(NodePath.join(root, "projects"), { recursive: true });
  if (file !== undefined) {
    NodeFS.writeFileSync(
      NodePath.join(root, "workspace.json"),
      typeof file === "string" ? file : JSON.stringify(file),
    );
  }
  return root;
};

beforeEach(() => {
  // A space in the path, like "D:\SimplyGersi AIOS".
  temp = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "aios workspaces-"));
});
afterEach(() => NodeFS.rmSync(temp, { recursive: true, force: true }));

describe("readWorkspaceFile", () => {
  it("reads a valid file", () => {
    const root = makeAios("SG AIOS", {
      id: "simplygersi",
      name: "SimplyGersi",
      type: "business",
      schemaVersion: 1,
    });
    expect(readWorkspaceFile(root)).toEqual({
      status: "ready",
      root,
      file: { id: "simplygersi", name: "SimplyGersi", type: "business", schemaVersion: 1 },
    });
  });

  it("reports a missing file", () => {
    const root = makeAios("bare");
    expect(readWorkspaceFile(root)).toEqual({ status: "missing", root });
  });

  it.each([
    ["not json", "{ id:"],
    ["bad type", { id: "x", name: "X", type: "team", schemaVersion: 1 }],
    ["bad id", { id: "Has Space", name: "X", type: "personal", schemaVersion: 1 }],
    ["no name", { id: "x", name: " ", type: "personal", schemaVersion: 1 }],
    ["future schema", { id: "x", name: "X", type: "personal", schemaVersion: 2 }],
  ])("reports an invalid file: %s", (_label, file) => {
    const root = makeAios("bad", file);
    const state = readWorkspaceFile(root);
    expect(state.status).toBe("invalid");
  });

  it("accepts a UTF-8 BOM and CRLF line endings", () => {
    const root = makeAios(
      "bom",
      '\uFEFF{\r\n"id": "leonidas",\r\n"name": "Leonidas",\r\n"type": "personal",\r\n"schemaVersion": 1\r\n}\r\n',
    );
    expect(readWorkspaceFile(root).status).toBe("ready");
  });
});

describe("listAiosWorkspaces and resolveWorkspaceRoot", () => {
  it("finds each AIOS once from roots and project folders, in hint order", () => {
    const a = makeAios("A", { id: "a", name: "A", type: "personal", schemaVersion: 1 });
    const b = makeAios("B", { id: "b", name: "B", type: "business", schemaVersion: 1 });
    const projectInA = NodePath.join(a, "projects", "app");
    NodeFS.mkdirSync(projectInA, { recursive: true });
    const list = listAiosWorkspaces([undefined, a, projectInA, b, "", b]);
    expect(list.map((workspace) => workspace.root)).toEqual([a, b]);
  });

  it("resolves an id only to its own root and never falls back to another", () => {
    const a = makeAios("A", { id: "a", name: "A", type: "personal", schemaVersion: 1 });
    const b = makeAios("B", { id: "b", name: "B", type: "business", schemaVersion: 1 });
    const list = listAiosWorkspaces([a, b]);
    expect(resolveWorkspaceRoot(list, "b")).toBe(b);
    expect(resolveWorkspaceRoot(list, "missing-id")).toBeNull();
    // No id: the first ready workspace, so a single-AIOS install keeps working.
    expect(resolveWorkspaceRoot(list, undefined)).toBe(a);
  });

  it("falls back to the first root when no workspace is set up yet", () => {
    const bare = makeAios("bare");
    expect(resolveWorkspaceRoot(listAiosWorkspaces([bare]), null)).toBe(bare);
    expect(resolveWorkspaceRoot(listAiosWorkspaces([bare]), "any")).toBeNull();
  });
});

describe("workspaceForPath", () => {
  it("maps a project folder to the workspace that holds it", () => {
    const a = makeAios("A", { id: "a", name: "A", type: "personal", schemaVersion: 1 });
    const b = makeAios("A-b", { id: "b", name: "B", type: "business", schemaVersion: 1 });
    const project = NodePath.join(b, "projects", "app");
    NodeFS.mkdirSync(project, { recursive: true });
    const list = listAiosWorkspaces([a, b]);
    expect(workspaceForPath(list, project)?.root).toBe(b);
    expect(workspaceForPath(list, a)?.root).toBe(a);
    expect(workspaceForPath(list, temp)).toBeUndefined();
  });
});

describe("writeWorkspaceFile", () => {
  it("writes a file that reads back as ready, and refuses a bad id", () => {
    const root = makeAios("new");
    const written = writeWorkspaceFile(root, { id: "sg", name: "SG", type: "business" });
    expect(written).toEqual({
      status: "ready",
      root,
      file: { id: "sg", name: "SG", type: "business", schemaVersion: 1 },
    });
    expect(readWorkspaceFile(root)).toEqual(written);
    expect(() => writeWorkspaceFile(root, { id: "../x", name: "X", type: "personal" })).toThrow();
  });
});

describe("isInsideRoot", () => {
  it("allows the root and its children and rejects siblings and prefixes", () => {
    const root = makeAios("A");
    const real = NodeFS.realpathSync.native(root);
    expect(isInsideRoot(real, real)).toBe(true);
    expect(isInsideRoot(real, NodePath.join(real, "tasks", "x.md"))).toBe(true);
    expect(isInsideRoot(real, `${real}-other`)).toBe(false);
    expect(isInsideRoot(real, NodePath.dirname(real))).toBe(false);
  });
});
