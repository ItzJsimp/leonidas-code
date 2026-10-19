// @effect-diagnostics nodeBuiltinImport:off - temp AIOS roots are plain Node fixtures.
import { expect, it } from "@effect/vitest";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { systemCarePaths } from "./systemCareWorkspace.ts";

it("keeps notes and agent context separate, and refuses an unknown workspace", () => {
  const temp = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "pc workspace-"));
  try {
    const roots = ["personal", "business"].map((id) => {
      const root = NodePath.join(temp, id);
      NodeFS.mkdirSync(root);
      NodeFS.mkdirSync(NodePath.join(root, "tasks"));
      NodeFS.writeFileSync(
        NodePath.join(root, "workspace.json"),
        JSON.stringify({ id, name: id, type: id, schemaVersion: 1 }),
      );
      return root;
    });
    expect(systemCarePaths(temp, roots, "business")).toEqual({
      root: NodePath.join(temp, "system-care", "workspaces", "business"),
      notesDir: NodePath.join(roots[1]!, "domains", "pc"),
    });
    expect(systemCarePaths(temp, roots)?.notesDir).toBe(NodePath.join(roots[0]!, "domains", "pc"));
    expect(systemCarePaths(temp, roots, "missing")).toBeNull();
    expect(systemCarePaths(temp, [], undefined)?.notesDir).toBe(
      NodePath.join(temp, "system-care", "notes"),
    );
  } finally {
    NodeFS.rmSync(temp, { recursive: true, force: true });
  }
});
