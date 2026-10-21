import { decodeFeedEvent, completeFeedEvent } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";

import { aiosChangedDraft } from "./AiosChangeLog.ts";

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
