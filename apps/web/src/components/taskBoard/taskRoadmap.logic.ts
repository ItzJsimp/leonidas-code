import type { TaskBoardTask } from "@t3tools/contracts";

export type RoadmapPlan = {
  readonly projectSlug: string;
  readonly name: string;
  readonly currentVersion: string;
  readonly targetVersion: string;
  readonly releaseDefinition: string;
  readonly milestones: ReadonlyArray<{
    readonly version: string;
    readonly title: string;
    readonly goal: string;
    readonly tasks: ReadonlyArray<{
      readonly key: string;
      readonly title: string;
      readonly description: string;
      readonly priority?: string | undefined;
    }>;
  }>;
};
type RoadmapTask = Pick<TaskBoardTask, "id" | "title" | "description" | "status"> & {
  readonly section: string;
  readonly milestone?: string | null | undefined;
};

export function compareVersions(left: string, right: string): number {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function taskKey(task: RoadmapTask): string | null {
  return /^Roadmap key: (.+?)\s*$/m.exec(task.description)?.[1] ?? null;
}

/** Missing briefs are matched by durable key, so renaming or moving a task does not reimport it. */
export function missingRoadmapTasks(plan: RoadmapPlan, tasks: ReadonlyArray<RoadmapTask>) {
  const existing = new Set(tasks.filter((task) => task.section === plan.projectSlug).map(taskKey));
  return plan.milestones.flatMap((stage) =>
    stage.tasks
      .filter((task) => !existing.has(task.key))
      .map((task) => ({
        ...task,
        milestone: stage.version,
        description: `${task.description.replace(/^Roadmap key:.*(?:\r?\n|$)/gm, "").trim()}\n\nRoadmap key: ${task.key}`,
      })),
  );
}

/** Includes custom milestone assignments, closed work and empty gates; never declares an empty gate complete. */
export function buildRoadmap<T extends RoadmapTask>(plan: RoadmapPlan, tasks: ReadonlyArray<T>) {
  const scoped = tasks.filter((task) => task.section === plan.projectSlug);
  const missing = missingRoadmapTasks(plan, scoped);
  const versions = new Set([
    ...plan.milestones.map((stage) => stage.version),
    plan.targetVersion,
    ...scoped.flatMap((task) => (task.milestone ? [task.milestone] : [])),
  ]);
  return [...versions].sort(compareVersions).map((version) => {
    const stage = plan.milestones.find((item) => item.version === version);
    const assigned = scoped.filter((task) => task.milestone === version);
    const uncreated = missing.filter((task) => task.milestone === version);
    const done = assigned.filter((task) => task.status === "done").length;
    const total = assigned.length + uncreated.length;
    return {
      version,
      title: stage?.title ?? "Additional update",
      goal: stage?.goal ?? "Project work assigned to this version.",
      tasks: assigned,
      missing: uncreated,
      done,
      total,
      complete: total > 0 && done === total,
    };
  });
}
