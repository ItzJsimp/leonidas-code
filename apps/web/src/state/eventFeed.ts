import {
  type FeedBadLine,
  type FeedUpdate,
  type FoldedFeedEvent,
  waitsForUser,
  WS_METHODS,
} from "@t3tools/contracts";
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcSubscriptionAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import * as Stream from "effect/Stream";

import { connectionAtomRuntime } from "../connection/runtime";

export interface FeedView {
  /** Newest first. */
  readonly events: ReadonlyArray<FoldedFeedEvent>;
  readonly bad: ReadonlyArray<FeedBadLine>;
  /** Events first seen in the last update; empty after a snapshot, so old events never pop. */
  readonly fresh: ReadonlyArray<FoldedFeedEvent>;
}

export const EMPTY_FEED_VIEW: FeedView = { events: [], bad: [], fresh: [] };
/** The inbox keeps this many events in memory; older ones stay in the month files. */
const FEED_VIEW_MAX = 500;

/** The newest events up to the cap, plus every older one that still waits for the user. */
const trim = (events: ReadonlyArray<FoldedFeedEvent>): FoldedFeedEvent[] =>
  events.filter((event, index) => index < FEED_VIEW_MAX || waitsForUser(event));

export function applyFeedUpdate(view: FeedView, update: FeedUpdate): FeedView {
  if (update.kind === "snapshot") {
    return {
      events: trim(update.events.toReversed()),
      bad: update.bad,
      fresh: [],
    };
  }
  const known = new Set(view.events.map((event) => event.id));
  const changed = new Map(update.events.map((event) => [event.id, event]));
  const fresh = update.events.filter((event) => !known.has(event.id));
  const kept = view.events.filter((event) => !changed.has(event.id));
  return {
    events: trim([...update.events.toReversed(), ...kept]),
    bad: update.bad.length === 0 ? view.bad : [...view.bad, ...update.bad].slice(-50),
    fresh,
  };
}

/** The event feed: the recent months on subscribe, then each new or folded event. */
export const eventFeedLive = createEnvironmentRpcSubscriptionAtomFamily(connectionAtomRuntime, {
  label: "environment-data:event-feed",
  tag: WS_METHODS.eventsSubscribe,
  transform: (stream) =>
    stream.pipe(
      Stream.mapAccum(
        (): FeedView => EMPTY_FEED_VIEW,
        (view, update): readonly [FeedView, ReadonlyArray<FeedView>] => {
          const next = applyFeedUpdate(view, update);
          return [next, [next]];
        },
      ),
    ),
});

export const eventsAppend = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:event-feed:append",
  tag: WS_METHODS.eventsAppend,
});
