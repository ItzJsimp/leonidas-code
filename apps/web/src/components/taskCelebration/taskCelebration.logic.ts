import type { TaskBoardCompletion } from "@t3tools/contracts";

/** A completion older than this is history, not a moment to celebrate. */
export const CELEBRATION_MAX_AGE_MS = 10 * 60_000;

/**
 * Splits a completion list into the ones not seen before. The first list (`seen` is null) only
 * records ids: it holds completions from before this client connected.
 */
export function takeFreshCompletions(
  seen: ReadonlySet<string> | null,
  list: ReadonlyArray<TaskBoardCompletion>,
  now: number,
): { readonly seen: ReadonlySet<string>; readonly fresh: ReadonlyArray<TaskBoardCompletion> } {
  const next = new Set(seen ?? []);
  const fresh: TaskBoardCompletion[] = [];
  for (const completion of list) {
    if (next.has(completion.id)) continue;
    next.add(completion.id);
    if (seen !== null && now - completion.completedAt <= CELEBRATION_MAX_AGE_MS) {
      fresh.push(completion);
    }
  }
  return { seen: next, fresh };
}

const OWN_LINES = [
  (title: string) => `Nice. You completed ${title}.`,
  (title: string) => `Done: ${title}. One less thing.`,
  (title: string) => `${title} is done. Good work.`,
];

/** The toast line for one completion; `pick` chooses the line, so callers can rotate them. */
export function celebrationMessage(completion: TaskBoardCompletion, pick: number): string {
  if (completion.byAgent) return `Your agent completed ${completion.title}.`;
  const line = OWN_LINES[Math.abs(Math.trunc(pick)) % OWN_LINES.length]!;
  return line(completion.title);
}
