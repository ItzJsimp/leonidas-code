import type { ThreadSweepClass, ThreadSweepItem, ThreadSweepResult } from "@t3tools/contracts";

/** Where one chat's handoff prompt stands. Absent means the user has not asked for it. */
export type HandoffState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly prompt: string }
  | { readonly status: "error"; readonly message: string };

/** Maps the server answer to a row state. A null prompt always carries a plain reason. */
export function handoffStateFromResult(
  result: { readonly prompt: string | null; readonly reason: string } | null,
): HandoffState {
  if (result === null) {
    return { status: "error", message: "The prompt could not be written. Try again." };
  }
  return result.prompt === null
    ? { status: "error", message: result.reason }
    : { status: "ready", prompt: result.prompt };
}

export const IDLE_OPTIONS = [
  { id: "1h", label: "1 hour", minutes: 60 },
  { id: "12h", label: "12 hours", minutes: 12 * 60 },
  { id: "any", label: "Any", minutes: 0 },
] as const;
export type IdleOptionId = (typeof IDLE_OPTIONS)[number]["id"];
export const DEFAULT_IDLE: IdleOptionId = "12h";

export const idleMinutes = (id: IdleOptionId): number =>
  IDLE_OPTIONS.find((option) => option.id === id)?.minutes ?? 0;

/** The order sections show in: archive candidates first, then work to continue, then the unclear ones. */
export const CLASS_ORDER: ReadonlyArray<ThreadSweepClass> = ["done", "unfinished", "unsure"];

export const CLASS_LABEL: Record<ThreadSweepClass, string> = {
  done: "Done",
  unfinished: "Unfinished",
  unsure: "Not sure",
};

export const CLASS_HINT: Record<ThreadSweepClass, string> = {
  done: "The work looks finished. Archive these to clear your list.",
  unfinished: "Work is left or an answer is waiting. Open one to continue.",
  unsure: "The sweep could not tell. Open one to decide.",
};

const SOURCE_LABEL: Record<ThreadSweepItem["source"], string> = {
  rule: "Reply wording",
  laya: "Laya",
  model: "AI model",
};
export const sourceLabel = (source: ThreadSweepItem["source"]): string => SOURCE_LABEL[source];

/** Newest first inside each class. */
export function groupSweepItems(
  items: ReadonlyArray<ThreadSweepItem>,
): Record<ThreadSweepClass, ThreadSweepItem[]> {
  const groups: Record<ThreadSweepClass, ThreadSweepItem[]> = {
    done: [],
    unfinished: [],
    unsure: [],
  };
  for (const item of items) groups[item.verdict].push(item);
  for (const list of Object.values(groups)) {
    list.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
  return groups;
}

/** Done threads start checked. The user can uncheck any before archiving. */
export const initialSelection = (items: ReadonlyArray<ThreadSweepItem>): ReadonlySet<string> =>
  new Set(items.filter((item) => item.verdict === "done").map((item) => item.threadId));

export function toggleSelection(selection: ReadonlySet<string>, threadId: string): Set<string> {
  const next = new Set(selection);
  if (next.has(threadId)) next.delete(threadId);
  else next.add(threadId);
  return next;
}

/** Drops threads that were archived, and their selection. */
export function withoutThreads(
  items: ReadonlyArray<ThreadSweepItem>,
  removed: ReadonlySet<string>,
): ThreadSweepItem[] {
  return items.filter((item) => !removed.has(item.threadId));
}

export function sweepSummary(items: ReadonlyArray<ThreadSweepItem>): string {
  if (items.length === 0) return "No chats to review.";
  const groups = groupSweepItems(items);
  return CLASS_ORDER.map((id) => `${groups[id].length} ${CLASS_LABEL[id].toLowerCase()}`).join(
    ", ",
  );
}

/** Plain-words notes about what the sweep could not do. Empty when everything ran. */
export function sweepNotices(result: ThreadSweepResult): string[] {
  const notices: string[] = [];
  if (!result.layaAvailable) {
    notices.push(
      "Laya is not installed, so the sweep used reply wording and the AI model. Install Laya in Settings to sort faster.",
    );
  }
  if (result.modelLimitHit) {
    notices.push(
      "Only the first 12 unclear chats were checked by the AI model. The rest show as not sure.",
    );
  }
  return notices;
}
