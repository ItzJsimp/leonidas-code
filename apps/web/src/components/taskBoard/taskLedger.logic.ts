import type { FeedEvent } from "@t3tools/contracts";
import type { TaskPresenceChat } from "@t3tools/shared/taskPresence";

/** The Task ledger entries (`task.worked`, ADR-0090) for one card, newest first. */
export function ledgerFor<Event extends FeedEvent>(
  events: ReadonlyArray<Event>,
  taskId: string,
): ReadonlyArray<Event> {
  return events
    .filter((event) => event.type === "task.worked" && event.target?.task === taskId)
    .toSorted((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
}

/** Changes only when the set of working chats changes, so memoized rows skip unrelated shell updates. */
export const presenceKey = (map: ReadonlyMap<string, ReadonlyArray<TaskPresenceChat>>): string =>
  [...map]
    .map(
      ([taskId, chats]) =>
        `${taskId}=${chats.map((chat) => `${chat.threadId}:${chat.status}:${chat.title}`).join(",")}`,
    )
    .join("|");
