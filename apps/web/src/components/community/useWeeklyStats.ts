import { useMemo } from "react";

import { weekStart, weeklyStats, type WeeklyStats } from "~/lib/community/leaderboard";
import { useUsageAnalyticsStore } from "~/lib/usageAnalytics/usageAnalyticsStore";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { scribeHistoryQuery } from "~/state/scribe";

const EMPTY: ReadonlyArray<{ at: string; words: number }> = [];

/** This week's counts, read on this computer: Scribe history plus the local message count. */
export function useWeeklyStats(enabled = true): WeeklyStats {
  const environmentId = usePrimaryEnvironmentId();
  const messages = useUsageAnalyticsStore((state) => state.messagesThisWeek);
  const history = useEnvironmentQuery(
    enabled && environmentId ? scribeHistoryQuery({ environmentId, input: { limit: 500 } }) : null,
  );
  const items = history.data?.items ?? EMPTY;
  return useMemo(() => {
    const now = Date.now();
    return weeklyStats(items, messages.week === weekStart(now) ? messages.count : 0, now);
  }, [items, messages]);
}
