import type { TaskBoardHomePriority } from "@t3tools/contracts";

export interface PrioritySummary {
  readonly done: number;
  readonly total: number;
  /** 0 to 1. Zero when there is nothing to do, so the ring never gets NaN. */
  readonly fraction: number;
  readonly label: string;
}

/** The numbers behind the Today ring. */
export function prioritySummary(
  priorities: ReadonlyArray<Pick<TaskBoardHomePriority, "done">> | null | undefined,
): PrioritySummary {
  const total = priorities?.length ?? 0;
  const done = priorities?.filter((priority) => priority.done).length ?? 0;
  if (total === 0) return { done, total, fraction: 0, label: "No priorities today" };
  return {
    done,
    total,
    fraction: done / total,
    label: done === total ? `All ${total} done` : `${done} of ${total} done`,
  };
}
