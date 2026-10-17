import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { detectAiosCandidates, inspectAiosCandidate } from "./aiosDetect.ts";

let home: string;

const write = (path: string, text: string) => {
  NodeFS.mkdirSync(NodePath.dirname(path), { recursive: true });
  NodeFS.writeFileSync(path, text);
};

const card = (id: string) => `---\nid: ${id}\nstatus: todo\n---\nBody\n`;

beforeEach(() => {
  home = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "aios-detect-"));
});

afterEach(() => {
  NodeFS.rmSync(home, { recursive: true, force: true });
});

describe("inspectAiosCandidate", () => {
  it("rates a folder with tasks, projects and an agent brief as a marker match", () => {
    const root = NodePath.join(home, "My AIOS");
    write(NodePath.join(root, "tasks", "a.md"), card("a"));
    write(NodePath.join(root, "CLAUDE.md"), "# brief");
    NodeFS.mkdirSync(NodePath.join(root, "projects"));
    const found = inspectAiosCandidate(root);
    expect(found?.confidence).toBe("marker");
    expect(found?.cardCount).toBe(1);
    expect(found?.markers).toEqual(["tasks/", "projects/", "CLAUDE.md"]);
  });

  it("falls back to a schema match when only the cards look right", () => {
    const root = NodePath.join(home, "notes");
    write(NodePath.join(root, "tasks", "a.md"), card("a"));
    expect(inspectAiosCandidate(root)?.confidence).toBe("schema");
  });

  it("rejects a tasks folder of plain notes and folders without tasks", () => {
    const root = NodePath.join(home, "notes");
    write(NodePath.join(root, "tasks", "a.md"), "just text");
    expect(inspectAiosCandidate(root)).toBeNull();
    expect(inspectAiosCandidate(NodePath.join(home, "missing"))).toBeNull();
  });
});

describe("detectAiosCandidates", () => {
  it("finds AIOS-named folders under the home and ranks marker matches first", () => {
    const schemaOnly = NodePath.join(home, "Documents", "Old AIOS");
    write(NodePath.join(schemaOnly, "tasks", "a.md"), card("a"));
    write(NodePath.join(schemaOnly, "tasks", "b.md"), card("b"));
    const full = NodePath.join(home, "Jake AIOS");
    write(NodePath.join(full, "tasks", "a.md"), card("a"));
    write(NodePath.join(full, "AGENTS.md"), "# brief");
    NodeFS.mkdirSync(NodePath.join(full, "projects"));
    const roots = detectAiosCandidates([], home).map((candidate) => candidate.root);
    expect(roots).toEqual([full, schemaOnly]);
  });

  it("includes a user-picked folder that has no AIOS in its name", () => {
    const picked = NodePath.join(home, "elsewhere");
    write(NodePath.join(picked, "tasks", "a.md"), card("a"));
    expect(detectAiosCandidates([picked], home).map((candidate) => candidate.root)).toEqual([
      picked,
    ]);
  });
});
