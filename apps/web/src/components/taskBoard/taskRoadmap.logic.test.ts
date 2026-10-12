import { describe, expect, it } from "vite-plus/test";
import { buildRoadmap, compareVersions, missingRoadmapTasks } from "./taskRoadmap.logic";
import plan from "../../../../../project-roadmap.json";

describe("release roadmap", () => {
  it("adds durable import keys to custom briefs and keeps the target gate visible", () => {
    const custom = {
      ...plan,
      projectSlug: "custom",
      milestones: [
        {
          version: "0.2.0",
          title: "Next",
          goal: "Work",
          tasks: [{ key: "MILESTONE-1", title: "One", description: "Verify a custom project." }],
        },
      ],
    };
    const brief = missingRoadmapTasks(custom, [])[0]!;
    expect(brief.description).toContain("Roadmap key: MILESTONE-1");
    expect(
      missingRoadmapTasks(custom, [{ ...brief, id: "one", section: "custom", status: "todo" }]),
    ).toHaveLength(0);
    expect(buildRoadmap(custom, []).at(-1)?.version).toBe("1.0.0");
  });
  it("orders versions numerically rather than lexically", () => {
    expect(["1.0.0", "0.9.0", "0.22.0"].sort(compareVersions)).toEqual([
      "0.9.0",
      "0.22.0",
      "1.0.0",
    ]);
  });
  it("shows every release gate before tasks are imported", () => {
    const result = buildRoadmap(plan, []);
    expect(result.map((stage) => stage.version)).toEqual(
      plan.milestones.map((stage) => stage.version),
    );
    expect(result[0]?.complete).toBe(false);
    expect(result[0]?.missing).toHaveLength(2);
    expect(missingRoadmapTasks(plan, [])).toHaveLength(20);
  });
  it("does not reimport a task moved to a different milestone", () => {
    const task = {
      id: "one",
      section: "leonidas-code",
      title: "Renamed",
      description: "Roadmap key: daily-task-parity",
      milestone: "0.23.0",
      status: "done" as const,
    };
    const result = buildRoadmap(plan, [task]);
    expect(missingRoadmapTasks(plan, [task])).toHaveLength(19);
    expect(result[0]?.tasks).toHaveLength(0);
    expect(result[1]?.tasks.map((item) => item.id)).toEqual(["one"]);
    expect(result[1]?.done).toBe(1);
    expect(result[1]?.complete).toBe(false);
  });
  it("keeps custom versions and unscheduled work visible without counting parked work as done", () => {
    const tasks = [
      {
        id: "custom",
        section: "leonidas-code",
        title: "Custom",
        description: "",
        milestone: "0.22.1",
        status: "parked" as const,
      },
      {
        id: "unassigned",
        section: "leonidas-code",
        title: "Later",
        description: "",
        milestone: null,
        status: "todo" as const,
      },
      {
        id: "other",
        section: "other",
        title: "Other",
        description: "",
        milestone: "0.22.0",
        status: "done" as const,
      },
    ];
    const custom = buildRoadmap(plan, tasks).find((stage) => stage.version === "0.22.1");
    expect(custom?.done).toBe(0);
    expect(custom?.complete).toBe(false);
    expect(custom?.tasks).toHaveLength(1);
    expect(
      buildRoadmap(plan, tasks)
        .flatMap((stage) => stage.tasks)
        .map((task) => task.id),
    ).toEqual(["custom"]);
  });
});
