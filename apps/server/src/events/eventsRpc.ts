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

/** How often a client with no AIOS checks again, so a folder connected later starts the feed. */
const NO_ROOT_RETRY = "30 seconds";

/**
 * The feed of the AIOS `resolveRoot` names. With no AIOS yet, it sends one empty snapshot and
 * checks again every 30 s without sending more.
 */
export function feedStream<E, R>(
  resolveRoot: Effect.Effect<string | null, E, R>,
  sentEmpty = false,
): Stream.Stream<FeedUpdate, E, R> {
  return Stream.unwrap(
    resolveRoot.pipe(
      Effect.map((root) => {
        if (root !== null) return rootStream(root);
        const retry = Stream.unwrap(
          Effect.sleep(NO_ROOT_RETRY).pipe(Effect.as(feedStream(resolveRoot, true))),
        );
        return sentEmpty ? retry : Stream.make(EMPTY).pipe(Stream.concat(retry));
      }),
    ),
  );
}

function rootStream(root: string): Stream.Stream<FeedUpdate> {
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
