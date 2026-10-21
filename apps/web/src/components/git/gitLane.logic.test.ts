import { describe, expect, it } from "vite-plus/test";

import {
  backToMainGate,
  buildLane,
  mainBranchBanner,
  resolveWordsMode,
  type LaneStatus,
} from "./gitLane.logic";

const clean: LaneStatus = {
  isRepo: true,
  hasPrimaryRemote: true,
  isDefaultRef: true,
  refName: "main",
  hasWorkingTreeChanges: false,
  workingTree: { files: [] },
  hasUpstream: true,
  aheadCount: 0,
  behindCount: 0,
};

const file = (path: string) => ({ path });

describe("buildLane", () => {
  it("counts changed files, unsent commits and unreceived commits", () => {
    const lane = buildLane({
      ...clean,
      hasWorkingTreeChanges: true,
      workingTree: { files: [file("a.ts"), file("b.ts")] },
      aheadCount: 3,
      behindCount: 1,
    });
    expect(lane.steps.map((step) => [step.id, step.count])).toEqual([
      ["working", 2],
      ["saved", 3],
      ["github", 1],
    ]);
  });

  it("shows only steps 1 and 2 plus a Connect GitHub prompt when there is no remote", () => {
    const lane = buildLane({ ...clean, hasPrimaryRemote: false, hasUpstream: false });
    expect(lane.steps.map((step) => step.id)).toEqual(["working", "saved"]);
    expect(lane.connectGitHub).toBe(true);
  });

  it("has no unsent count until a branch tracks the remote", () => {
    const lane = buildLane({ ...clean, hasUpstream: false, aheadCount: 0 });
    expect(lane.steps.find((step) => step.id === "saved")?.count).toBeNull();
  });

  it("gives each step a git term, a plain word and a one-line explainer", () => {
    for (const step of buildLane(clean).steps) {
      expect(step.gitTerm).not.toBe("");
      expect(step.plainTerm).not.toBe("");
      expect(step.explainer).not.toContain("\n");
    }
  });

  it("returns no lane for a folder that is not a Git repository", () => {
    const lane = buildLane({ ...clean, isRepo: false });
    expect(lane.steps).toEqual([]);
    expect(lane.connectGitHub).toBe(false);
  });
});

describe("mainBranchBanner", () => {
  it("is hidden on the default branch", () => {
    expect(mainBranchBanner(clean)).toBeNull();
  });

  it("is hidden for a folder that is not a repository", () => {
    expect(mainBranchBanner({ ...clean, isRepo: false, isDefaultRef: false })).toBeNull();
  });

  it("names the branch the folder is on", () => {
    const banner = mainBranchBanner({ ...clean, isDefaultRef: false, refName: "feat/x" });
    expect(banner?.branch).toBe("feat/x");
  });

  it("handles a detached head", () => {
    const banner = mainBranchBanner({ ...clean, isDefaultRef: false, refName: null });
    expect(banner?.branch).toBeNull();
  });
});

describe("backToMainGate", () => {
  it("allows the switch on a clean folder", () => {
    expect(backToMainGate({ ...clean, isDefaultRef: false, refName: "feat/x" })).toEqual({
      allowed: true,
    });
  });

  it("refuses on a dirty folder with a plain-English reason and the file count", () => {
    const gate = backToMainGate({
      ...clean,
      isDefaultRef: false,
      refName: "feat/x",
      hasWorkingTreeChanges: true,
      workingTree: { files: [file("a.ts"), file("b.ts")] },
    });
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.reason).toMatch(/2 files/);
  });

  it("refuses when the status has not loaded yet", () => {
    expect(backToMainGate(null).allowed).toBe(false);
  });
});

describe("resolveWordsMode", () => {
  it("shows plain words to new and beginner users", () => {
    expect(resolveWordsMode("new", null)).toBe("beginner");
    expect(resolveWordsMode("beginner", null)).toBe("beginner");
  });

  it("shows only git terms to comfortable and builder users", () => {
    expect(resolveWordsMode("comfortable", null)).toBe("advanced");
    expect(resolveWordsMode("builder", null)).toBe("advanced");
  });

  it("lets the switch override the level", () => {
    expect(resolveWordsMode("builder", "beginner")).toBe("beginner");
    expect(resolveWordsMode("new", "advanced")).toBe("advanced");
  });

  it("defaults to beginner words while the level is unknown", () => {
    expect(resolveWordsMode(null, null)).toBe("beginner");
  });
});
