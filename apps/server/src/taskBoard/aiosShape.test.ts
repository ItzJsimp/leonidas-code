import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { readAiosShape } from "./aiosShape.ts";

describe("readAiosShape", () => {
  it("returns an empty shape without a root", () => {
    expect(readAiosShape(null).aiosDetected).toBe(false);
  });

  it("counts skills, cards and memory files only", () => {
    const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "aios-shape-"));
    NodeFS.mkdirSync(NodePath.join(root, ".agents/skills/a"), { recursive: true });
    NodeFS.writeFileSync(NodePath.join(root, ".agents/skills/a/SKILL.md"), "x");
    NodeFS.mkdirSync(NodePath.join(root, ".agents/skills/empty"));
    NodeFS.mkdirSync(NodePath.join(root, "tasks"));
    NodeFS.writeFileSync(NodePath.join(root, "tasks/one.md"), "x");
    NodeFS.writeFileSync(NodePath.join(root, "tasks/two.md"), "x");
    NodeFS.mkdirSync(NodePath.join(root, "memory"));
    NodeFS.writeFileSync(NodePath.join(root, "memory/user.md"), "x");
    expect(readAiosShape(root)).toEqual({
      aiosDetected: true,
      skillsCount: 1,
      taskCardsCount: 2,
      memoryFilesPresent: true,
    });
    NodeFS.rmSync(root, { recursive: true, force: true });
  });
});
