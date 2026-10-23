import type { FoldedFeedEvent } from "@t3tools/contracts";

import type { EventMark } from "~/eventFeedStore";
import { feedEventOpenTarget } from "~/eventFeedOpen";

import { isNeedsYou } from "../../twoState/railFeed";

type Marks = Readonly<Record<string, EventMark>>;

export type InboxFilter = "all" | "needs-you" | "finished";

export const INBOX_FILTERS: ReadonlyArray<{ readonly id: InboxFilter; readonly label: string }> = [
  { id: "all", label: "All" },
  { id: "needs-you", label: "Needs you" },
  { id: "finished", label: "Finished" },
];

export interface InboxGroup {
  readonly key: "needs-you" | "today" | "earlier";
  readonly label: string;
  readonly events: ReadonlyArray<FoldedFeedEvent>;
}

const time = (event: FoldedFeedEvent) => Date.parse(event.ts);
const isRead = (marks: Marks, event: FoldedFeedEvent) => marks[event.id]?.read === true;

/** Needs you first (unread questions and failures), then Today, then Earlier. Newest first in each. */
export function groupInbox(
  events: ReadonlyArray<FoldedFeedEvent>,
  marks: Marks,
  now: number,
): ReadonlyArray<InboxGroup> {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const sorted = events.toSorted((a, b) => time(b) - time(a));
  const needsYou: FoldedFeedEvent[] = [];
  const rest: FoldedFeedEvent[] = [];
  for (const event of sorted) {
    (isNeedsYou(event, isRead(marks, event)) ? needsYou : rest).push(event);
  }
  const groups: InboxGroup[] = [
    { key: "needs-you", label: "Needs you", events: needsYou },
    { key: "today", label: "Today", events: rest.filter((event) => time(event) >= startOfToday) },
    {
      key: "earlier",
      label: "Earlier",
      events: rest.filter((event) => time(event) < startOfToday),
    },
  ];
  return groups.filter((group) => group.events.length > 0);
}

export function inboxCounts(events: ReadonlyArray<FoldedFeedEvent>, marks: Marks) {
  const needsYou = events.filter((event) => isNeedsYou(event, isRead(marks, event))).length;
  return { all: events.length, needsYou, finished: events.length - needsYou };
}

/** Not read. The rail badge counts the same way; dismissed events are already out of the list. */
export const unreadIds = (events: ReadonlyArray<FoldedFeedEvent>, marks: Marks): string[] =>
  events.filter((event) => !isRead(marks, event)).map((event) => event.id);

export function filterInbox(
  groups: ReadonlyArray<InboxGroup>,
  filter: InboxFilter,
): ReadonlyArray<InboxGroup> {
  if (filter === "all") return groups;
  return groups.filter((group) => (group.key === "needs-you") === (filter === "needs-you"));
}

/** The rows in the order the list shows them, for arrow keys and selection. */
export const rowsOf = (groups: ReadonlyArray<InboxGroup>): FoldedFeedEvent[] =>
  groups.flatMap((group) => group.events);

export function searchInbox(
  events: ReadonlyArray<FoldedFeedEvent>,
  query: string,
): ReadonlyArray<FoldedFeedEvent> {
  const needle = query.trim().toLowerCase();
  if (needle === "") return events;
  return events.filter((event) =>
    [event.title, event.body ?? "", event.actor.name].some((text) =>
      text.toLowerCase().includes(needle),
    ),
  );
}

/** The index an arrow key moves to in a list, or null when the key does nothing. */
export function nextRowIndex(key: string, index: number, count: number): number | null {
  if (count === 0) return null;
  if (key === "ArrowDown") return Math.min(index + 1, count - 1);
  if (key === "ArrowUp") return Math.max(index - 1, 0);
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

export const sourceLabel = (event: FoldedFeedEvent): string => event.actor.name;

/** The chat an event links to, or null when it links to none. */
export function linkedThreadId(event: FoldedFeedEvent): string | null {
  const target = feedEventOpenTarget(event);
  return target !== null && "thread" in target ? target.thread : null;
}
