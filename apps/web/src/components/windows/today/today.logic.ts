import type { TaskBoardHomePriority, TaskBoardTask } from "@t3tools/contracts";

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

/** A local change the server has not confirmed or read back yet. */
export interface PriorityOverride {
  readonly done: boolean;
  /** The line as the file holds it now (the server's answer), or the line sent while pending. */
  readonly line: string;
}

export interface PriorityView extends TaskBoardHomePriority {
  readonly key: string;
  /** Null when the box can be ticked; else why it cannot, in one plain sentence. */
  readonly locked: string | null;
}

export const priorityKey = (priority: Pick<TaskBoardHomePriority, "title" | "detail">) =>
  `${priority.title}|${priority.detail}`;

const lineDone = (line: string) => /^\s*- \[x\]/.test(line);

/** The priorities as the user sees them: local ticks on top, and the boxes that cannot change. */
export function priorityViews(
  priorities: ReadonlyArray<TaskBoardHomePriority>,
  overrides: ReadonlyMap<string, PriorityOverride>,
): PriorityView[] {
  return priorities.map((priority) => {
    const key = priorityKey(priority);
    const override = overrides.get(key);
    const line = override?.line ?? priority.line;
    const done = override?.done ?? priority.done;
    const locked =
      line === undefined
        ? "Update Leonidas to tick priorities here."
        : done && priority.taskId !== null && !lineDone(line)
          ? "Done because its task card is done. Reopen the card to change it."
          : null;
    return { ...priority, key, done, ...(line === undefined ? {} : { line }), locked };
  });
}

/** `YYYY-MM-DD` of a moment, in the user's time zone. */
export function localDay(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "Oct 21" for a `YYYY-MM-DD` day. */
export function shortDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, date ?? 1).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** The brief path the app expects for a day. */
export const briefFileFor = (day: string) => `logs/briefings/${day}-briefing.md`;

/** The prompt that asks Leonidas to write today's brief with a priorities checklist. */
export function planTodayPrompt(day: string): string {
  return `Help me plan today, ${day}. Take about 5 minutes.

1. Read my open task cards, my goals in ideal-state/goals.md and yesterday's brief in logs/briefings/ if they exist.
2. Ask me at most 3 short questions about my time and energy today. Give 2 or 3 options for each and mark your pick.
3. Draft ${briefFileFor(day)} with a "- **Priorities Seeded:**" line, then 3 to 5 lines in the form "- [ ] **Short title:** one line of detail". Link a task card when a priority is one.
4. Show me the draft. Write the file only after I say yes.`;
}

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export interface DueRow {
  readonly id: string;
  readonly title: string;
  readonly priority: TaskBoardTask["priority"];
  readonly due: string;
  readonly overdue: boolean;
  readonly status: TaskBoardTask["status"];
  /** The card file, AIOS-relative; null for a card that is not in this AIOS folder. */
  readonly path: string | null;
}

/** Open tasks due today or earlier: oldest due date first, then the most urgent. */
export function dueRows(
  tasks: ReadonlyArray<TaskBoardTask>,
  today: string,
  root: string | null,
): DueRow[] {
  return tasks
    .filter(
      (task): task is TaskBoardTask & { due: string } =>
        typeof task.due === "string" &&
        task.due <= today &&
        task.status !== "done" &&
        task.kind !== "agent_run",
    )
    .toSorted(
      (a, b) =>
        a.due.localeCompare(b.due) ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        a.title.localeCompare(b.title),
    )
    .map((task) => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
      due: task.due,
      overdue: task.due < today,
      status: task.status,
      path: taskCardPath(task, root),
    }));
}

const sameFolder = (a: string, b: string) =>
  a.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase() ===
  b.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();

/** The file of a task card relative to `root`, or null when the card lives in another folder. */
export function taskCardPath(
  task: Pick<TaskBoardTask, "source" | "sourceFile" | "sourceRoot">,
  root: string | null,
): string | null {
  if (task.source !== "aios_card" || !task.sourceFile || root === null) return null;
  return task.sourceRoot === undefined || sameFolder(task.sourceRoot, root)
    ? `tasks/${task.sourceFile}`
    : null;
}
