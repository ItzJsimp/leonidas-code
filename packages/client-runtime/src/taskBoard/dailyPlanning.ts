// @effect-diagnostics globalDate:off -- Calendar days in the viewer's own timezone, computed on the client outside an Effect runtime.
import type { TaskBoardTaskStatus } from "@t3tools/contracts";

/**
 * Daily planning shared by every client: Inbox, Today and Upcoming, due labels, quick due dates
 * and the capture draft. Due dates are `yyyy-mm-dd` calendar days compared in the viewer's own
 * timezone, so "today" means the same thing as the clock on the device.
 */

export type DailyFocus = "inbox" | "today" | "upcoming";

/** The section of cards that are not linked to a project. */
export const INBOX_SECTION = "general";

const DAY_MS = 86_400_000;
const DUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;
const OPEN: ReadonlySet<TaskBoardTaskStatus> = new Set([
  "todo",
  "in_progress",
  "review",
  "blocked",
]);

function isOpenStatus(status: TaskBoardTaskStatus): boolean {
  return OPEN.has(status);
}

/** The viewer's local calendar day, `offsetDays` later, as `yyyy-mm-dd`. Steps by calendar day. */
export function localDateKey(now: number, offsetDays = 0): string {
  const date = new Date(now);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Days from `now`'s local date to a `yyyy-mm-dd` due date, or null when absent or malformed. */
export function daysUntilDue(due: string | null | undefined, now: number): number | null {
  if (!due) return null;
  const match = DUE_PATTERN.exec(due);
  if (!match) return null;
  const dueDay = new Date(`${match[0]}T00:00:00Z`).getTime();
  if (!Number.isFinite(dueDay) || new Date(dueDay).toISOString().slice(0, 10) !== match[0]) {
    return null;
  }
  const today = new Date(now);
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((dueDay - todayDay) / DAY_MS);
}

/** Human due label, or null when the task has no valid due date. */
export function formatDue(due: string | null | undefined, now: number): string | null {
  const days = daysUntilDue(due, now);
  if (days === null) return null;
  if (days < 0) return `Overdue ${-days}d`;
  if (days === 0) return "Due today";
  return `Due in ${days}d`;
}

/** Sort key for a due date: its UTC midnight, or +Infinity so undated work sorts last. */
export function dueSortKey(due: string | null | undefined): number {
  const match = due ? DUE_PATTERN.exec(due) : null;
  return match
    ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : Number.POSITIVE_INFINITY;
}

/** The project section a card belongs to; unlinked cards live in the Inbox. */
export function taskSectionSlug(task: {
  readonly projectSlug?: string | null | undefined;
}): string {
  const slug = task.projectSlug?.trim();
  return slug ? slug : INBOX_SECTION;
}

type DailyTask = {
  readonly status: TaskBoardTaskStatus;
  readonly due?: string | null | undefined;
};

/** Whether a task shows in a daily view. Today includes overdue work; Upcoming is today onward. */
export function inDailyFocus(
  task: DailyTask & { readonly section: string },
  focus: DailyFocus,
  now: number,
  includeDone = false,
): boolean {
  if (!isOpenStatus(task.status) && !(includeDone && task.status === "done")) return false;
  if (focus === "inbox") return task.section === INBOX_SECTION;
  const days = daysUntilDue(task.due, now);
  return days !== null && (focus === "today" ? days <= 0 : days >= 0);
}

/**
 * A daily view's tasks, earliest due first and undated last. `projectSlug` narrows to one project
 * on the dated views; the Inbox is already the unlinked section.
 */
export function dailyFocusTasks<T extends DailyTask & { readonly projectSlug?: string | null }>(
  tasks: ReadonlyArray<T>,
  focus: DailyFocus,
  now: number,
  options: { readonly includeDone?: boolean; readonly projectSlug?: string | null } = {},
): T[] {
  return (
    tasks
      .filter((task) => {
        const section = taskSectionSlug(task);
        if (options.projectSlug && focus !== "inbox" && section !== options.projectSlug)
          return false;
        return inDailyFocus({ ...task, section }, focus, now, options.includeDone);
      })
      // `filter` returned a new array; Hermes has no `toSorted`.
      .sort((a, b) => dueSortKey(a.due) - dueSortKey(b.due))
  );
}

/** The due date a capture starts with: today on the dated views, none in the Inbox. */
export function defaultDueForFocus(focus: DailyFocus, now: number): string | null {
  return focus === "inbox" ? null : localDateKey(now);
}

/** Today, tomorrow and a week out, in the viewer's timezone. */
export function quickDueOptions(now: number): ReadonlyArray<{ label: string; due: string }> {
  return [
    { label: "Today", due: localDateKey(now) },
    { label: "Tomorrow", due: localDateKey(now, 1) },
    { label: "Next week", due: localDateKey(now, 7) },
  ];
}

/** Completing reopens to To do; anything open completes. */
export function toggleCompletionStatus(status: TaskBoardTaskStatus): TaskBoardTaskStatus {
  return status === "done" ? "todo" : "done";
}

export type CaptureDraftState = {
  readonly text: string;
  readonly key: string;
  /** The title last sent with `key`; editing away from it needs a fresh key. */
  readonly sent: string | null;
  readonly makeKey: () => string;
};

export type CaptureSubmission = { readonly title: string; readonly idempotencyKey: string };

/**
 * Quick-add text that survives a failed send. The idempotency key stays the same while the text
 * does, so retrying after a dropped connection returns the card the server already wrote instead
 * of filing a second one. Changing the text after a send rotates the key.
 */
export const CaptureDraft = {
  empty(makeKey: () => string): CaptureDraftState {
    return { text: "", key: makeKey(), sent: null, makeKey };
  },
  edit(draft: CaptureDraftState, text: string): CaptureDraftState {
    if (draft.sent !== null && text.trim() !== draft.sent) {
      return { ...draft, text, key: draft.makeKey(), sent: null };
    }
    return { ...draft, text };
  },
  submit(draft: CaptureDraftState): readonly [CaptureDraftState, CaptureSubmission | null] {
    const title = draft.text.trim();
    if (title.length === 0) return [draft, null];
    return [
      { ...draft, sent: title },
      { title, idempotencyKey: draft.key },
    ];
  },
  /** Clears the text once its capture lands, unless the user already typed something newer. */
  settle(
    draft: CaptureDraftState,
    submission: CaptureSubmission,
    result: { readonly ok: boolean },
  ): CaptureDraftState {
    if (!result.ok || draft.key !== submission.idempotencyKey) return draft;
    return CaptureDraft.empty(draft.makeKey);
  },
};
