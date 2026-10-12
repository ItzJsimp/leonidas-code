import {
  ColumnsIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  ListIcon,
  PlusIcon,
  RefreshCwIcon,
  Share2Icon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { WorkspacePageContainer } from "~/components/WorkspacePageContainer";
import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { Button } from "~/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "~/components/ui/empty";
import { SidebarInset } from "~/components/ui/sidebar";
import { Spinner } from "~/components/ui/spinner";
import { ToggleGroup, Toggle } from "~/components/ui/toggle-group";
import { isElectron } from "~/env";

import { TaskCreateDialog } from "./TaskCreateDialog";
import { TaskDashboardView } from "./TaskDashboard";
import { TaskDetailPanel } from "./TaskDetail";
import { TaskFilterBar } from "./TaskFilterBar";
import { TaskKanbanView } from "./TaskKanban";
import { TaskListView } from "./TaskList";
import { TaskProjectRail, TaskProjectSelect } from "./TaskProjectRail";
import type { TaskContext } from "./taskBoard.types";
import type { TaskView } from "./taskBoard.logic";
import {
  DEFAULT_TASKS_PREFS,
  TASKS_PREFS_KEY,
  parseTasksPrefs,
  sectionShareState,
  type TasksPrefs,
  type TasksView,
} from "./tasksPage.logic";
import { useTaskActions } from "./useTaskActions";
import { useTaskBoard } from "./useTaskBoard";

const VIEW_OPTIONS: ReadonlyArray<{
  readonly view: TasksView;
  readonly label: string;
  readonly icon: typeof ListIcon;
}> = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { view: "board", label: "Board", icon: ColumnsIcon },
  { view: "list", label: "List", icon: ListIcon },
];

function readSavedPrefs(): TasksPrefs {
  try {
    return parseTasksPrefs(window.localStorage.getItem(TASKS_PREFS_KEY));
  } catch {
    return DEFAULT_TASKS_PREFS;
  }
}

/** The Tasks route: the user's AIOS task cards, sectioned by project, with shared project boards. */
export function TasksPage() {
  const [prefs, setPrefs] = useState<TasksPrefs>(readSavedPrefs);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const board = useTaskBoard({ selectedSlug: prefs.section, prefs, query });
  const { actions, shareSection, isSharingSection } = useTaskActions({
    environmentId: board.environmentId,
    member: board.member,
    aiosRoot: board.aiosRoot,
    projects: board.projects,
    selectedSlug: prefs.section,
    refresh: board.refresh,
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(TASKS_PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Preferences are a convenience; a full or blocked store must not break the page.
    }
  }, [prefs]);

  const patchPrefs = useCallback((patch: Partial<TasksPrefs>) => {
    setPrefs((current) => ({ ...current, ...patch }));
  }, []);
  const selectSection = useCallback(
    (slug: string | null) => {
      patchPrefs({ section: slug });
      setSelectedId(null);
    },
    [patchPrefs],
  );
  const selectTask = useCallback((task: TaskView) => setSelectedId(task.id), []);
  const closeDetail = useCallback(() => setSelectedId(null), []);

  const context = useMemo<TaskContext>(
    () => ({
      member: board.member,
      now: board.now,
      aiosRoot: board.aiosRoot,
      projects: board.projects,
    }),
    [board.aiosRoot, board.member, board.now, board.projects],
  );

  const selectedTask = selectedId
    ? (board.allTasks.find((task) => task.id === selectedId) ?? null)
    : null;
  const railEntry = prefs.section
    ? (board.rail.find((entry) => entry.slug === prefs.section) ?? null)
    : null;
  const shareState = sectionShareState(railEntry, board.scopedTasks);
  const allOpen = board.rail.reduce((sum, entry) => sum + entry.open, 0);

  const picker = (
    <div className="lg:hidden">
      <TaskProjectSelect
        entries={board.rail}
        selectedSlug={prefs.section}
        onSelect={selectSection}
      />
    </div>
  );

  let body;
  if (board.isLoading) {
    body = (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  } else if (board.error !== null && board.allTasks.length === 0) {
    body = (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Tasks could not be loaded</EmptyTitle>
          <EmptyDescription>{board.error}</EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" onClick={board.refresh}>
          Try again
        </Button>
      </Empty>
    );
  } else if (!board.aiosConnected) {
    body = (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No AIOS task folder found</EmptyTitle>
          <EmptyDescription>
            Leonidas Code reads your tasks from your AIOS. Point it at your AIOS folder by setting
            LEONIDAS_AIOS_ROOT, or open a project that lives inside your AIOS, then reload.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  } else if (prefs.view === "dashboard") {
    body = (
      <TaskDashboardView
        dashboard={board.dashboard}
        tasks={board.scopedTasks}
        context={context}
        actions={actions}
        onSelect={selectTask}
        onOpenSection={selectSection}
        onCreate={() => setCreateOpen(true)}
      />
    );
  } else if (prefs.view === "board") {
    body = (
      <TaskKanbanView
        tasks={board.visibleTasks}
        context={context}
        actions={actions}
        selectedId={selectedId}
        onSelect={selectTask}
      />
    );
  } else {
    body = (
      <TaskListView
        tasks={board.visibleTasks}
        sections={board.sections}
        groupBy={prefs.groupBy}
        context={context}
        actions={actions}
        selectedId={selectedId}
        onSelect={selectTask}
      />
    );
  }

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none">
      <WorkspacePageHeader electron={isElectron} className="gap-2 border-b border-border">
        <ListChecksIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <h1 className="truncate text-sm font-medium">Tasks</h1>
        <ToggleGroup
          aria-label="View"
          value={[prefs.view]}
          onValueChange={(next) => {
            const view = VIEW_OPTIONS.find((option) => option.view === next[0])?.view;
            if (view) patchPrefs({ view });
          }}
          className="ml-2"
        >
          {VIEW_OPTIONS.map(({ view, label, icon: Icon }) => (
            <Toggle key={view} value={view} aria-label={label}>
              <Icon aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </Toggle>
          ))}
        </ToggleGroup>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh tasks"
            onClick={board.refresh}
            disabled={board.isRefreshing}
          >
            <RefreshCwIcon
              aria-hidden
              className={board.isRefreshing ? "animate-spin" : undefined}
            />
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!board.aiosConnected}>
            <PlusIcon aria-hidden />
            New task
          </Button>
        </div>
      </WorkspacePageHeader>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border p-2 lg:block">
          <TaskProjectRail
            entries={board.rail}
            allOpen={allOpen}
            selectedSlug={prefs.section}
            onSelect={selectSection}
          />
        </aside>

        <main
          className={
            selectedTask
              ? "hidden min-h-0 min-w-0 flex-1 flex-col lg:flex"
              : "flex min-h-0 min-w-0 flex-1 flex-col"
          }
        >
          {prefs.view !== "dashboard" && board.aiosConnected ? (
            <div className="border-b border-border p-2">
              <TaskFilterBar
                prefs={prefs}
                query={query}
                onQueryChange={setQuery}
                onPrefsChange={patchPrefs}
                showGroupBy={prefs.view === "list"}
                showClosedToggle={prefs.view === "list"}
                leading={picker}
              />
            </div>
          ) : board.aiosConnected ? (
            <div className="flex border-b border-border p-2 lg:hidden">{picker}</div>
          ) : null}

          {shareState.kind !== "hidden" && railEntry?.projectId ? (
            <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2 text-sm">
              <Share2Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              {shareState.kind === "share" ? (
                <>
                  <span className="min-w-0 flex-1 truncate">
                    {shareState.count} open {shareState.count === 1 ? "task is" : "tasks are"} only
                    on this machine.
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSharingSection}
                    onClick={() => shareSection(railEntry.projectId!)}
                  >
                    Share with collaborators
                  </Button>
                </>
              ) : (
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  Collaborators on {railEntry.name} can see its shared tasks.
                </span>
              )}
            </div>
          ) : shareState.kind === "unavailable" ? (
            <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
              {shareState.reason}
            </p>
          ) : null}

          {board.sharedError ? (
            <p
              role="status"
              className="border-b border-border px-3 py-2 text-xs text-warning-foreground"
            >
              The shared board could not be read, so only this machine&apos;s tasks are shown.
            </p>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {prefs.view === "dashboard" ? (
              <WorkspacePageContainer width="wide">{body}</WorkspacePageContainer>
            ) : (
              body
            )}
          </div>
        </main>

        {selectedTask ? (
          <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-y-auto border-l border-border lg:w-[26rem]">
            <TaskDetailPanel
              task={selectedTask}
              context={context}
              actions={actions}
              onClose={closeDetail}
            />
          </aside>
        ) : null}
      </div>

      <TaskCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        environmentId={board.environmentId}
        member={board.member}
        projects={board.projects}
        defaultSlug={prefs.section}
        onCreated={board.refresh}
      />
    </SidebarInset>
  );
}
