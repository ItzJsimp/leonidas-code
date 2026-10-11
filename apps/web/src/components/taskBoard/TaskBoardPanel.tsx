import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  FolderSyncIcon,
  ListChecksIcon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react";
import type {
  EnvironmentId,
  ProjectId,
  TaskBoardTask,
  TaskBoardTaskPriority,
} from "@t3tools/contracts";
import type { AtomCommandResult } from "@t3tools/client-runtime/state/runtime";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery, formatEnvironmentQueryError } from "~/state/query";
import { useProjects } from "~/state/entities";
import {
  taskBoardQuery,
  taskBoardCreate,
  taskBoardClaim,
  taskBoardRelease,
  taskBoardComplete,
  taskBoardUpdate,
  taskBoardSync,
} from "~/state/taskBoard";
import { useAtomCommand } from "~/state/use-atom-command";
import { useLiveRefresh } from "~/hooks/useLiveRefresh";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { SidebarMenuItem, SidebarMenuButton } from "~/components/ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";

type Member = "Jake" | "Mob";

function initialMember(): Member {
  if (typeof window === "undefined") return "Jake";
  return window.localStorage.getItem("leonidas-task-board-member") === "Mob" ? "Mob" : "Jake";
}

export function TaskBoardPanel() {
  const [open, setOpen] = useState(false);
  const environmentId = usePrimaryEnvironmentId();
  return (
    <>
      <SidebarMenuItem className="shrink-0">
        <Tooltip>
          <TooltipTrigger
            render={
              <SidebarMenuButton size="icon" aria-label="Tasks" onClick={() => setOpen(true)}>
                <ListChecksIcon />
              </SidebarMenuButton>
            }
          />
          <TooltipPopup side="top">Shared project tasks</TooltipPopup>
        </Tooltip>
      </SidebarMenuItem>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup className="flex h-[min(88dvh,56rem)] w-[min(96vw,64rem)] max-w-4xl flex-col">
          <DialogHeader>
            <DialogTitle>Project tasks</DialogTitle>
            <DialogDescription>
              Shared task claims and work history live with the project repository.
            </DialogDescription>
          </DialogHeader>
          {open && <TaskBoardContents key={environmentId} environmentId={environmentId} />}
        </DialogPopup>
      </Dialog>
    </>
  );
}

function TaskBoardContents({ environmentId }: { environmentId: EnvironmentId | null }) {
  const projects = useProjects().filter((project) => project.environmentId === environmentId);
  const [selectedId, setSelectedId] = useState<ProjectId | null>(null);
  const project = projects.find((candidate) => candidate.id === selectedId) ?? projects[0] ?? null;
  const [member, setMember] = useState<Member>(initialMember);
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskBoardTaskPriority>("medium");
  const lastAutoSync = useRef<ProjectId | null>(null);

  const board = useEnvironmentQuery(
    environmentId && project
      ? taskBoardQuery({ environmentId, input: { projectId: project.id } })
      : null,
  );
  const runCreate = useAtomCommand(taskBoardCreate);
  const runClaim = useAtomCommand(taskBoardClaim);
  const runRelease = useAtomCommand(taskBoardRelease);
  const runComplete = useAtomCommand(taskBoardComplete);
  const runUpdate = useAtomCommand(taskBoardUpdate);
  const runSync = useAtomCommand(taskBoardSync);
  useLiveRefresh(board.refresh, {
    enabled: environmentId !== null && project !== null,
    key: `task-board:${environmentId}:${project?.id ?? "none"}`,
    intervalMs: 10_000,
  });

  const refreshAfter = <A, E>(result: AtomCommandResult<A, E>): boolean => {
    if (result._tag === "Failure") {
      setActionError(formatEnvironmentQueryError(result.cause));
      return false;
    }
    setActionError(null);
    board.refresh();
    return true;
  };

  useEffect(() => {
    if (
      !environmentId ||
      !project ||
      !board.data?.aiosConnected ||
      lastAutoSync.current === project.id
    )
      return;
    lastAutoSync.current = project.id;
    void runSync({ environmentId, input: { projectId: project.id, actor: member } }).then(
      refreshAfter,
    );
  }, [board.data?.aiosConnected, environmentId, member, project, runSync]);

  const tasks = board.data?.tasks ?? [];
  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter(
      (task) =>
        !query ||
        [
          task.title,
          task.description,
          task.claimedBy ?? "",
          task.completedBy ?? "",
          task.claimedAgent?.providerInstanceId ?? "",
          task.claimedAgent?.model ?? "",
          ...task.labels,
        ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [tasks, search]);

  const refresh = () => board.refresh();
  const onCreate = async () => {
    if (!environmentId || !project || !title.trim()) return;
    const result = await runCreate({
      environmentId,
      input: {
        projectId: project.id,
        title: title.trim(),
        description: description.trim(),
        priority,
        actor: member,
      },
    });
    if (!refreshAfter(result)) return;
    setTitle("");
    setDescription("");
    setShowCreate(false);
  };
  const onSync = async () => {
    if (!environmentId || !project) return;
    refreshAfter(await runSync({ environmentId, input: { projectId: project.id, actor: member } }));
  };
  const onClaim = async (task: TaskBoardTask) => {
    if (!environmentId || !project) return;
    refreshAfter(
      await runClaim({
        environmentId,
        input: { projectId: project.id, taskId: task.id, actor: member },
      }),
    );
  };
  const onRelease = async (task: TaskBoardTask) => {
    if (!environmentId || !project) return;
    refreshAfter(
      await runRelease({
        environmentId,
        input: { projectId: project.id, taskId: task.id, actor: member },
      }),
    );
  };
  const onComplete = async (task: TaskBoardTask) => {
    if (!environmentId || !project) return;
    refreshAfter(
      await runComplete({
        environmentId,
        input: { projectId: project.id, taskId: task.id, actor: member },
      }),
    );
  };
  const onReopen = async (task: TaskBoardTask) => {
    if (!environmentId || !project) return;
    refreshAfter(
      await runUpdate({
        environmentId,
        input: {
          projectId: project.id,
          taskId: task.id,
          actor: member,
          status: "todo",
          note: "Reopened task",
        },
      }),
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="task-project">
          Project
        </label>
        <select
          id="task-project"
          className="h-9 min-w-48 rounded-md border border-input bg-background px-2 text-sm"
          value={project?.id ?? ""}
          onChange={(event) => setSelectedId(event.target.value as ProjectId)}
        >
          {projects.length === 0 && <option value="">No projects available</option>}
          {projects.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.title}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="task-member">
          Person
        </label>
        <select
          id="task-member"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={member}
          onChange={(event) => {
            const next = event.target.value as Member;
            setMember(next);
            window.localStorage.setItem("leonidas-task-board-member", next);
          }}
        >
          <option>Jake</option>
          <option>Mob</option>
        </select>
        <span className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={onSync}
          disabled={!project || board.isPending}
          title="Sync matching cards with this environment's AIOS tasks folder"
        >
          <FolderSyncIcon /> Sync AIOS
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => setShowCreate((value) => !value)}
          disabled={!project}
        >
          <PlusIcon /> New task
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={refresh}
          disabled={!project || board.isPending}
          aria-label="Refresh tasks"
        >
          <RefreshCwIcon className={board.isPending ? "animate-spin" : ""} />
        </Button>
      </div>

      {showCreate && (
        <form
          className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void onCreate();
          }}
        >
          <Input
            aria-label="Task title"
            autoFocus
            placeholder="Task title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <select
            aria-label="Priority"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={priority}
            onChange={(event) => setPriority(event.target.value as TaskBoardTaskPriority)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <textarea
            aria-label="Task details"
            className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm sm:col-span-2"
            placeholder="Description and acceptance criteria"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!title.trim()}>
              Create task
            </Button>
          </div>
        </form>
      )}

      <Input
        aria-label="Filter tasks"
        placeholder="Filter title, description, owner, model, or label…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {board.isPending
          ? "Refreshing tasks…"
          : board.data
            ? `${board.data.summary.total} tasks · ${board.data.summary.inProgress} active · ${board.data.summary.done} complete${board.data.aiosConnected ? " · AIOS tasks linked" : ""}`
            : project
              ? "Loading project board…"
              : "Choose a GitHub-backed project to begin."}
      </p>
      {board.error && (
        <p role="alert" className="text-sm text-destructive">
          {board.error}
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}
      {board.data && !board.data.aiosConnected && (
        <p role="status" className="text-sm text-muted-foreground">
          Shared tasks are ready. Set LEONIDAS_AIOS_ROOT on this server to link its global AIOS
          tasks folder.
        </p>
      )}
      {project && !project.repositoryIdentity && (
        <p role="status" className="text-sm text-muted-foreground">
          Connect this project to its GitHub repository to enable shared tasks.
        </p>
      )}
      {board.data && filteredTasks.length === 0 && (
        <p
          role="status"
          className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
        >
          {search
            ? "No tasks match this filter."
            : "No tasks yet. AIOS cards sync when you select this project; you can also create a task."}
        </p>
      )}

      <ul aria-label="Project tasks" className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {filteredTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            actor={member}
            onClaim={() => void onClaim(task)}
            onRelease={() => void onRelease(task)}
            onComplete={() => void onComplete(task)}
            onReopen={() => void onReopen(task)}
          />
        ))}
      </ul>
      <footer className="flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
        <span>
          {project
            ? `${project.title}${board.data ? ` · ${board.data.repository}` : ""}`
            : "No project selected"}
        </span>
        {board.data?.repository && (
          <a
            className="inline-flex items-center gap-1 hover:underline"
            href={`https://github.com/${board.data.repository}/issues`}
            target="_blank"
            rel="noreferrer"
          >
            GitHub issues <ExternalLinkIcon className="size-3" />
          </a>
        )}
      </footer>
    </div>
  );
}

function TaskRow({
  task,
  actor,
  onClaim,
  onRelease,
  onComplete,
  onReopen,
}: {
  task: TaskBoardTask;
  actor: Member;
  onClaim: () => void;
  onRelease: () => void;
  onComplete: () => void;
  onReopen: () => void;
}) {
  const agentText = task.claimedAgent
    ? [
        task.claimedAgent.providerInstanceId,
        task.claimedAgent.model,
        ...(task.claimedAgent.options ?? []).map((option) => `${option.id}: ${option.value}`),
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  const statusLabel =
    task.status === "in_progress"
      ? "In progress"
      : task.status === "done"
        ? "Done"
        : task.status === "blocked"
          ? "Blocked"
          : "To do";
  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge variant={task.status === "done" ? "secondary" : "outline"}>{statusLabel}</Badge>
            <Badge variant="outline">{task.priority}</Badge>
            {task.claimedBy && (
              <Badge variant="secondary">
                Working: {task.claimedBy}
                {agentText ? ` · ${agentText}` : ""}
              </Badge>
            )}
            {task.completedBy && <Badge variant="secondary">Completed by {task.completedBy}</Badge>}
            {task.issueUrl && (
              <a
                className="text-xs text-muted-foreground underline"
                href={task.issueUrl}
                target="_blank"
                rel="noreferrer"
              >
                Issue #{task.sourceId}
              </a>
            )}
          </div>
          <h3 className="break-words text-sm font-medium">{task.title}</h3>
          {task.description && (
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
              {task.description}
            </p>
          )}
          {task.labels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {task.labels.map((label) => (
                <Badge key={label} variant="outline">
                  {label}
                </Badge>
              ))}
            </div>
          )}
          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer">Work history ({task.history.length})</summary>
            <ol className="mt-2 space-y-2 border-l border-border pl-3">
              {task.history.toReversed().map((event) => (
                <li key={event.id}>
                  <strong className="font-medium text-foreground">{event.actor}</strong>{" "}
                  {event.action.replaceAll("_", " ")} · {new Date(event.timestamp).toLocaleString()}
                  {event.agent?.providerInstanceId ? ` · ${event.agent.providerInstanceId}` : ""}
                  {event.agent?.model ? ` · ${event.agent.model}` : ""}
                  {event.note ? ` — ${event.note}` : ""}
                  {event.agent?.threadId ? ` · thread ${event.agent.threadId}` : ""}
                </li>
              ))}
            </ol>
            {task.completionSummary && <p className="mt-2">Completion: {task.completionSummary}</p>}
          </details>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          {task.status === "done" ? (
            <Button size="xs" variant="ghost" onClick={onReopen}>
              Reopen
            </Button>
          ) : (
            <>
              {task.claimedBy ? (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={onRelease}
                  disabled={task.claimedBy !== actor}
                >
                  Release
                </Button>
              ) : (
                <Button size="xs" variant="outline" onClick={onClaim}>
                  Claim
                </Button>
              )}
              <Button
                size="xs"
                variant="default"
                onClick={onComplete}
                disabled={Boolean(task.claimedBy && task.claimedBy !== actor)}
              >
                <CheckCircle2Icon /> Complete
              </Button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
