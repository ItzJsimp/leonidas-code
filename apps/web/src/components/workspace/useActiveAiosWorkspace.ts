import type { AiosWorkspaceSummary } from "@t3tools/contracts";
import { useEffect, useMemo } from "react";

import { aiosWorkspacesQuery } from "~/state/aiosWorkspaces";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";

import { pickActiveWorkspace, workspaceScopeInput } from "./aiosWorkspace.logic";
import { useAiosWorkspaceStore } from "./aiosWorkspaceStore";

const NO_WORKSPACES: ReadonlyArray<AiosWorkspaceSummary> = [];

/**
 * The AIOS workspace this window shows (ADR-0080). `scope` goes into every Command request.
 * `scopeReady` stays false until the list loads, so a view never flashes another workspace's data.
 */
export function useActiveAiosWorkspace() {
  const environmentId = usePrimaryEnvironmentId();
  const query = useEnvironmentQuery(
    environmentId ? aiosWorkspacesQuery({ environmentId, input: {} }) : null,
  );
  const workspaces = query.data?.workspaces ?? NO_WORKSPACES;
  const chosenId = useAiosWorkspaceStore((store) =>
    environmentId ? store.chosen[environmentId] : undefined,
  );
  const choose = useAiosWorkspaceStore((store) => store.choose);
  const setResolved = useAiosWorkspaceStore((store) => store.setResolved);
  const active = useMemo(() => pickActiveWorkspace(workspaces, chosenId), [workspaces, chosenId]);
  const activeId = active?.id ?? undefined;
  const scope = useMemo(() => workspaceScopeInput(activeId), [activeId]);

  useEffect(() => {
    if (environmentId) setResolved(environmentId, activeId);
  }, [environmentId, activeId, setResolved]);

  return {
    environmentId,
    workspaces,
    active,
    scope,
    scopeReady: query.data !== null || query.error !== null,
    refresh: query.refresh,
    choose: (workspaceId: string) => {
      if (environmentId) choose(environmentId, workspaceId);
    },
  };
}
