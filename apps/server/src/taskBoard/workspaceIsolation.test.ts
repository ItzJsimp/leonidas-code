// @effect-diagnostics nodeBuiltinImport:off - synchronous node and global APIs are used on purpose in this file.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { expect, it } from "vite-plus/test";

import { discoverProjects, findCardFile, readAiosTasks } from "./aiosCards.ts";

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

it("does not read or find a card through a file link into another workspace", () => {
  const temp = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "workspace-file-link-"));
  const a = NodePath.join(temp, "a");
  const b = NodePath.join(temp, "b");
  try {
    for (const root of [a, b]) NodeFS.mkdirSync(NodePath.join(root, "tasks"), { recursive: true });
    const target = NodePath.join(b, "tasks", "secret.md");
    NodeFS.writeFileSync(target, `---\ntype: task\nid: task-secret\nname: Secret\n---\n`);
    try {
      NodeFS.symlinkSync(target, NodePath.join(a, "tasks", "secret.md"), "file");
    } catch (error) {
      // Windows file links need a privilege; the folder-link test still covers the guard.
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    expect(readAiosTasks(a, { now: 0 })).toEqual([]);
    expect(findCardFile(a, "secret.md")).toBeNull();
  } finally {
    NodeFS.rmSync(temp, { recursive: true, force: true });
  }
});

it("ignores git link stubs checked out as plain text files (core.symlinks=false)", () => {
  const temp = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "workspace-link-stub-"));
  try {
    NodeFS.mkdirSync(NodePath.join(temp, "tasks"), { recursive: true });
    NodeFS.mkdirSync(NodePath.join(temp, "projects", "app", "tasks"), { recursive: true });
    NodeFS.writeFileSync(
      NodePath.join(temp, "tasks", "real.md"),
      `---\ntype: task\nid: task-real\nname: Real\n---\n`,
    );
    // What Windows git writes for a link when symlinks are off: the target path as text.
    NodeFS.writeFileSync(
      NodePath.join(temp, "projects", "app", "tasks", "real.md"),
      "../../../tasks/real.md",
    );
    NodeFS.writeFileSync(NodePath.join(temp, "projects", "stub"), "../../Other AIOS/projects/x");
    expect(readAiosTasks(temp, { now: 0 }).map((task) => task.id)).toEqual(["task-real"]);
    expect(discoverProjects(temp).map((project) => project.slug)).toEqual(["app"]);
  } finally {
    NodeFS.rmSync(temp, { recursive: true, force: true });
  }
});
