import { useState } from "react";
import { ListChecksIcon, RefreshCwIcon, ExternalLinkIcon } from "lucide-react";
import { TASK_BOARD_REPOSITORY, type EnvironmentId } from "@t3tools/contracts";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { taskBoardQuery } from "~/state/taskBoard";
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

const ISSUES_URL = `https://github.com/${TASK_BOARD_REPOSITORY}/issues`;

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
          <TooltipPopup side="top">Tasks: shared GitHub issue board</TooltipPopup>
        </Tooltip>
      </SidebarMenuItem>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup className="h-[min(85dvh,48rem)]">
          <DialogHeader>
            <DialogTitle>Tasks</DialogTitle>
            <DialogDescription>
              Open issues shared by Jake and Mob. GitHub is the source of truth.
            </DialogDescription>
          </DialogHeader>
          {open && <BoardContents key={environmentId} environmentId={environmentId} />}
        </DialogPopup>
      </Dialog>
    </>
  );
}

function BoardContents({ environmentId }: { environmentId: EnvironmentId | null }) {
  const board = useEnvironmentQuery(
    environmentId ? taskBoardQuery({ environmentId, input: {} }) : null,
  );
  const [search, setSearch] = useState("");
  useLiveRefresh(board.refresh, {
    enabled: environmentId !== null,
    key: `task-board:${environmentId}`,
    intervalMs: 10_000,
  });
  const query = search.trim().toLowerCase();
  const issues =
    board.data?.issues.filter((issue) =>
      [
        issue.title,
        String(issue.number),
        ...issue.labels.map((label) => label.name),
        ...issue.assignees.map((assignee) => assignee.login),
      ].some((value) => value.toLowerCase().includes(query)),
    ) ?? [];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          render={<a href={ISSUES_URL} target="_blank" rel="noreferrer" />}
          title="Open the shared issue list on GitHub"
        >
          <ExternalLinkIcon /> GitHub
        </Button>
        <Button
          variant="outline"
          size="sm"
          render={<a href={`${ISSUES_URL}/new`} target="_blank" rel="noreferrer" />}
          title="Create a shared task on GitHub"
        >
          New task
        </Button>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={board.refresh}
                disabled={!environmentId || board.isPending}
                aria-label="Refresh tasks"
              >
                <RefreshCwIcon />
              </Button>
            }
          />
          <TooltipPopup>Refresh shared tasks</TooltipPopup>
        </Tooltip>
      </div>
      <Input
        aria-label="Filter tasks"
        placeholder="Filter title, label or assignee..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="text-xs text-muted-foreground" aria-live="polite">
        {board.isPending
          ? "Refreshing tasks..."
          : board.data
            ? `${board.data.issues.length} open tasks · Checked ${new Date(board.data.checkedAt).toLocaleTimeString()} · Refreshes while you’re active`
            : board.error
              ? "Tasks unavailable"
              : environmentId
                ? "Loading tasks..."
                : "Server disconnected"}
      </div>
      {!environmentId && (
        <p role="status" className="text-sm text-muted-foreground">
          Connect to a Leonidas server to load shared tasks.
        </p>
      )}
      {board.error && (
        <p role="alert" className="text-sm text-destructive">
          {board.error}
          {board.data ? " Showing the last successful read." : ""}
        </p>
      )}
      {board.data && issues.length === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          {query
            ? "No tasks match this filter."
            : "No open tasks. Create one on GitHub to start the shared queue."}
        </p>
      )}
      <ul aria-label="Shared tasks" className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {issues.map((issue) => (
          <li key={issue.number} className="rounded-lg border border-border p-3">
            <a
              href={issue.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-sm text-sm font-medium break-words outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="text-muted-foreground">#{issue.number}</span> {issue.title}
            </a>
            {issue.labels.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {issue.labels.map((label) => (
                  <Badge
                    key={label.name}
                    variant="secondary"
                    size="sm"
                    title={`GitHub label: ${label.name}`}
                  >
                    {label.name}
                  </Badge>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {issue.assignees.length
                ? issue.assignees.map((assignee) => `@${assignee.login}`).join(", ")
                : "Unassigned"}
            </p>
          </li>
        ))}
      </ul>
      {board.data && board.data.issues.length >= board.data.limit && (
        <p className="text-xs text-muted-foreground">
          Showing the first {board.data.limit} open issues. Open GitHub for the full queue.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Agents add tasks with <code>gh issue create --repo {TASK_BOARD_REPOSITORY}</code>.
      </p>
    </div>
  );
}
