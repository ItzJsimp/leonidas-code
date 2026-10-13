// @effect-diagnostics nodeBuiltinImport:off - Exercises real files in a temp folder.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { afterEach, describe, expect, it } from "@effect/vitest";

import { removeDrop, writeDrop } from "./inbox.ts";

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
    expect(removeDrop(root, "../keep")).toBe(false);
    expect(removeDrop(root, id)).toBe(true);
    expect(removeDrop(root, id)).toBe(false);
    expect(NodeFS.existsSync(NodePath.join(root, "keep.md"))).toBe(true);
  });
});
