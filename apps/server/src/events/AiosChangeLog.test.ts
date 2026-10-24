// @effect-diagnostics nodeBuiltinImport:off - builds a temp folder with nested Git repos.
import { decodeFeedEvent, completeFeedEvent } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";

import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { aiosChangedDraft, inNestedRepo } from "./AiosChangeLog.ts";

const ROOT = "D:\\Leonidas AIOS";

describe("aiosChangedDraft", () => {
  it("writes one event with every AIOS file of the turn", () => {
    const draft = aiosChangedDraft({
      aiosRoot: ROOT,
      cwd: ROOT,
      threadId: "thr_1",
      runId: "run_1",
      files: ["tasks\\a.md", "decisions/0086-x.md", "tasks/b.md"],
    });
    expect(draft).toMatchObject({
      level: "info",
      type: "aios.changed",
      title: "Leonidas updated 3 files in tasks and decisions",
      target: { files: ["tasks/a.md", "decisions/0086-x.md", "tasks/b.md"], thread: "thr_1" },
      dedupe: "aios.changed:run_1",
    });
    expect(decodeFeedEvent(completeFeedEvent(draft!)).ok).toBe(true);
  });

  it("leaves out the app's own feed, so a read-only turn writes no event", () => {
    const base = { aiosRoot: ROOT, cwd: ROOT, threadId: "thr_1", runId: "run_1" };
    expect(aiosChangedDraft({ ...base, files: ["events/2026-10.jsonl"] })).toBeNull();
    expect(
      aiosChangedDraft({ ...base, files: ["events\\2026-10.jsonl", "tasks/a.md"] })?.target?.files,
    ).toEqual(["tasks/a.md"]);
  });

  it("maps paths from a project folder inside the AIOS", () => {
    const draft = aiosChangedDraft({
      aiosRoot: ROOT,
      cwd: `${ROOT}\\projects\\leonidas-product`,
      threadId: "thr_1",
      runId: "run_1",
      files: ["strategy.md"],
    });
    expect(draft?.title).toBe("Leonidas updated 1 file in projects");
    expect(draft?.target?.files).toEqual(["projects/leonidas-product/strategy.md"]);
  });

  it("skips turns outside the AIOS and turns with no files", () => {
    const base = { aiosRoot: ROOT, threadId: "thr_1", runId: "run_1" };
    expect(aiosChangedDraft({ ...base, cwd: "C:\\code\\app", files: ["a.ts"] })).toBeNull();
    expect(aiosChangedDraft({ ...base, cwd: ROOT, files: [] })).toBeNull();
  });

  it("keeps the title under 80 characters", () => {
    const files = Array.from({ length: 12 }, (_, i) => `folder-with-a-long-name-${i}/x.md`);
    const draft = aiosChangedDraft({ aiosRoot: ROOT, cwd: ROOT, threadId: "t", runId: "r", files });
    expect(draft!.title.length).toBeLessThanOrEqual(80);
  });
});

describe("inNestedRepo", () => {
  it("is true for a code repo inside the AIOS and false for the AIOS itself", () => {
    const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "aios-nested-"));
    NodeFS.mkdirSync(NodePath.join(root, ".git"));
    NodeFS.mkdirSync(NodePath.join(root, "projects", "app", ".git"), { recursive: true });
    NodeFS.mkdirSync(NodePath.join(root, "projects", "notes"), { recursive: true });
    expect(inNestedRepo(root, root)).toBe(false);
    expect(inNestedRepo(root, NodePath.join(root, "projects", "notes"))).toBe(false);
    expect(inNestedRepo(root, NodePath.join(root, "projects", "app"))).toBe(true);
    expect(inNestedRepo(root, NodePath.join(root, "projects", "app", "src"))).toBe(true);
    NodeFS.rmSync(root, { recursive: true, force: true });
  });
});
