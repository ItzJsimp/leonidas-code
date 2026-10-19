import type { AiosWorkspaceSummary, ScopedProjectRef } from "@t3tools/contracts";
import { useMemo } from "react";
import { aiosWorkspacesQuery } from "~/state/aiosWorkspaces";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { workspaceForProject, workspaceScopeInput } from "./aiosWorkspace.logic";
import { useAiosWorkspaceStore } from "./aiosWorkspaceStore";

const NONE: ReadonlyArray<AiosWorkspaceSummary> = [];

/** A chat stays in its project's workspace; a new chat uses the chosen workspace. */
export function useProjectAiosWorkspace(projectRef: ScopedProjectRef | null = null) {
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const environmentId = projectRef?.environmentId ?? primaryEnvironmentId;
  const query = useEnvironmentQuery(
    environmentId ? aiosWorkspacesQuery({ environmentId, input: {} }) : null,
  );
  const workspaces = query.data?.workspaces ?? NONE;
  const chosenId = useAiosWorkspaceStore((store) =>
    environmentId ? store.chosen[environmentId] : undefined,
  );
  const active = useMemo(
    () => workspaceForProject(workspaces, projectRef?.projectId, chosenId),
    [workspaces, projectRef?.projectId, chosenId],
  );
  const scope = useMemo(() => workspaceScopeInput(active?.id ?? undefined), [active?.id]);
  return { environmentId, workspaces, active, scope, scopeReady: query.data !== null };
}
