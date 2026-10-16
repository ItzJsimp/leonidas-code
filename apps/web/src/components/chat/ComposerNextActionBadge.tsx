import type { EnvironmentId, TaskBoardWorkspaceProject } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { ListTodoIcon } from "lucide-react";
import { memo, useMemo, useState } from "react";

import { useEnvironmentQuery } from "~/state/query";
import { taskBoardWorkspaceQuery } from "~/state/taskBoard";
import { mergeTasks } from "../taskBoard/taskBoard.logic";
import { useSharedBoards } from "../taskBoard/useSharedBoards";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { useFocusWidgetStore } from "../focus/focusWidgetStore";
import { ComposerBanner } from "./ComposerBanner";
import {
  buildStartTaskPrompt,
  detectStartTaskProject,
  rankStartTaskCandidates,
  START_TASK_CANDIDATE_LIMIT,
} from "./startTaskPrompt";

const EMPTY_PROJECTS: ReadonlyArray<TaskBoardWorkspaceProject> = [];

function ProjectPicker(props: {
  environmentId: EnvironmentId;
  activeProjectId: string | null;
  cwd: string | null;
  onFill: (prompt: string) => void;
}) {
  const workspace = useEnvironmentQuery(
    taskBoardWorkspaceQuery({ environmentId: props.environmentId, input: {} }),
  );
  // null means "use the detected project" until the user picks one.
  const [picked, setPicked] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const projects = workspace.data?.projects ?? EMPTY_PROJECTS;
  const detected = useMemo(
    () => detectStartTaskProject(projects, { projectId: props.activeProjectId, cwd: props.cwd }),
    [projects, props.activeProjectId, props.cwd],
  );
  const slug = picked ?? detected?.slug ?? null;
  const project = projects.find((item) => item.slug === slug);
  const targets = useMemo(
    () =>
      project?.projectId && project.repository
        ? [{ slug: project.slug, projectId: project.projectId }]
        : [],
    [project],
  );
  const shared = useSharedBoards(props.environmentId, targets);
  const tasks = useMemo(
    () =>
      mergeTasks(workspace.data?.tasks ?? [], shared.tasks).filter((task) => task.section === slug),
    [workspace.data?.tasks, shared.tasks, slug],
  );
  const openCount = useMemo(() => rankStartTaskCandidates(tasks).length, [tasks]);
  const visibleProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = projects.filter((item) => item.name.toLowerCase().includes(needle));
    // The detected project first, then projects with the most open work.
    return matches.toSorted(
      (a, b) =>
        Number(b.slug === detected?.slug) - Number(a.slug === detected?.slug) || b.open - a.open,
    );
  }, [projects, query, detected?.slug]);
  const error = workspace.error ?? shared.error;
  const pending = workspace.isPending || shared.isPending;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Start task</DialogTitle>
        <DialogDescription>
          {detected
            ? "We chose the project for this chat. Select a different project if you need to."
            : "Select a project. We will paste a short prompt into the message box."}
        </DialogDescription>
      </DialogHeader>
      <DialogPanel>
        <div className="flex flex-col gap-3">
          <Input
            autoFocus
            aria-label="Search projects"
            placeholder="Search projects"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto" aria-label="Projects">
            {visibleProjects.map((item) => (
              <Button
                key={item.slug}
                variant={slug === item.slug ? "secondary" : "ghost"}
                className="justify-between"
                onClick={() => setPicked(item.slug)}
                aria-pressed={slug === item.slug}
              >
                <span className="truncate">{item.name}</span>
                <span className="text-muted-foreground text-xs">
                  {item.slug === detected?.slug ? "This chat · " : ""}
                  {item.open} open
                </span>
              </Button>
            ))}
          </div>
          {pending ? <p role="status">Loading tasks...</p> : null}
          {error ? (
            <>
              <p role="alert">{error}</p>
              <Button
                variant="outline"
                onClick={() => {
                  workspace.refresh();
                  shared.refresh();
                }}
              >
                Retry
              </Button>
            </>
          ) : null}
          {workspace.isSuccess && projects.length === 0 ? (
            <p>No projects found. Add a project to your task board.</p>
          ) : null}
          {project && !pending && !error ? (
            <p>
              {openCount === 0
                ? "This project has no open tasks. Add a task on the task board."
                : `${openCount} open tasks. The prompt lists the top ${Math.min(openCount, START_TASK_CANDIDATE_LIMIT)}, and the agent picks one.`}
            </p>
          ) : null}
          <Button
            disabled={
              !project || !workspace.isSuccess || pending || error !== null || openCount === 0
            }
            onClick={() => {
              if (project) props.onFill(buildStartTaskPrompt(project, tasks));
            }}
          >
            Paste prompt
          </Button>
        </div>
      </DialogPanel>
    </>
  );
}

/**
 * The composer's Notepad button: show or hide the notepad, start the next action from the
 * task board, or open the task board.
 */
export const ComposerNextActionBadge = memo(function ComposerNextActionBadge(props: {
  alignRight: boolean;
  environmentId: EnvironmentId;
  activeProjectId: string | null;
  cwd: string | null;
  /** False while the composer has text, so the next action cannot replace it. */
  canFill: boolean;
  onFill: (prompt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const focusVisible = useFocusWidgetStore((state) => state.visible);
  const setFocusVisible = useFocusWidgetStore((state) => state.setVisible);
  return (
    <>
      <Menu>
        <ComposerBanner.Root
          density="comfortable"
          width="content"
          data-composer-shoulder-tab
          className={props.alignRight ? "ml-auto" : undefined}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <MenuTrigger
                  render={<ComposerBanner.Row render={<button type="button" />} />}
                  data-tour="composer-next-action"
                  aria-label="Notepad: notes, next action and task board"
                  className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
                />
              }
            >
              <ComposerBanner.Icon>
                <ListTodoIcon />
              </ComposerBanner.Icon>
              <ComposerBanner.Content>Notepad</ComposerBanner.Content>
            </TooltipTrigger>
            <TooltipPopup side="top">Notepad, next action and task board</TooltipPopup>
          </Tooltip>
        </ComposerBanner.Root>
        <MenuPopup side="top" align="start">
          <MenuItem onClick={() => setFocusVisible(!focusVisible)}>
            {focusVisible ? "Hide notepad" : "Show notepad"}
          </MenuItem>
          <MenuItem disabled={!props.canFill} onClick={() => setOpen(true)}>
            {props.canFill ? "Start next action" : "Start next action (clear the message first)"}
          </MenuItem>
          <MenuItem onClick={() => void navigate({ to: "/tasks" })}>Open task board</MenuItem>
        </MenuPopup>
      </Menu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup>
          {open ? (
            <ProjectPicker
              environmentId={props.environmentId}
              activeProjectId={props.activeProjectId}
              cwd={props.cwd}
              onFill={(prompt) => {
                setOpen(false);
                props.onFill(prompt);
              }}
            />
          ) : null}
        </DialogPopup>
      </Dialog>
    </>
  );
});
