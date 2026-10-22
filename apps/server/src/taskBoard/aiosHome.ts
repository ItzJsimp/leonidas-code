// @effect-diagnostics nodeBuiltinImport:off - reads brief files from the AIOS folder synchronously, like aiosCards.
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import { isRealPathInside } from "./aiosCards.ts";

import type {
  TaskBoardHome,
  TaskBoardHomeArea,
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
  // A briefings folder linked in from another workspace is not this workspace's brief.
  if (!isRealPathInside(root, dir)) return null;
  let file: string | undefined;
  try {
    file = NodeFS.readdirSync(dir)
      .filter((name) => BRIEF_FILE.test(name))
      .toSorted()
      .pop();
  } catch {
    return null;
  }
  if (file === undefined || !isRealPathInside(root, NodePath.join(dir, file))) return null;
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

/** How each AIOS area counts its units: notes in the folder, notes in any subfolder, or folders. */
const AREAS: ReadonlyArray<{
  readonly id: string;
  readonly dir: string;
  readonly unit: "topNotes" | "notes" | "folders" | "files";
}> = [
  { id: "tasks", dir: "tasks", unit: "topNotes" },
  { id: "projects", dir: "projects", unit: "folders" },
  { id: "decisions", dir: "decisions", unit: "topNotes" },
  { id: "memory", dir: "memory", unit: "notes" },
  { id: "logs", dir: "logs", unit: "files" },
  { id: "skills", dir: ".agents/skills", unit: "folders" },
  { id: "wiki", dir: "wiki", unit: "notes" },
];

/** Files read per area at most, so a large AIOS keeps the home read cheap. */
const AREA_WALK_CAP = 5_000;
/** Subfolder levels read below an area folder. A project folder can hold a whole code repo. */
const MAX_DEPTH = 2;

const isNote = (name: string) => name.endsWith(".md") && !name.endsWith("-index.md");

/** The AIOS areas that exist, with a unit count and the newest file time, newest first. */
export async function readAreas(root: string, cap = AREA_WALK_CAP): Promise<TaskBoardHomeArea[]> {
  const read = async (area: (typeof AREAS)[number]): Promise<TaskBoardHomeArea | null> => {
    let units = 0;
    const files: string[] = [];
    const visit = async (dir: string, depth: number): Promise<void> => {
      const entries = await NodeFSP.readdir(dir, { withFileTypes: true }).catch(() => []);
      const subfolders: string[] = [];
      for (const entry of entries) {
        const path = NodePath.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
          if (area.unit === "folders" && depth === 0) units++;
          if (area.unit !== "topNotes" && depth < MAX_DEPTH) subfolders.push(path);
          continue;
        }
        if (files.length >= cap) continue;
        if (area.unit !== "files" && area.unit !== "folders" && !isNote(entry.name)) continue;
        files.push(path);
        if (area.unit !== "folders") units++;
      }
      await Promise.all(subfolders.map((path) => visit(path, depth + 1)));
    };
    await visit(NodePath.join(root, area.dir), 0);
    if (units === 0) return null;
    // A file removed during the walk does not change the area time.
    const times = await Promise.all(
      files.map((path) =>
        NodeFSP.stat(path).then(
          (stat) => stat.mtimeMs,
          () => 0,
        ),
      ),
    );
    return { id: area.id, units, changedAt: Math.max(0, ...times) };
  };
  const areas = await Promise.all(AREAS.map(read));
  return areas.filter((area) => area !== null).toSorted((a, b) => b.changedAt - a.changedAt);
}

const AREAS_TTL_MS = 30_000;
const areasCache = new Map<
  string,
  { readonly at: number; readonly areas: Promise<TaskBoardHomeArea[]> }
>();

/**
 * `readAreas` with a 30 s cache per root, so opening the Command Center often costs one walk.
 * shortcut: the times can lag 30 s; the live in-turn signal covers changes the agent makes now.
 */
export function cachedAreas(root: string, now: number): Promise<TaskBoardHomeArea[]> {
  const hit = areasCache.get(root);
  if (hit && now - hit.at < AREAS_TTL_MS) return hit.areas;
  const areas = readAreas(root);
  areasCache.set(root, { at: now, areas });
  return areas;
}

export function buildHome(
  root: string | null,
  tasks: ReadonlyArray<TaskBoardTask>,
  areas: ReadonlyArray<TaskBoardHomeArea> = [],
): TaskBoardHome {
  const count = (status: TaskBoardTask["status"]) =>
    tasks.filter((task) => task.status === status).length;
  return {
    root,
    brief: root === null ? null : readBrief(root, tasks),
    areas,
    counts: {
      todo: count("todo"),
      inProgress: count("in_progress"),
      review: count("review"),
      blocked: count("blocked"),
    },
    move: pickNextMove(tasks),
  };
}
