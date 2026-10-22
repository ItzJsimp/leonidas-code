import type { FoldedFeedEvent } from "@t3tools/contracts";
import { useMemo } from "react";

import { groupCommandCenterThreads } from "~/commandCenter";
import { useActiveAiosWorkspace } from "~/components/workspace/useActiveAiosWorkspace";
import { useEventFeedStore } from "~/eventFeedStore";
import { useThreadShells } from "~/state/entities";
import { eventFeedLive } from "~/state/eventFeed";
import { useEnvironmentQuery } from "~/state/query";
import { taskBoardHomeQuery } from "~/state/taskBoard";

import type { StatusCounts } from "./copy";
import { isNeedsYou } from "./railFeed";

const NO_EVENTS: ReadonlyArray<FoldedFeedEvent> = [];

/** The AIOS home read (areas, today's brief, counts) for the active workspace. */
export function useAiosHome() {
  const { environmentId, scope, scopeReady } = useActiveAiosWorkspace();
  return useEnvironmentQuery(
    environmentId && scopeReady ? taskBoardHomeQuery({ environmentId, input: scope }) : null,
  );
}

/** Feed events the user has not dismissed, newest first. */
export function useFeedEvents(): ReadonlyArray<FoldedFeedEvent> {
  const { environmentId, scope, scopeReady } = useActiveAiosWorkspace();
  const feed = useEnvironmentQuery(
    environmentId && scopeReady ? eventFeedLive({ environmentId, input: scope }) : null,
  );
  const marks = useEventFeedStore((store) => store.marks);
  return useMemo(
    () => (feed.data?.events ?? NO_EVENTS).filter((event) => !marks[event.id]?.dismissed),
    [feed.data, marks],
  );
}

/** One source for every count, so the status line, header stats and rails show the same number. */
export function useTwoStateCounts(): StatusCounts {
  const events = useFeedEvents();
  const marks = useEventFeedStore((store) => store.marks);
  const threads = useThreadShells();
  const home = useAiosHome().data;
  const needsYou = useMemo(
    () => events.filter((event) => isNeedsYou(event, marks[event.id]?.read === true)).length,
    [events, marks],
  );
  const running = useMemo(() => groupCommandCenterThreads(threads).running.length, [threads]);
  const priorities = home?.brief?.priorities;
  const today = priorities
    ? { done: priorities.filter((priority) => priority.done).length, total: priorities.length }
    : null;
  return { needsYou, running, today };
}
