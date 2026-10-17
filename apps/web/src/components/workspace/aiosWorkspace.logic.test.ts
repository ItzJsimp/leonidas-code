import type { AiosWorkspaceSummary, EnvironmentId, ProjectId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  pickActiveWorkspace,
  scopeToWorkspace,
  suggestWorkspaceId,
  workspaceFolderName,
  workspaceScopeInput,
} from "./aiosWorkspace.logic";

const env = "env-local" as EnvironmentId;
const remote = "env-remote" as EnvironmentId;
const pid = (id: string) => id as ProjectId;

const summary = (patch: Partial<AiosWorkspaceSummary>): AiosWorkspaceSummary => ({
  root: "D:/x",
  status: "ready",
  id: "x",
  name: "X",
  type: "personal",
  error: null,
  isDefault: false,
  projectIds: [],
  ...patch,
});

const leonidas = summary({
  root: "D:/Leonidas AIOS",
  id: "leonidas",
  isDefault: true,
  projectIds: [pid("p-code")],
});
const simplygersi = summary({
  root: "D:/SimplyGersi AIOS",
  id: "simplygersi",
  type: "business",
  projectIds: [pid("p-sg")],
});
const bare = summary({ root: "D:/Bare", status: "missing", id: null, projectIds: [pid("p-bare")] });

describe("pickActiveWorkspace", () => {
  it("keeps a stored ready id, else the default, and never a workspace without a file", () => {
    const list = [leonidas, simplygersi, bare];
    expect(pickActiveWorkspace(list, "simplygersi")?.id).toBe("simplygersi");
    expect(pickActiveWorkspace(list, "gone")?.id).toBe("leonidas");
    expect(pickActiveWorkspace(list, undefined)?.id).toBe("leonidas");
    expect(pickActiveWorkspace([bare], undefined)).toBeUndefined();
    expect(pickActiveWorkspace([simplygersi], undefined)?.id).toBe("simplygersi");
  });
});

describe("workspaceScopeInput", () => {
  it("omits the field when no workspace is active", () => {
    expect(workspaceScopeInput(undefined)).toEqual({});
    expect(workspaceScopeInput("simplygersi")).toEqual({ workspaceId: "simplygersi" });
  });
});

describe("scopeToWorkspace", () => {
  const projects = [
    { environmentId: env, id: pid("p-code") },
    { environmentId: env, id: pid("p-sg") },
    { environmentId: env, id: pid("p-loose") },
    { environmentId: remote, id: pid("p-remote") },
  ];
  const threads = [
    { environmentId: env, projectId: pid("p-code"), id: "t1" },
    { environmentId: env, projectId: pid("p-sg"), id: "t2" },
    { environmentId: env, projectId: pid("p-loose"), id: "t3" },
  ];
  const workspaces = [leonidas, simplygersi, bare];

  it("shows only SimplyGersi projects and threads in the SimplyGersi workspace", () => {
    const scoped = scopeToWorkspace({
      environmentId: env,
      workspaces,
      active: simplygersi,
      projects,
      threads,
    });
    expect(scoped.projects.map((project) => project.id)).toEqual(["p-sg", "p-remote"]);
    expect(scoped.threads.map((thread) => thread.id)).toEqual(["t2"]);
  });

  it("gives the default workspace its projects plus projects in no workspace", () => {
    const scoped = scopeToWorkspace({
      environmentId: env,
      workspaces,
      active: leonidas,
      projects,
      threads,
    });
    expect(scoped.projects.map((project) => project.id)).toEqual(["p-code", "p-loose", "p-remote"]);
    expect(scoped.threads.map((thread) => thread.id)).toEqual(["t1", "t3"]);
  });

  it("returns the same arrays when nothing is filtered or no workspace is active", () => {
    const none = scopeToWorkspace({
      environmentId: env,
      workspaces,
      active: undefined,
      projects,
      threads,
    });
    expect(none.projects).toBe(projects);
    expect(none.threads).toBe(threads);
  });
});

describe("setup prompt helpers", () => {
  it("suggests an id from the folder name", () => {
    expect(suggestWorkspaceId("SimplyGersi AIOS")).toBe("simplygersi");
    expect(suggestWorkspaceId("Leonidas AIOS")).toBe("leonidas");
    expect(suggestWorkspaceId("  !!  ")).toBe("workspace");
    expect(workspaceFolderName("C:\\Users\\G\\Documents\\SimplyGersi AIOS\\")).toBe(
      "SimplyGersi AIOS",
    );
  });
});
