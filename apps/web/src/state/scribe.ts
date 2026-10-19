import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
  createEnvironmentRpcSubscriptionAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";
import * as Stream from "effect/Stream";

import { INITIAL_SCRIBE_LIVE, reduceScribeLive } from "../components/scribe/scribeLive.logic";
import { connectionAtomRuntime } from "../connection/runtime";

/** The live Scribe snapshot. Events are folded on the client, so a burst never drops one. */
export const scribeLive = createEnvironmentRpcSubscriptionAtomFamily(connectionAtomRuntime, {
  label: "environment-data:scribe:live",
  tag: WS_METHODS.scribeSubscribeEvents,
  transform: (stream) => stream.pipe(Stream.scan(() => INITIAL_SCRIBE_LIVE, reduceScribeLive)),
});

export const scribeHistoryQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:scribe:history",
  tag: WS_METHODS.scribeListHistory,
  staleTimeMs: 30_000,
  idleTtlMs: 5 * 60_000,
});

export const scribeStart = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:scribe:start",
  tag: WS_METHODS.scribeStart,
});

export const scribeStop = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:scribe:stop",
  tag: WS_METHODS.scribeStop,
});

/** One page of history, read on demand (the Transcripts tab pages by cursor and searches loaded pages). */
export const scribeListHistoryPage = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:scribe:history-page",
  tag: WS_METHODS.scribeListHistory,
});

export const scribeDeleteHistory = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:scribe:delete-history",
  tag: WS_METHODS.scribeDeleteHistory,
});
