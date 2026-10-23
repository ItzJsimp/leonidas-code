import { useActiveAiosWorkspace } from "~/components/workspace/useActiveAiosWorkspace";
import { eventFeedLive } from "~/state/eventFeed";
import { useEnvironmentQuery } from "~/state/query";

import { useFeedEvents } from "../../twoState/useTwoStateData";

/** The inbox events plus the state of the read behind them (the same feed the rail badge counts). */
export function useInboxFeed() {
  const { environmentId, scope, scopeReady } = useActiveAiosWorkspace();
  const feed = useEnvironmentQuery(
    environmentId && scopeReady ? eventFeedLive({ environmentId, input: scope }) : null,
  );
  const events = useFeedEvents();
  return {
    environmentId,
    events,
    loading: environmentId !== null && feed.data === null && feed.error === null,
    failed: feed.data === null && feed.error !== null,
    updatedAt: feed.dataUpdatedAt,
    refresh: feed.refresh,
  };
}
