import { useMemo } from "react";

import { useActiveAiosWorkspace } from "~/components/workspace/useActiveAiosWorkspace";
import { useNowMinute } from "~/hooks/useNowMinute";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { aiosDirectionQuery, taskBoardWorkspaceQuery } from "~/state/taskBoard";

import { useAiosHome, useFeedStatus } from "../twoState/useTwoStateData";

/** The minute clock as epoch milliseconds, so "12 min ago" stays true without a timer per row. */
export function useNowMs(): number {
  return Date.parse(`${useNowMinute()}Z`);
}

/** The AIOS task cards, with their done dates. The Tasks page reads the same query. */
export function useTaskCards() {
  const { environmentId, scope, scopeReady } = useActiveAiosWorkspace();
  return useEnvironmentQuery(
    environmentId && scopeReady ? taskBoardWorkspaceQuery({ environmentId, input: scope }) : null,
  );
}

/** The goals from the AIOS folder. The Direction card reads the same query. */
export function useGoals() {
  const environmentId = usePrimaryEnvironmentId();
  const { scope, scopeReady } = useActiveAiosWorkspace();
  return useEnvironmentQuery(
    environmentId && scopeReady ? aiosDirectionQuery({ environmentId, input: scope }) : null,
  );
}

/** When the newest data on this page was read: the later of the AIOS read and the feed. */
export function useUpdatedAt(): number {
  const home = useAiosHome().dataUpdatedAt;
  const feed = useFeedStatus().updatedAt;
  return useMemo(() => Math.max(home, feed), [home, feed]);
}
