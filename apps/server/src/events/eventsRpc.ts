import {
  completeFeedEvent,
  type FeedEventDraft,
  FeedEventError,
  type FeedUpdate,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";

import { makeEventFeed } from "./EventFeed.ts";
import { appendFeedEvent } from "./feedFile.ts";

/** One watcher per AIOS root for the whole server, shared by every client. */
const eventFeed = makeEventFeed();

const EMPTY: FeedUpdate = { kind: "snapshot", events: [], bad: [] };

/** The feed of `root` as a stream; one empty snapshot when no AIOS is connected. */
export function feedStream(root: string | null): Stream.Stream<FeedUpdate> {
  if (root === null) return Stream.make(EMPTY);
  return Stream.callback<FeedUpdate>((mailbox) =>
    Effect.acquireRelease(
      Effect.sync(() => eventFeed.subscribe(root, (update) => Queue.offerUnsafe(mailbox, update))),
      (unsubscribe) => Effect.sync(unsubscribe),
    ),
  );
}

/** Stamps `v`, `id` and `ts`, then appends. The folder watch delivers the line to subscribers. */
export function appendDraft(
  root: string | null,
  draft: FeedEventDraft,
): Effect.Effect<{ readonly id: string }, FeedEventError> {
  if (root === null) return Effect.fail(new FeedEventError({ message: "No AIOS is connected." }));
  return Effect.try({
    try: () => {
      const event = completeFeedEvent(draft);
      appendFeedEvent(root, event);
      return { id: event.id };
    },
    catch: (error) =>
      new FeedEventError({ message: `Could not write the event: ${String(error)}` }),
  });
}
