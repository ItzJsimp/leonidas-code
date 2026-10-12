import type { ProjectId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { claimPatch, failureText, pickLaunchProject } from "./useTaskActions.logic";

const project = (id: string, workspaceRoot: string) => ({ id: id as ProjectId, workspaceRoot });

describe("pickLaunchProject", () => {
  const projects = [
    project("a", "C:/Work/a"),
    project("b", "D:\\Leonidas AIOS\\"),
    project("c", "/x"),
  ];

  it("prefers the task's project, then the selected one", () => {
    const base = { projects, aiosRoot: "D:/Leonidas AIOS" };
    expect(
      pickLaunchProject({
        ...base,
        taskProjectId: "c" as ProjectId,
        selectedProjectId: "a" as ProjectId,
      })?.id,
    ).toBe("c");
    expect(
      pickLaunchProject({ ...base, taskProjectId: null, selectedProjectId: "a" as ProjectId })?.id,
    ).toBe("a");
  });

  it("skips projects this environment does not have", () => {
    expect(
      pickLaunchProject({
        projects,
        taskProjectId: "missing" as ProjectId,
        selectedProjectId: "a" as ProjectId,
        aiosRoot: null,
      })?.id,
    ).toBe("a");
  });

  it("falls back to the AIOS root project, then the first project", () => {
    const none = { taskProjectId: null, selectedProjectId: null };
    expect(pickLaunchProject({ ...none, projects, aiosRoot: "d:/leonidas aios" })?.id).toBe("b");
    expect(pickLaunchProject({ ...none, projects, aiosRoot: "E:/elsewhere" })?.id).toBe("a");
    expect(pickLaunchProject({ ...none, projects: [], aiosRoot: null })).toBeNull();
  });
});

describe("claimPatch", () => {
  it("starts work unless the task is already in progress or review", () => {
    expect(claimPatch({ status: "todo" }, "Jake")).toEqual({
      claimedBy: "Jake",
      status: "in_progress",
    });
    expect(claimPatch({ status: "review" }, "Jake")).toEqual({ claimedBy: "Jake" });
    expect(claimPatch({ status: "in_progress" }, "Jake")).toEqual({ claimedBy: "Jake" });
  });
});

describe("failureText", () => {
  it("uses the error message or the fallback", () => {
    expect(failureText(new Error("Nope"), "Failed")).toBe("Nope");
    expect(failureText({ message: "  " }, "Failed")).toBe("Failed");
    expect(failureText(null, "Failed")).toBe("Failed");
  });
});
