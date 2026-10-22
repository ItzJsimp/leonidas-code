// @effect-diagnostics nodeBuiltinImport:off - tests the portable installer against temporary folders.
import { describe, expect, it } from "vite-plus/test";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { syncOutputStandard } from "./sync-output-standard.ts";

describe("output standard sync", () => {
  it("preserves identity, catches drift, repairs copies, and accepts CRLF", async () => {
    const temp = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "leonidas output α-"));
    const projectRoot = NodePath.join(temp, "code");
    const aiosRoot = NodePath.join(temp, "aios");
    const otherAiosRoot = NodePath.join(temp, "second owner");
    const overlay = NodePath.join(aiosRoot, ".agents/rules/leonidas-code-overlay.md");
    const skill = ".agents/skills/leonidas-canvas/SKILL.md";
    try {
      await NodeFSP.mkdir(NodePath.join(projectRoot, NodePath.dirname(skill)), { recursive: true });
      await NodeFSP.writeFile(NodePath.join(projectRoot, skill), "Canvas skill");
      await NodeFSP.mkdir(NodePath.dirname(overlay), { recursive: true });
      await NodeFSP.writeFile(overlay, "Personal canary\r\n");
      await NodeFSP.writeFile(NodePath.join(aiosRoot, "AGENTS.md"), "Personal identity\n");
      await NodeFSP.mkdir(otherAiosRoot, { recursive: true });
      await NodeFSP.writeFile(NodePath.join(otherAiosRoot, "CLAUDE.md"), "Personal voice\n");
      const input = { projectRoot, aiosRoots: [aiosRoot, otherAiosRoot] };
      expect(await syncOutputStandard({ ...input, check: true })).toHaveLength(7);
      const backupPrefix = "leonidas-output-standard-";
      const backupsBefore = new Set(
        (await NodeFSP.readdir(NodeOS.tmpdir())).filter((name) => name.startsWith(backupPrefix)),
      );
      expect(await syncOutputStandard(input)).toHaveLength(7);
      const backupsAfter = (await NodeFSP.readdir(NodeOS.tmpdir())).filter(
        (name) => name.startsWith(backupPrefix) && !backupsBefore.has(name),
      );
      let overlayBackupFound = false;
      for (const name of backupsAfter) {
        const backupDir = NodePath.join(NodeOS.tmpdir(), name);
        if (!(await NodeFSP.readdir(backupDir)).includes(NodePath.basename(overlay))) continue;
        if (
          (await NodeFSP.readFile(NodePath.join(backupDir, NodePath.basename(overlay)), "utf8")) ===
          "Personal canary\r\n"
        ) {
          overlayBackupFound = true;
          break;
        }
      }
      expect(overlayBackupFound).toBe(true);
      expect(await syncOutputStandard({ ...input, check: true })).toEqual([]);
      expect(await NodeFSP.readFile(overlay, "utf8")).toContain("Personal canary\r\n");
      expect(await NodeFSP.readFile(NodePath.join(aiosRoot, "AGENTS.md"), "utf8")).toContain(
        "Personal identity\n",
      );
      expect(await NodeFSP.readFile(NodePath.join(otherAiosRoot, "CLAUDE.md"), "utf8")).toContain(
        "@.agents/rules/leonidas-code-overlay.md",
      );
      await NodeFSP.appendFile(NodePath.join(aiosRoot, skill), " drift");
      expect(await syncOutputStandard({ ...input, check: true })).toEqual([
        NodePath.join(aiosRoot, skill),
      ]);
      await syncOutputStandard(input);
      expect(await syncOutputStandard({ ...input, check: true })).toEqual([]);
    } finally {
      await NodeFSP.rm(temp, { recursive: true, force: true });
    }
  });
});
