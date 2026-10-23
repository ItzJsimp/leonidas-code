import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import { Link, useNavigate } from "@tanstack/react-router";
import { FolderKanbanIcon, FolderIcon, PlusIcon } from "lucide-react";
import { useMemo } from "react";

import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { useActiveAiosWorkspace } from "~/components/workspace/useActiveAiosWorkspace";
import { scopeToWorkspace } from "~/components/workspace/aiosWorkspace.logic";
import { openCommandPalette } from "~/commandPaletteBus";
import { useClientSettings } from "~/hooks/useSettings";
import { useNowMinute } from "~/hooks/useNowMinute";
import { selectProjectGroupingSettings } from "~/logicalProject";
import { buildSidebarProjectSnapshots } from "~/sidebarProjectGrouping";
import {
  useAllEnvironmentProjectSnapshotsReady,
  useProjects,
  useServerConfigs,
  useThreadShells,
} from "~/state/entities";
import { useEnvironments, usePrimaryEnvironmentId } from "~/state/environments";

import { RailWindow } from "../../twoState/RailWindow";
import {
  activityLabel,
  projectRows,
  type ProjectChat,
  type ProjectGroup,
  type ProjectRow,
} from "./projects.logic";

const addProject = () => openCommandPalette({ open: "add-project" });
const BUTTON_LINK =
  "inline-flex h-7 items-center rounded-md border border-border px-2 text-xs font-medium hover:bg-surface-raised focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:h-6";

/** The projects of the active workspace, grouped the way the chat list groups them. */
function useProjectRows(): { readonly rows: ProjectRow[] | null } {
  const projects = useProjects();
  const threads = useThreadShells();
  const configs = useServerConfigs();
  const settings = useClientSettings(selectProjectGroupingSettings);
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const { environments } = useEnvironments();
  const workspace = useActiveAiosWorkspace();
  const snapshotsReady = useAllEnvironmentProjectSnapshotsReady();
  const { environmentId, workspaces, active, scopeReady } = workspace;
  return useMemo(() => {
    if (!scopeReady || !snapshotsReady) return { rows: null };
    const scoped = scopeToWorkspace({ environmentId, workspaces, active, projects, threads });
    const named = scoped.projects.filter(
      (project) =>
        !isScratchProject(project, configs.get(project.environmentId)?.scratchWorkspaceRoot),
    );
    const labels = new Map(environments.map((entry) => [entry.environmentId, entry.label]));
    const groups: ProjectGroup[] = buildSidebarProjectSnapshots({
      projects: named,
      settings,
      primaryEnvironmentId,
      resolveEnvironmentLabel: (id) => labels.get(id) ?? null,
    }).map((group) => ({
      key: group.projectKey,
      name: group.displayName,
      memberKeys: group.memberProjects.map((member) => `${member.environmentId}:${member.id}`),
    }));
    const chats: ProjectChat[] = scoped.threads.map((thread) => ({
      id: thread.id,
      environmentId: thread.environmentId,
      projectKey: `${thread.environmentId}:${thread.projectId}`,
      at: thread.lastActivityAt ?? thread.updatedAt,
      archived: thread.archivedAt !== null,
    }));
    return { rows: projectRows(groups, chats) };
  }, [
    scopeReady,
    snapshotsReady,
    environmentId,
    workspaces,
    active,
    projects,
    threads,
    configs,
    settings,
    primaryEnvironmentId,
    environments,
  ]);
}

/** The Projects window: one row per project with its chats, its last activity and two actions. */
export function ProjectsWindow() {
  const { rows } = useProjectRows();
  const navigate = useNavigate();
  const now = Date.parse(`${useNowMinute()}Z`);
  return (
    <RailWindow
      title="Projects"
      actions={
        <Button size="xs" variant="outline" onClick={addProject}>
          <PlusIcon aria-hidden />
          Add a project
        </Button>
      }
    >
      {rows === null ? (
        <div role="status" aria-label="Loading your projects" className="flex flex-col gap-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-16 w-full" shape="card" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <FolderKanbanIcon aria-hidden className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">No projects yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            A project is a folder Leonidas works in. Add one to start a chat in it.
          </p>
          <Button size="sm" variant="outline" className="mt-1" onClick={addProject}>
            <PlusIcon aria-hidden />
            Add a project
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((row) => (
            <li key={row.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <FolderIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 basis-40">
                <span className="block truncate text-sm font-medium">{row.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {activityLabel(row.chats, row.lastActivity, now)}
                </span>
              </span>
              <span className="flex shrink-0 gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={row.newest === null}
                  onClick={() => {
                    const newest = row.newest;
                    if (newest === null) return;
                    void navigate({
                      to: "/$environmentId/$threadId",
                      params: { environmentId: newest.environmentId, threadId: newest.id },
                    });
                  }}
                >
                  Open newest chat
                </Button>
                <Link
                  to="/settings/projects"
                  search={{ project: row.key, machine: undefined } as never}
                  className={BUTTON_LINK}
                >
                  Settings
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </RailWindow>
  );
}
