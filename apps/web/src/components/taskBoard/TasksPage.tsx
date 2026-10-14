import { TaskBackdrop } from "./TaskBackdrop";
import {
  ColumnsIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  ListIcon,
  PlusIcon,
  RefreshCwIcon,
  Share2Icon,
  RouteIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAtomValue } from "@effect/atom-react";
import { defaultDueForFocus } from "@t3tools/client-runtime/task-board/daily-planning";

import { WorkspacePageContainer } from "~/components/WorkspacePageContainer";
import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { Button } from "~/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "~/components/ui/empty";
import { SidebarInset } from "~/components/ui/sidebar";
import { Spinner } from "~/components/ui/spinner";
import { ToggleGroup, Toggle } from "~/components/ui/toggle-group";
import { isElectron } from "~/env";
import { taskBoardCardCreate } from "~/state/taskBoard";

import { TaskCreateDialog } from "./TaskCreateDialog";
import { TaskDashboardView } from "./TaskDashboard";
import { TaskDetailPanel } from "./TaskDetail";
import { TaskFilterBar } from "./TaskFilterBar";
import { TaskKanbanView } from "./TaskKanban";
import { TaskListView } from "./TaskList";
import { TaskProjectRail, TaskProjectSelect } from "./TaskProjectRail";
import { TaskQuickAdd } from "./TaskQuickAdd";
import { TaskRoadmapView } from "./TaskRoadmap";
import leonidasRoadmap from "../../../../../project-roadmap.json";
import type { TaskContext } from "./taskBoard.types";
import type { TaskView } from "./taskBoard.logic";
import {
  DEFAULT_TASKS_PREFS,
  TASKS_PREFS_KEY,
  parseTasksPrefs,
  sectionShareState,
  tasksInFocus,
  type TaskFocus,
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
  { view: "roadmap", label: "Roadmap", icon: RouteIcon },
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
  const canCreate = useAtomValue(taskBoardCardCreate.permissionAtom(board.environmentId));
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
      patchPrefs({ section: slug, focus: "all" });
      setSelectedId(null);
    },
    [patchPrefs],
  );
  const selectFocus = useCallback(
    (focus: TaskFocus) => {
      patchPrefs({ ...DEFAULT_TASKS_PREFS, focus, section: null, sort: "due", groupBy: "none" });
      setQuery("");
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
  const roadmapSlug = prefs.section ?? "leonidas-code";
  const roadmap =
    board.roadmaps.find((plan) => plan.projectSlug === roadmapSlug) ??
    (roadmapSlug === "leonidas-code" ? leonidasRoadmap : null);
  const shareState = sectionShareState(railEntry, board.scopedTasks);
  const allOpen = board.rail.reduce((sum, entry) => sum + entry.open, 0);
  const counts = useMemo(
    () => ({
      inbox: tasksInFocus(board.allTasks, "inbox", board.now).length,
      today: tasksInFocus(board.allTasks, "today", board.now).length,
      upcoming: tasksInFocus(board.allTasks, "upcoming", board.now).length,
    }),
    [board.allTasks, board.now],
  );
  const heading =
    prefs.view === "roadmap"
      ? `${roadmap?.name ?? railEntry?.name ?? "Project"} roadmap`
      : prefs.focus === "inbox"
        ? "Inbox"
        : prefs.focus === "today"
          ? "Today"
          : prefs.focus === "upcoming"
            ? "Upcoming"
            : (railEntry?.name ?? "All tasks");
  const defaultDue =
    prefs.focus === "all" ? "" : (defaultDueForFocus(prefs.focus, board.now) ?? "");

  const picker = (
    <div className="lg:hidden">
      <TaskProjectSelect
        entries={board.rail}
        selectedSlug={prefs.section}
        onSelect={selectSection}
        focus={prefs.focus}
        onFocus={selectFocus}
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
  } else if (prefs.view === "roadmap") {
    body = roadmap ? (
      <TaskRoadmapView
        key={`${board.environmentId}:${roadmap.projectSlug}`}
        plan={roadmap}
        tasks={board.allTasks}
        environmentId={board.environmentId}
        member={board.member}
        actions={actions}
        onSelect={selectTask}
        onRefresh={board.refresh}
      />
    ) : (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No release plan yet</EmptyTitle>
          <EmptyDescription>
            Ask your agent to define the current version, target release and intermediate milestones
            in this project’s project-roadmap.json. Assign tasks to versions in their details.
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
    <SidebarInset
      data-tasks-surface
      className="isolate h-dvh min-h-0 overflow-hidden overscroll-y-none"
    >
      <TaskBackdrop />
      <WorkspacePageHeader electron={isElectron} className="gap-2 border-b border-border">
        <ListChecksIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <h1 className="hidden truncate text-sm font-medium sm:block">Tasks</h1>
        <ToggleGroup
          aria-label="View"
          value={[prefs.view]}
          onValueChange={(next) => {
            const view = VIEW_OPTIONS.find((option) => option.view === next[0])?.view;
            if (view) {
              patchPrefs(
                view === "roadmap"
                  ? { view, focus: "all", section: prefs.section ?? "leonidas-code" }
                  : { view },
              );
              setSelectedId(null);
            }
          }}
          className="ml-2"
        >
          {VIEW_OPTIONS.map(({ view, label, icon: Icon }) => (
            <Toggle
              key={view}
              value={view}
              aria-label={label}
              data-tour={view === "roadmap" ? "tasks-roadmap-tab" : undefined}
            >
              <Icon aria-hidden />
              <span className="hidden lg:inline">{label}</span>
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
          <Button
            aria-label="New task"
            size="sm"
            onClick={() => setCreateOpen(true)}
            disabled={!board.environmentId || !canCreate}
          >
            <PlusIcon aria-hidden />
            <span className="hidden sm:inline">New task</span>
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
            focus={prefs.focus}
            counts={counts}
            onFocus={selectFocus}
          />
        </aside>

        <main
          className={
            selectedTask
              ? "hidden min-h-0 min-w-0 flex-1 flex-col lg:flex"
              : "flex min-h-0 min-w-0 flex-1 flex-col"
          }
        >
          <div className="flex flex-col gap-1 px-4 pt-5 pb-4">
            <h2 className="text-xl font-semibold">{heading}</h2>
            <p className="text-sm text-muted-foreground">
              {prefs.view === "roadmap"
                ? "Map the next updates to a complete, executable release plan."
                : prefs.focus === "inbox"
                  ? "Capture first. Organize when you’re ready."
                  : prefs.focus === "today"
                    ? "Today’s work, with overdue tasks first."
                    : prefs.focus === "upcoming"
                      ? "Plan what’s next, starting today."
                      : "Your tasks and agent work in one place."}
            </p>
          </div>
          {prefs.view !== "roadmap" ? (
            <TaskQuickAdd
              key={`${prefs.section}:${prefs.focus}`}
              environmentId={board.environmentId}
              member={board.member}
              projectSlug={prefs.section === "general" ? null : prefs.section}
              defaultDue={defaultDue}
              onCreated={board.refresh}
            />
          ) : null}
          {prefs.view !== "dashboard" && prefs.view !== "roadmap" ? (
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
          ) : (
            <div className="flex border-b border-border p-2 lg:hidden">{picker}</div>
          )}

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
