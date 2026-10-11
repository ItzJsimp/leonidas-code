import { useMemo, useState } from "react";
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  FolderSyncIcon,
  ListChecksIcon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react";
import {
  type EnvironmentId,
  type ProjectId,
  type TaskBoardTask,
  type TaskBoardTaskPriority,
} from "@t3tools/contracts";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
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

function initialMember(): string {
  if (typeof window === "undefined") return "Jake";
  return window.localStorage.getItem("leonidas-task-board-member") ?? "Jake";
}

export function TaskBoardPanel() {
  const [open, setOpen] = useState(false);
  const environmentId = usePrimaryEnvironmentId();
  return (
    <>
      <SidebarMenuItem className="shrink-0">
        <Tooltip>
          <TooltipTrigger
            render={<SidebarMenuButton size="icon" aria-label="Tasks" onClick={() => setOpen(true)}>
              <ListChecksIcon />
            </SidebarMenuButton>}
          />
          <TooltipPopup side="top">Shared project tasks</TooltipPopup>
        </Tooltip>
      </SidebarMenuItem>
      {open && <TaskBoardContents environmentId={environmentId} onClose={() => setOpen(false)} />}
    </>
  );
}

function TaskBoardContents({
  environmentId,
  onClose,
}: {
  environmentId: EnvironmentId | null;
  onClose: () => void;
}) {
  const projects = useProjects().filter((project) => project.environmentId === environmentId);
  const [selectedId, setSelectedId] = useState<ProjectId | null>(null);
  const project = projects.find((candidate) => candidate.id === selectedId) ?? projects[0] ?? null;
  const [member, setMember] = useState(initialMember);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskBoardTaskPriority>("medium");

  const board = useEnvironmentQuery(
    environmentId && project ? taskBoardQuery({ environmentId, input: { projectId: project.id } }) : null,
  );
  const runCreate = useAtomCommand(taskBoardCreate, { reportFailure: false });
  const runClaim = useAtomCommand(taskBoardClaim, { reportFailure: false });
  const runRelease = useAtomCommand(taskBoardRelease, { reportFailure: false });
  const runComplete = useAtomCommand(taskBoardComplete, { reportFailure: false });
  const runUpdate = useAtomCommand(taskBoardUpdate, { reportFailure: false });
  const runSync = useAtomCommand(taskBoardSync, { reportFailure: false });
  useLiveRefresh(board.refresh, {
    enabled: environmentId !== null && project !== null,
    key: `task-board:${environmentId}:${project?.id ?? "none"}`,
    intervalMs: 10_000,
  });

  const tasks = board.data?.tasks ?? [];
  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) =>
      !query || [
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

  const actor = member.trim() || "Unknown";
  const refresh = () => board.refresh();
  const onCreate = async () => {
    if (!environmentId || !project || !title.trim()) return;
    await runCreate({ environmentId, input: { projectId: project.id, title: title.trim(), description: description.trim(), priority, actor } });
    setTitle("");
    setDescription("");
    setShowCreate(false);
    refresh();
  };
  const onSync = async () => {
    if (!environmentId || !project) return;
    await runSync({ environmentId, input: { projectId: project.id, actor } });
    refresh();
  };
  const onClaim = async (task: TaskBoardTask) => {
    if (!environmentId || !project) return;
    await runClaim({ environmentId, input: { projectId: project.id, taskId: task.id, actor } });
    refresh();
  };
  const onRelease = async (task: TaskBoardTask) => {
    if (!environmentId || !project) return;
    await runRelease({ environmentId, input: { projectId: project.id, taskId: task.id, actor } });
    refresh();
  };
  const onComplete = async (task: TaskBoardTask) => {
    if (!environmentId || !project) return;
    await runComplete({ environmentId, input: { projectId: project.id, taskId: task.id, actor } });
    refresh();
  };
  const onReopen = async (task: TaskBoardTask) => {
    if (!environmentId || !project) return;
    await runUpdate({ environmentId, input: { projectId: project.id, taskId: task.id, actor, status: "todo", note: "Reopened task" } });
    refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="task-board-title" className="flex h-[min(88dvh,54rem)] w-full max-w-4xl flex-col gap-4 overflow-hidden rounded-xl border border-border bg-background p-5 shadow-xl">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="task-board-title" className="flex items-center gap-2 text-lg font-semibold"><ListChecksIcon className="size-5" /> Project tasks</h2>
            <p className="mt-1 text-sm text-muted-foreground">Shared across environments through the project’s GitHub repository.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="task-project">Project</label>
          <select id="task-project" className="h-9 min-w-48 rounded-md border border-input bg-background px-2 text-sm" value={project?.id ?? ""} onChange={(event) => setSelectedId(event.target.value as ProjectId)}>
            {projects.length === 0 && <option value="">No projects available</option>}
            {projects.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}
          </select>
          <label className="sr-only" htmlFor="task-member">Your name</label>
          <select id="task-member" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={member} onChange={(event) => { setMember(event.target.value); window.localStorage.setItem("leonidas-task-board-member", event.target.value); }}>
            <option>Jake</option><option>Mob</option>
          </select>
          <span className="flex-1" />
          <Button variant="outline" size="sm" onClick={onSync} disabled={!project || board.isPending} title="Import matching cards from this machine’s AIOS task folder"><FolderSyncIcon /> Sync AIOS</Button>
          <Button variant="default" size="sm" onClick={() => setShowCreate((value) => !value)} disabled={!project}><PlusIcon /> New task</Button>
          <Button variant="ghost" size="icon-sm" onClick={refresh} disabled={!project || board.isPending} aria-label="Refresh tasks"><RefreshCwIcon className={board.isPending ? "animate-spin" : ""} /></Button>
        </div>

        {showCreate && (
          <form className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_auto]" onSubmit={(event) => { event.preventDefault(); void onCreate(); }}>
            <Input aria-label="Task title" autoFocus placeholder="Task title" value={title} onChange={(event) => setTitle(event.target.value)} />
            <select aria-label="Priority" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={priority} onChange={(event) => setPriority(event.target.value as TaskBoardTaskPriority)}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
            </select>
            <textarea aria-label="Task details" className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm sm:col-span-2" placeholder="Description and acceptance criteria" value={description} onChange={(event) => setDescription(event.target.value)} />
            <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button><Button type="submit" size="sm" disabled={!title.trim()}>Create task</Button></div>
          </form>
        )}

        <Input aria-label="Filter tasks" placeholder="Filter title, description, owner, model, or label…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {board.isPending ? "Refreshing tasks…" : board.data ? `${board.data.summary.total} tasks · ${board.data.summary.inProgress} active · ${board.data.summary.done} complete${board.data.aiosConnected ? " · AIOS folder detected" : ""}` : project ? "Loading project board…" : "Choose a project with a GitHub repository to begin."}
        </p>
        {board.error && <p role="alert" className="text-sm text-destructive">{board.error}</p>}
        {board.data && !board.data.aiosConnected && <p role="status" className="text-sm text-muted-foreground">Shared tasks work now. Set LEONIDAS_AIOS_ROOT on this server to connect its global AIOS task folder.</p>}
        {project && !project.repositoryIdentity && <p role="status" className="text-sm text-muted-foreground">Waiting for this project’s GitHub repository identity.</p>}
        {board.data && filteredTasks.length === 0 && <p role="status" className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{search ? "No tasks match this filter." : "No tasks yet. Sync AIOS cards or create a task."}</p>}

        <ul aria-label="Project tasks" className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {filteredTasks.map((task) => <TaskRow key={task.id} task={task} actor={actor} onClaim={() => void onClaim(task)} onRelease={() => void onRelease(task)} onComplete={() => void onComplete(task)} onReopen={() => void onReopen(task)} />)}
        </ul>
        <footer className="flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
          <span>{project ? `${project.title}${board.data ? ` · ${board.data.repository}` : ""}` : "No project selected"}</span>
          {board.data?.issues[0] && <a className="inline-flex items-center gap-1 hover:underline" href={`https://github.com/${board.data.repository}/issues`} target="_blank" rel="noreferrer">GitHub issues <ExternalLinkIcon className="size-3" /></a>}
        </footer>
      </section>
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
  actor: string;
  onClaim: () => void;
  onRelease: () => void;
  onComplete: () => void;
  onReopen: () => void;
}) {
  const agentText = task.claimedAgent
    ? [task.claimedAgent.providerInstanceId, task.claimedAgent.model, ...(task.claimedAgent.options ?? []).map((option) => `${option.id}: ${option.value}`)].filter(Boolean).join(" · ")
    : null;
  const statusLabel = task.status === "in_progress" ? "In progress" : task.status === "done" ? "Done" : task.status === "blocked" ? "Blocked" : "To do";
  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge variant={task.status === "done" ? "secondary" : "outline"}>{statusLabel}</Badge>
            <Badge variant="outline">{task.priority}</Badge>
            {task.claimedBy && <Badge variant="secondary">Working: {task.claimedBy}{agentText ? ` · ${agentText}` : ""}</Badge>}
            {task.completedBy && <Badge variant="secondary">Completed by {task.completedBy}</Badge>}
            {task.issueUrl && <a className="text-xs text-muted-foreground underline" href={task.issueUrl} target="_blank" rel="noreferrer">Issue #{task.sourceId}</a>}
          </div>
          <h3 className="break-words text-sm font-medium">{task.title}</h3>
          {task.description && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{task.description}</p>}
          {task.labels.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{task.labels.map((label) => <Badge key={label} variant="outline">{label}</Badge>)}</div>}
          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer">History ({task.history.length})</summary>
            <ol className="mt-2 space-y-1 border-l border-border pl-3">
              {task.history.toReversed().map((event) => <li key={event.id}><strong className="font-medium text-foreground">{event.actor}</strong> {event.action.replaceAll("_", " ")} · {new Date(event.timestamp).toLocaleString()}{event.note ? ` — ${event.note}` : ""}{event.agent?.model ? ` (${event.agent.model})` : ""}</li>)}
            </ol>
            {task.completionSummary && <p className="mt-2">Completion: {task.completionSummary}</p>}
          </details>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          {task.status === "done" ? <Button size="xs" variant="ghost" onClick={onReopen}>Reopen</Button> : <>
            {task.claimedBy ? <Button size="xs" variant="ghost" onClick={onRelease} disabled={task.claimedBy !== actor}>Release</Button> : <Button size="xs" variant="outline" onClick={onClaim}>Claim</Button>}
            <Button size="xs" variant="default" onClick={onComplete} disabled={Boolean(task.claimedBy && task.claimedBy !== actor)}><CheckCircle2Icon /> Complete</Button>
          </>}
        </div>
      </div>
    </li>
  );
}
