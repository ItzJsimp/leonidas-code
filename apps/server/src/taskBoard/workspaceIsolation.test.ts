// @effect-diagnostics nodeBuiltinImport:off - synchronous node and global APIs are used on purpose in this file.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { expect, it } from "vite-plus/test";

import { readAiosTasks } from "./aiosCards.ts";

it("does not read workspace B cards through a directory link inside workspace A", () => {
  const temp = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "workspace-isolation-"));
  const workspaceA = NodePath.join(temp, "a");
  const workspaceB = NodePath.join(temp, "b");
  const linkedTasks = NodePath.join(workspaceA, "projects", "linked", "tasks");
  try {
    for (const [root, id] of [
      [workspaceA, "a"],
      [workspaceB, "b"],
    ] as const) {
      NodeFS.mkdirSync(NodePath.join(root, "tasks"), { recursive: true });
      NodeFS.writeFileSync(
        NodePath.join(root, "workspace.json"),
        JSON.stringify({ id, name: id, type: "personal", schemaVersion: 1 }),
      );
      NodeFS.writeFileSync(
        NodePath.join(root, "tasks", `${id}.md`),
        `---\ntype: task\nid: task-${id}\nname: Workspace ${id}\nstatus: Not started\n---\n`,
      );
    }
    NodeFS.mkdirSync(NodePath.dirname(linkedTasks), { recursive: true });
    NodeFS.symlinkSync(NodePath.join(workspaceB, "tasks"), linkedTasks, "junction");

    expect(readAiosTasks(workspaceB, { now: 0 }).map((task) => task.id)).toEqual(["task-b"]);
    expect(readAiosTasks(workspaceA, { now: 0 }).map((task) => task.id)).toEqual(["task-a"]);
  } finally {
    // Remove the link before recursive cleanup so workspace B is never traversed.
    if (NodeFS.existsSync(linkedTasks)) NodeFS.unlinkSync(linkedTasks);
    NodeFS.rmSync(temp, { recursive: true, force: true });
  }
});
