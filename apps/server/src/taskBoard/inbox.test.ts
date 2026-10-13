// @effect-diagnostics globalDate:off - tests seed synchronous inbox drops with real timestamps.
// @effect-diagnostics nodeBuiltinImport:off - Exercises real files in a temp folder.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { afterEach, describe, expect, it } from "@effect/vitest";

import { linkDropToTask, removeDrop, writeDrop } from "./inbox.ts";

const roots: string[] = [];
const tempRoot = () => {
  const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "inbox-"));
  roots.push(root);
  return root;
};
afterEach(() => {
  for (const root of roots.splice(0)) NodeFS.rmSync(root, { recursive: true, force: true });
});

describe("inbox drops", () => {
  it("saves raw text with frontmatter and never overwrites a same-second drop", () => {
    const root = tempRoot();
    const now = Date.UTC(2026, 9, 13, 12, 0, 0);
    const a = writeDrop(
      root,
      { text: "Call Mob about hotkey", source: "chat", actor: "Jake" },
      now,
    );
    const b = writeDrop(root, { text: "Call Mob about hotkey", actor: "Jake" }, now);
    expect(b.id).toBe(`${a.id}-2`);
    const raw = NodeFS.readFileSync(NodePath.join(root, "inbox", `${a.id}.md`), "utf8");
    expect(raw).toContain("type: drop");
    expect(raw).toContain('source: "chat"');
    expect(raw.trimEnd().endsWith("Call Mob about hotkey")).toBe(true);
  });

  it("undoes a drop it issued and refuses ids that escape the inbox", () => {
    const root = tempRoot();
    const { id } = writeDrop(root, { text: "idea", actor: "Jake" }, Date.now());
    NodeFS.writeFileSync(NodePath.join(root, "keep.md"), "x");
    expect(removeDrop(root, "../keep").removed).toBe(false);
    expect(removeDrop(root, id).removed).toBe(true);
    expect(removeDrop(root, id).removed).toBe(false);
    expect(NodeFS.existsSync(NodePath.join(root, "keep.md"))).toBe(true);
  });

  it("links a drop to its task card and reports it on undo", () => {
    const root = tempRoot();
    const { id } = writeDrop(
      root,
      { text: "call Mob", suggested: "task", actor: "Jake" },
      Date.now(),
    );
    linkDropToTask(root, id, "task-call-mob.md");
    const raw = NodeFS.readFileSync(NodePath.join(root, "inbox", `${id}.md`), "utf8");
    expect(raw).toContain("status: filed");
    expect(raw).toContain("suggested: task");
    expect(removeDrop(root, id)).toEqual({ removed: true, taskFile: "task-call-mob.md" });
  });
});
