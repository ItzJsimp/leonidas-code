import type { ProjectId, TaskBoardTask, TaskBoardWorkspaceProject } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { mergeTasks, type TaskView } from "./taskBoard.logic";
import {
  activeFilterCount,
  buildRailEntries,
  DEFAULT_TASKS_PREFS,
  parseTasksPrefs,
  placeSharedOnlyIn,
  sectionShareState,
  tasksInSection,
  toTaskFilters,
} from "./tasksPage.logic";

const PROJECT_ID = "project-1" as ProjectId;

function task(id: string, overrides: Partial<TaskBoardTask> = {}): TaskBoardTask {
  return {
    id,
    project: "Leonidas Code",
    title: `Task ${id}`,
    description: "",
    status: "todo",
    priority: "medium",
    claimedBy: null,
    claimedAt: null,
    claimedAgent: null,
    completedBy: null,
    completedAt: null,
    completionSummary: null,
    createdAt: 0,
    updatedAt: 0,
    labels: [],
    source: "aios_card",
    sourceId: id,
    sourceFile: `${id}.md`,
    issueUrl: null,
    history: [],
    projectSlug: "leonidas-code",
    ...overrides,
  };
}

function project(
  slug: string,
  overrides: Partial<TaskBoardWorkspaceProject> = {},
): TaskBoardWorkspaceProject {
  return {
    slug,
    name: slug,
    projectId: null,
    repository: null,
    total: 0,
    open: 0,
    ...overrides,
  };
}

describe("parseTasksPrefs", () => {
  it("falls back to defaults for missing or malformed input", () => {
    expect(parseTasksPrefs(null)).toEqual(DEFAULT_TASKS_PREFS);
    expect(parseTasksPrefs("{not json")).toEqual(DEFAULT_TASKS_PREFS);
    expect(parseTasksPrefs("42")).toEqual(DEFAULT_TASKS_PREFS);
  });

  it("keeps valid values and drops unknown ones", () => {
    const prefs = parseTasksPrefs(
      JSON.stringify({
        view: "board",
        section: "leonidas-code",
        statuses: ["todo", "bogus"],
        priorities: ["bogus"],
        mine: true,
        sort: "nonsense",
        groupBy: "status",
      }),
    );
    expect(prefs.view).toBe("board");
    expect(prefs.section).toBe("leonidas-code");
    expect(prefs.statuses).toEqual(["todo"]);
    expect(prefs.priorities).toBeNull();
    expect(prefs.mine).toBe(true);
    expect(prefs.sort).toBe("priority");
    expect(prefs.groupBy).toBe("status");
  });
});

describe("toTaskFilters", () => {
  it("never hides closed work on the board", () => {
    expect(toTaskFilters({ ...DEFAULT_TASKS_PREFS, view: "board" }, "").includeClosed).toBe(true);
    expect(toTaskFilters({ ...DEFAULT_TASKS_PREFS, view: "list" }, "").includeClosed).toBe(false);
  });

  it("counts only the filters that narrow the list", () => {
    expect(activeFilterCount(DEFAULT_TASKS_PREFS, "  ")).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_TASKS_PREFS, mine: true, statuses: ["todo"] }, "x")).toBe(
      3,
    );
  });
});

describe("buildRailEntries", () => {
  const projects = [
    project("leonidas-code", { projectId: PROJECT_ID, repository: "a/b" }),
    project("empty-aios-only"),
    project("linked-but-empty", { projectId: "project-2" as ProjectId }),
  ];

  it("lists projects with tasks or a Leonidas project, and No project only when used", () => {
    const tasks = mergeTasks([task("a"), task("b", { status: "done" })], []);
    const entries = buildRailEntries(tasks, projects);
    expect(entries.map((entry) => entry.slug)).toEqual(["leonidas-code", "linked-but-empty"]);
    expect(entries[0]).toMatchObject({ open: 1, total: 2 });

    const withLoose = mergeTasks([task("c", { projectSlug: null, project: "General" })], []);
    expect(buildRailEntries(withLoose, projects).at(-1)?.slug).toBe("general");
  });
});

describe("sectionShareState", () => {
  const entry = (overrides: Partial<ReturnType<typeof buildRailEntries>[number]> = {}) => ({
    slug: "leonidas-code",
    name: "Leonidas Code",
    projectId: PROJECT_ID,
    repository: "a/b",
    open: 0,
    total: 0,
    ...overrides,
  });

  it("offers sharing for unshared open cards, then notes they are shared", () => {
    const local = mergeTasks([task("a"), task("b")], []);
    expect(sectionShareState(entry(), local)).toEqual({ kind: "share", count: 2 });
    const shared = mergeTasks([task("a")], [task("a", { shared: true })]);
    expect(sectionShareState(entry(), shared)).toEqual({ kind: "shared" });
  });

  it("explains why sharing is unavailable", () => {
    const tasks: TaskView[] = [];
    expect(sectionShareState(entry({ repository: null }), tasks).kind).toBe("unavailable");
    expect(sectionShareState(entry({ projectId: null }), tasks).kind).toBe("unavailable");
    expect(sectionShareState(entry({ slug: "general" }), tasks).kind).toBe("hidden");
    expect(sectionShareState(null, tasks).kind).toBe("hidden");
  });
});

describe("section helpers", () => {
  it("scopes tasks and places shared-only cards in the fetched project's section", () => {
    const merged = mergeTasks(
      [task("a")],
      [task("z", { source: "board", sourceId: null, projectSlug: null, project: "Other Name" })],
    );
    expect(tasksInSection(merged, null)).toHaveLength(2);
    const placed = placeSharedOnlyIn(merged, "leonidas-code");
    expect(tasksInSection(placed, "leonidas-code").map((item) => item.id)).toEqual(["a", "z"]);
  });
});
