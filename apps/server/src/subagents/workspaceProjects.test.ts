// @effect-diagnostics nodeBuiltinImport:off - temp roots exercise real path boundaries.
import { expect, it } from "@effect/vitest";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { subagentWorkspaceProjects } from "./workspaceProjects.ts";

it("keeps siblings and nested workspaces out of a scoped subagent catalog", () => {
  const temp = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "subagent workspace-"));
  try {
    const business = NodePath.join(temp, "business");
    const personal = NodePath.join(business, "nested");
    for (const [root, id] of [
      [business, "business"],
      [personal, "personal"],
    ] as const) {
      NodeFS.mkdirSync(NodePath.join(root, "tasks"), { recursive: true });
      NodeFS.writeFileSync(
        NodePath.join(root, "workspace.json"),
        JSON.stringify({ id, name: id, type: id, schemaVersion: 1 }),
      );
    }
    const projects = [business, personal, `${business}-other`].map((workspaceRoot) => ({
      workspaceRoot,
    }));
    expect(subagentWorkspaceProjects(projects, business, "business")).toEqual([projects[0]]);
    expect(subagentWorkspaceProjects(projects, personal, "personal")).toEqual([projects[1]]);
    expect(subagentWorkspaceProjects(projects, null, "unknown")).toEqual([]);
    expect(subagentWorkspaceProjects(projects, business)).toBe(projects);
  } finally {
    NodeFS.rmSync(temp, { recursive: true, force: true });
  }
});
