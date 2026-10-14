import type { EnvironmentId } from "@t3tools/contracts";
import { PlayIcon } from "lucide-react";
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
import { ComposerBanner } from "./ComposerBanner";
import { buildStartTaskPrompt } from "./startTaskPrompt";

function ProjectPicker(props: { environmentId: EnvironmentId; onFill: (prompt: string) => void }) {
  const workspace = useEnvironmentQuery(
    taskBoardWorkspaceQuery({ environmentId: props.environmentId, input: {} }),
  );
  const [slug, setSlug] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const project = workspace.data?.projects.find((item) => item.slug === slug);
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
  const error = workspace.error ?? shared.error;
  const pending = workspace.isPending || shared.isPending;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Start task</DialogTitle>
        <DialogDescription>
          Select a project. We will prepare a prompt from its tasks.
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
            {workspace.data?.projects
              .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
              .map((item) => (
                <Button
                  key={item.slug}
                  variant={slug === item.slug ? "secondary" : "ghost"}
                  onClick={() => setSlug(item.slug)}
                  aria-pressed={slug === item.slug}
                >
                  {item.name}
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
          {workspace.data?.projects.length === 0 ? (
            <p>No projects found. Add a project to your task workspace.</p>
          ) : null}
          {project && !pending && !error ? (
            <p>
              {tasks.length === 0
                ? "This project has no tasks. Add a task on the Tasks page."
                : `${tasks.length} tasks loaded. The agent will select an available task.`}
            </p>
          ) : null}
          <Button
            disabled={
              !project || !workspace.isSuccess || pending || error !== null || tasks.length === 0
            }
            onClick={() => {
              if (project) props.onFill(buildStartTaskPrompt(project, tasks));
            }}
          >
            Prepare prompt
          </Button>
        </div>
      </DialogPanel>
    </>
  );
}

export const ComposerNextActionBadge = memo(function ComposerNextActionBadge(props: {
  alignRight: boolean;
  environmentId: EnvironmentId;
  onFill: (prompt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ComposerBanner.Root
        density="comfortable"
        width="content"
        data-composer-shoulder-tab
        className={props.alignRight ? "ml-auto" : undefined}
      >
        <ComposerBanner.Row
          render={<button type="button" />}
          data-tour="composer-next-action"
          aria-label="Start task: select a project"
          className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => setOpen(true)}
        >
          <ComposerBanner.Icon>
            <PlayIcon />
          </ComposerBanner.Icon>
          <ComposerBanner.Content>Start task</ComposerBanner.Content>
        </ComposerBanner.Row>
      </ComposerBanner.Root>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup>
          {open ? (
            <ProjectPicker
              environmentId={props.environmentId}
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
