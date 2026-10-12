import {
  squashAtomCommandFailure,
  isAtomCommandInterrupted,
} from "@t3tools/client-runtime/state/runtime";
import type {
  EnvironmentId,
  TaskBoardTaskPriority,
  TaskBoardWorkspaceProject,
} from "@t3tools/contracts";
import { useId, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { taskBoardCardCreate } from "~/state/taskBoard";
import { useAtomCommand } from "~/state/use-atom-command";

import { priorityLabel } from "./taskBoard.logic";
import { failureText } from "./useTaskActions.logic";

const NO_PROJECT = "__no-project__";
const PRIORITIES: ReadonlyArray<TaskBoardTaskPriority> = ["low", "medium", "high", "critical"];
const PRIORITY_ITEMS = Object.fromEntries(
  PRIORITIES.map((priority) => [priority, priorityLabel(priority)]),
);

/** Creates a new AIOS task card. The form resets every time the dialog opens. */
export function TaskCreateDialog(props: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly environmentId: EnvironmentId | null;
  readonly member: string;
  readonly projects: ReadonlyArray<TaskBoardWorkspaceProject>;
  /** The project section selected on the page; preselected in the form. */
  readonly defaultSlug: string | null;
  readonly onCreated: () => void;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPopup>
        <TaskCreateForm {...props} />
      </DialogPopup>
    </Dialog>
  );
}

function TaskCreateForm(props: {
  readonly onOpenChange: (open: boolean) => void;
  readonly environmentId: EnvironmentId | null;
  readonly member: string;
  readonly projects: ReadonlyArray<TaskBoardWorkspaceProject>;
  readonly defaultSlug: string | null;
  readonly onCreated: () => void;
}) {
  const { environmentId, member, projects, onCreated, onOpenChange } = props;
  const id = useId();
  const runCreate = useAtomCommand(taskBoardCardCreate, { reportFailure: false });
  const projectItems = useMemo(
    () => ({
      [NO_PROJECT]: "No project",
      ...Object.fromEntries(
        projects.filter((project) => project.slug !== "general").map((p) => [p.slug, p.name]),
      ),
    }),
    [projects],
  );
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState<TaskBoardTaskPriority>("medium");
  const [projectSlug, setProjectSlug] = useState(
    props.defaultSlug && props.defaultSlug in projectItems ? props.defaultSlug : NO_PROJECT,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = title.trim().length > 0 && environmentId !== null && !submitting;

  const submit = async () => {
    if (!canSubmit || environmentId === null) return;
    setSubmitting(true);
    setError(null);
    const result = await runCreate({
      environmentId,
      input: {
        title: title.trim(),
        ...(details.trim() ? { description: details.trim() } : {}),
        priority,
        projectSlug: projectSlug === NO_PROJECT ? null : projectSlug,
        actor: member,
      },
    });
    setSubmitting(false);
    if (result._tag === "Success") {
      onCreated();
      onOpenChange(false);
      return;
    }
    if (!isAtomCommandInterrupted(result)) {
      setError(failureText(squashAtomCommandFailure(result), "Could not create the task."));
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <form className="contents" onSubmit={onSubmit} onKeyDown={onKeyDown}>
      <DialogHeader>
        <DialogTitle>New task</DialogTitle>
        <DialogDescription>
          Saved as a task card in your AIOS folder. Press Ctrl+Enter to create it.
        </DialogDescription>
      </DialogHeader>
      <DialogPanel>
        <div className="flex flex-col gap-4">
          <Label className="flex flex-col items-stretch" htmlFor={`${id}-title`}>
            Title
            <Input
              id={`${id}-title`}
              autoFocus
              placeholder="What needs doing?"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Label>
          <Label className="flex flex-col items-stretch" htmlFor={`${id}-details`}>
            Details
            <Textarea
              id={`${id}-details`}
              placeholder="Context and what done looks like (optional)"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
            />
          </Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Label className="flex min-w-0 flex-col items-stretch" htmlFor={`${id}-priority`}>
              Priority
              <Select
                value={priority}
                items={PRIORITY_ITEMS}
                onValueChange={(value) => {
                  if (PRIORITIES.includes(value as TaskBoardTaskPriority)) {
                    setPriority(value as TaskBoardTaskPriority);
                  }
                }}
              >
                <SelectTrigger id={`${id}-priority`} className="min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {PRIORITIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {priorityLabel(value)}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </Label>
            <Label className="flex min-w-0 flex-col items-stretch" htmlFor={`${id}-project`}>
              Project
              <Select
                value={projectSlug}
                items={projectItems}
                onValueChange={(value) => {
                  if (typeof value === "string") setProjectSlug(value);
                }}
              >
                <SelectTrigger id={`${id}-project`} className="min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {Object.entries(projectItems).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </Label>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </DialogPanel>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {submitting ? <Spinner /> : null}
          Create task
        </Button>
      </DialogFooter>
    </form>
  );
}
