// @effect-diagnostics nodeBuiltinImport:off - reads brief files from the AIOS folder synchronously, like aiosCards.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import type {
  TaskBoardHome,
  TaskBoardHomeMove,
  TaskBoardHomePriority,
  TaskBoardTask,
} from "@t3tools/contracts";

const BRIEF_FILE = /^\d{4}-\d{2}-\d{2}-briefing\.md$/;
const TASK_LINK = /\]\((?:\.\.\/)*tasks\/([^)]+\.md)\)/;
const PRIORITY_RANK = { critical: 3, high: 2, medium: 1, low: 0 } as const;

const freshestFirst = (a: TaskBoardTask, b: TaskBoardTask) => b.updatedAt - a.updatedAt;

/**
 * Reads the newest `logs/briefings/YYYY-MM-DD-briefing.md` and its "Priorities Seeded" checklist.
 * A priority linked to a card counts as done once that card is done, even if the brief predates it.
 */
export function readBrief(
  root: string,
  tasks: ReadonlyArray<TaskBoardTask>,
): TaskBoardHome["brief"] {
  const dir = NodePath.join(root, "logs", "briefings");
  let file: string | undefined;
  try {
    file = NodeFS.readdirSync(dir)
      .filter((name) => BRIEF_FILE.test(name))
      .toSorted()
      .pop();
  } catch {
    return null;
  }
  if (file === undefined) return null;
  let text: string;
  try {
    text = NodeFS.readFileSync(NodePath.join(dir, file), "utf8");
  } catch {
    return null;
  }
  const bySourceFile = new Map(tasks.map((task) => [task.sourceFile, task]));
  const section = /Priorities Seeded[^\n]*\n([\s\S]*?)(?:\n\s*- \*\*[A-Z]|\n#|$)/.exec(text)?.[1];
  const priorities: TaskBoardHomePriority[] = [];
  for (const match of (section ?? "").matchAll(/- \[( |x)\] \*\*(.+?):\*\*\s*(.*)/g)) {
    const linked = TASK_LINK.exec(match[3] ?? "")?.[1];
    const task = linked === undefined ? undefined : bySourceFile.get(NodePath.basename(linked));
    priorities.push({
      title: (match[2] ?? "").trim(),
      detail: (match[3] ?? "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim(),
      done: match[1] === "x" || task?.status === "done",
      taskId: task?.id ?? null,
    });
  }
  return { date: file.slice(0, 10), file: `logs/briefings/${file}`, priorities };
}

/** One next move, in order: review waiting work, finish work in progress, unblock, then focus. */
export function pickNextMove(tasks: ReadonlyArray<TaskBoardTask>): TaskBoardHomeMove {
  const withStatus = (status: TaskBoardTask["status"]) =>
    tasks.filter((task) => task.status === status).toSorted(freshestFirst);
  const review = withStatus("review")[0];
  if (review) {
    return {
      kind: "review",
      title: `Review: ${review.title}`,
      reason: "Finished work is waiting for your sign-off.",
      taskId: review.id,
    };
  }
  const inProgress = withStatus("in_progress");
  const current = inProgress[0];
  if (current) {
    return {
      kind: "finish",
      title: `Finish: ${current.title}`,
      reason:
        inProgress.length === 1
          ? "Your only task in progress."
          : `${inProgress.length} tasks in progress. This one is freshest in your head.`,
      taskId: current.id,
    };
  }
  const blocked = withStatus("blocked")[0];
  if (blocked) {
    return {
      kind: "unblock",
      title: `Unblock: ${blocked.title}`,
      reason: "The smallest move that unblocks it frees everything behind it.",
      taskId: blocked.id,
    };
  }
  const next = withStatus("todo")
    .filter((task) => task.priority === "critical" || task.priority === "high")
    .toSorted((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority])[0];
  if (next) {
    return {
      kind: "focus",
      title: next.title,
      reason: `Top ${next.priority === "critical" ? "Critical" : "High"} task, not started yet.`,
      taskId: next.id,
    };
  }
  return {
    kind: "rest",
    title: "Nothing needs you",
    reason: "No reviews, open work, blockers or high-priority tasks are waiting.",
    taskId: null,
  };
}

export function buildHome(root: string | null, tasks: ReadonlyArray<TaskBoardTask>): TaskBoardHome {
  const count = (status: TaskBoardTask["status"]) =>
    tasks.filter((task) => task.status === status).length;
  return {
    root,
    brief: root === null ? null : readBrief(root, tasks),
    counts: {
      todo: count("todo"),
      inProgress: count("in_progress"),
      review: count("review"),
      blocked: count("blocked"),
    },
    move: pickNextMove(tasks),
  };
}
