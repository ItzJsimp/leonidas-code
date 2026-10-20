import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { auditContext, estimateTokens } from "./context-audit.ts";

describe("context-audit", () => {
  let dir: string;
  beforeEach(() => {
    dir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "ctx audit "));
  });
  afterEach(() => NodeFS.rmSync(dir, { recursive: true, force: true }));

  const write = (name: string, body: string) => {
    const file = NodePath.join(dir, name);
    NodeFS.mkdirSync(NodePath.dirname(file), { recursive: true });
    NodeFS.writeFileSync(file, body);
    return file;
  };

  it("estimates roughly one token per four characters", () => {
    expect(estimateTokens("a".repeat(400))).toBe(100);
    expect(estimateTokens("")).toBe(0);
  });

  it("follows @imports once, counts each file once and totals the chain", () => {
    write("a.md", "x".repeat(400));
    write("b.md", "y".repeat(800));
    const root = write("CLAUDE.md", "@a.md\n@b.md\n@a.md\n");
    const report = auditContext(root);
    expect(report.files.map((f) => NodePath.basename(f.path)).toSorted()).toEqual([
      "CLAUDE.md",
      "a.md",
      "b.md",
    ]);
    expect(report.totalTokens).toBe(report.files.reduce((sum, f) => sum + f.tokens, 0));
    expect(report.files.find((f) => f.path.endsWith("b.md"))?.tokens).toBe(200);
  });

  it("flags files over the budget and missing imports", () => {
    write("big.md", "z".repeat(40_000));
    const root = write("CLAUDE.md", "@big.md\n@gone.md\n");
    const report = auditContext(root, { fileBudgetTokens: 2000 });
    expect(report.overBudget.map((f) => NodePath.basename(f.path))).toEqual(["big.md"]);
    expect(report.missing).toEqual(["gone.md"]);
  });

  it("flags duplicated paragraphs across files", () => {
    const para = "This exact paragraph is repeated in two instruction files for no reason.";
    write("a.md", `${para}\n\nunique a`);
    const root = write("CLAUDE.md", `@a.md\n\n${para}\n\nunique root`);
    const report = auditContext(root);
    expect(report.duplicates).toHaveLength(1);
    expect(report.duplicates[0]?.text).toContain("exact paragraph");
  });

  it("sizes skill descriptions that are loaded every session", () => {
    write("skills/one/SKILL.md", "---\nname: one\ndescription: " + "d".repeat(400) + "\n---\nbody");
    const root = write("CLAUDE.md", "hello");
    const report = auditContext(root, { skillsDir: NodePath.join(dir, "skills") });
    expect(report.skills).toEqual([
      { name: "one", tokens: estimateTokens("one" + "d".repeat(400)) },
    ]);
  });
});
