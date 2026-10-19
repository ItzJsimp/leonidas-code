import { listAiosWorkspaces, workspaceForPath } from "../taskBoard/aiosWorkspaces.ts";

/** The project sources available to one scoped catalog request. */
export function subagentWorkspaceProjects<P extends { readonly workspaceRoot: string }>(
  projects: ReadonlyArray<P>,
  aiosRoot: string | null,
  workspaceId?: string,
): ReadonlyArray<P> {
  if (workspaceId === undefined) return projects;
  if (aiosRoot === null) return [];
  const workspaces = listAiosWorkspaces([
    aiosRoot,
    ...projects.map((project) => project.workspaceRoot),
  ]);
  const owner = workspaceForPath(workspaces, aiosRoot);
  if (owner?.status !== "ready" || owner.file.id !== workspaceId) return [];
  return projects.filter(
    (project) => workspaceForPath(workspaces, project.workspaceRoot) === owner,
  );
}
