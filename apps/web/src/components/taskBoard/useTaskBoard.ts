import type { EnvironmentId, TaskBoardWorkspaceProject } from "@t3tools/contracts";
import { useCallback, useMemo, useState } from "react";

import { useVisibleInterval } from "~/hooks/useVisibleInterval";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { taskBoardQuery, taskBoardWorkspaceQuery } from "~/state/taskBoard";

import {
  buildDashboard,
  filterTasks,
  groupBySection,
  mergeTasks,
  sortTasks,
  type TaskDashboard,
  type TaskSectionGroup,
  type TaskView,
} from "./taskBoard.logic";
import {
  buildRailEntries,
  placeSharedOnlyIn,
  tasksInSection,
  toTaskFilters,
  type RailEntry,
  type TasksPrefs,
} from "./tasksPage.logic";

/** The AIOS cards re-read this often while the page is showing. */
const WORKSPACE_REFRESH_MS = 5_000;
/** The GitHub-backed shared board costs a network round trip, so it is read less often. */
const SHARED_REFRESH_MS = 30_000;

const NO_PROJECTS: ReadonlyArray<TaskBoardWorkspaceProject> = [];

export type TaskBoardState = {
  readonly environmentId: EnvironmentId | null;
  readonly member: string;
  readonly aiosRoot: string | null;
  /** False once the server has answered and found no AIOS task folder. */
  readonly aiosConnected: boolean;
  readonly projects: ReadonlyArray<TaskBoardWorkspaceProject>;
  /** Every task, merged with the selected project's shared board. */
  readonly allTasks: ReadonlyArray<TaskView>;
  /** The tasks in the selected section, before the toolbar filters. */
  readonly scopedTasks: ReadonlyArray<TaskView>;
  /** The selected section's tasks after filters and sorting. */
  readonly visibleTasks: ReadonlyArray<TaskView>;
  readonly sections: TaskSectionGroup[];
  readonly rail: RailEntry[];
  readonly dashboard: TaskDashboard;
  readonly now: number;
  /** True until the first answer arrives. */
  readonly isLoading: boolean;
  readonly isRefreshing: boolean;
  readonly error: string | null;
  /** Set when the shared board could not be read; local cards still show. */
  readonly sharedError: string | null;
  readonly refresh: () => void;
};

/**
 * Reads the AIOS task cards for the primary environment, plus the shared board of the selected
 * project, and derives everything the Tasks page shows from them. Refreshes only while the window
 * is showing.
 */
export function useTaskBoard(input: {
  readonly selectedSlug: string | null;
  readonly prefs: TasksPrefs;
  readonly query: string;
}): TaskBoardState {
  const { selectedSlug, prefs, query } = input;
  const environmentId = usePrimaryEnvironmentId();
  const workspace = useEnvironmentQuery(
    environmentId ? taskBoardWorkspaceQuery({ environmentId, input: {} }) : null,
  );
  const data = workspace.data;
  const projects = data?.projects ?? NO_PROJECTS;
  const member = data?.member ?? "Unknown";

  const selectedProject = selectedSlug
    ? (projects.find((project) => project.slug === selectedSlug) ?? null)
    : null;
  const sharedProjectId =
    selectedProject?.projectId && selectedProject.repository ? selectedProject.projectId : null;
  const shared = useEnvironmentQuery(
    environmentId && sharedProjectId
      ? taskBoardQuery({ environmentId, input: { projectId: sharedProjectId } })
      : null,
  );

  const { refresh: refreshWorkspace } = workspace;
  const { refresh: refreshShared } = shared;
  const refresh = useCallback(() => {
    refreshWorkspace();
    if (sharedProjectId) refreshShared();
  }, [refreshShared, refreshWorkspace, sharedProjectId]);

  useVisibleInterval(refreshWorkspace, WORKSPACE_REFRESH_MS, environmentId !== null);
  useVisibleInterval(refreshShared, SHARED_REFRESH_MS, sharedProjectId !== null);

  const sharedTasks = shared.data?.tasks;
  const allTasks = useMemo(() => {
    const merged = mergeTasks(data?.tasks ?? [], sharedTasks ?? []);
    return selectedSlug ? placeSharedOnlyIn(merged, selectedSlug) : merged;
  }, [data?.tasks, selectedSlug, sharedTasks]);

  // The page's clock moves with each answer from the server rather than on its own timer.
  const [openedAt] = useState(() => Date.now());
  const now = workspace.dataUpdatedAt || openedAt;

  const scopedTasks = useMemo(
    () => tasksInSection(allTasks, selectedSlug),
    [allTasks, selectedSlug],
  );
  const visibleTasks = useMemo(
    () => sortTasks(filterTasks(scopedTasks, toTaskFilters(prefs, query), member), prefs.sort),
    [member, prefs, query, scopedTasks],
  );
  const sections = useMemo(
    () => groupBySection(visibleTasks, projects, { hideEmpty: true }),
    [projects, visibleTasks],
  );
  const rail = useMemo(() => buildRailEntries(allTasks, projects), [allTasks, projects]);
  const dashboard = useMemo(
    () => buildDashboard(scopedTasks, now, member),
    [member, now, scopedTasks],
  );

  return {
    environmentId,
    member,
    aiosRoot: data?.aiosRoot ?? null,
    aiosConnected: data?.aiosConnected ?? true,
    projects,
    allTasks,
    scopedTasks,
    visibleTasks,
    sections,
    rail,
    dashboard,
    now,
    isLoading: environmentId !== null && data === null && workspace.error === null,
    isRefreshing: workspace.isPending || shared.isPending,
    error: workspace.error,
    sharedError: shared.error,
    refresh,
  };
}
