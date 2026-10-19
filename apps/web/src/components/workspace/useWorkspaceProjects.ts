import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import type { ScopedProjectRef } from "@t3tools/contracts";
import { useMemo } from "react";
import { useProjectAiosWorkspace } from "./useProjectAiosWorkspace";
import { chatProjectsForWorkspace } from "./aiosWorkspace.logic";

/** Shared candidate set for the chat default and picker, empty until scope loads. */
export function useWorkspaceProjects(
  projects: ReadonlyArray<EnvironmentProject>,
  projectRef: ScopedProjectRef | null = null,
) {
  const workspace = useProjectAiosWorkspace(projectRef);
  const { environmentId, workspaces, active, scopeReady } = workspace;
  return useMemo(
    () =>
      scopeReady ? chatProjectsForWorkspace({ environmentId, workspaces, active, projects }) : [],
    [projects, environmentId, workspaces, active, scopeReady],
  );
}
