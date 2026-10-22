import type { FoldedFeedEvent } from "@t3tools/contracts";

import type { EventMark } from "~/eventFeedStore";
import { feedEventOpenTarget } from "~/eventFeedOpen";

/** Rows the Activity section keeps. The bell inbox holds every event. */
const ACTIVITY_LIMIT = 20;

/** Needs you holds unread `needs_you` and `failed` events. Opening one marks it read. */
export function isNeedsYou(event: FoldedFeedEvent, read: boolean): boolean {
  return !read && (event.level === "needs_you" || event.level === "failed");
}

/** The right rail: Needs you first, then Activity without those items. Order stays newest first. */
export function splitFeed(
  events: ReadonlyArray<FoldedFeedEvent>,
  marks: Readonly<Record<string, EventMark>>,
  limit = ACTIVITY_LIMIT,
): { readonly needsYou: FoldedFeedEvent[]; readonly activity: FoldedFeedEvent[] } {
  const needsYou: FoldedFeedEvent[] = [];
  const activity: FoldedFeedEvent[] = [];
  for (const event of events) {
    if (isNeedsYou(event, marks[event.id]?.read === true)) needsYou.push(event);
    else if (activity.length < limit) activity.push(event);
  }
  return { needsYou, activity };
}

/** The one button on a Needs you row, or null when the event opens nothing. */
export function actionLabel(event: FoldedFeedEvent): string | null {
  const label = event.actions?.[0]?.label;
  if (label !== undefined) return label;
  const target = feedEventOpenTarget(event);
  if (target === null) return null;
  return "thread" in target ? "Open chat" : "Open link";
}
