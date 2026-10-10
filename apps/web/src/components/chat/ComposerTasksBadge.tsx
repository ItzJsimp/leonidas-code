import { CheckIcon, CircleDotIcon, CircleIcon, ListTodoIcon } from "lucide-react";
import { memo, type ComponentProps } from "react";

import { formatDuration } from "../../session-logic";
import { cn } from "~/lib/utils";
import { ComposerBanner } from "./ComposerBanner";
import { AgentElapsed } from "./AgentElapsed";
import { Button } from "../ui/button";
import type { deriveAgentActivity } from "../../agentActivity";

export interface ComposerTasksProgress {
  readonly step: string;
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly activity?: ReturnType<typeof deriveAgentActivity> & {
    readonly startedAt: string | null;
    readonly onOpenFile: (path: string) => void;
  };
}

export interface ComposerTaskStep {
  readonly durationMs?: number;
  readonly step: string;
  readonly status: "pending" | "inProgress" | "completed";
}

const MAX_TASK_SEGMENTS = 10;

const taskStatusLabels = {
  pending: "Pending",
  inProgress: "Running",
  completed: "Completed",
} satisfies Record<ComposerTaskStep["status"], string>;

function keyedTaskSteps(steps: readonly ComposerTaskStep[]) {
  const occurrences = new Map<string, number>();
  return steps.map((step) => {
    const occurrence = occurrences.get(step.step) ?? 0;
    occurrences.set(step.step, occurrence + 1);
    return { key: `${step.step}:${occurrence}`, step };
  });
}

function TaskSegments({
  className,
  steps,
}: {
  readonly className?: string;
  readonly steps: readonly ComposerTaskStep[];
}) {
  if (steps.length <= 1 || steps.length > MAX_TASK_SEGMENTS) return null;

  return (
    <span aria-hidden className={cn("flex w-10 shrink-0 items-center gap-0.5", className)}>
      {keyedTaskSteps(steps).map(({ key, step }) => (
        <span
          key={key}
          className={cn(
            "h-[3px] min-w-0 flex-1 rounded-full",
            step.status === "completed"
              ? "bg-success"
              : step.status === "inProgress"
                ? "bg-primary"
                : "bg-muted-foreground/25",
          )}
        />
      ))}
    </span>
  );
}

function TaskSummary({
  expanded,
  progress,
  steps,
}: {
  readonly expanded: boolean;
  readonly progress: ComposerTasksProgress;
  readonly steps: readonly ComposerTaskStep[];
}) {
  return (
    <>
      <ComposerBanner.Icon>
        <ListTodoIcon />
      </ComposerBanner.Icon>
      <ComposerBanner.Content>
        <span className="shrink-0 text-muted-foreground">Activity</span>
        <span
          className="min-w-0 flex-1 truncate text-left font-medium text-foreground/80"
          data-composer-task-current="true"
        >
          {progress.step}
        </span>
      </ComposerBanner.Content>
      <ComposerBanner.Actions>
        {progress.activity?.startedAt ? (
          <AgentElapsed
            compact
            agent={{ status: "running", startedAt: progress.activity.startedAt, completedAt: null }}
          />
        ) : null}
        {progress.totalSteps > 0 ? (
          <ComposerBanner.Count
            className={progress.completedSteps >= progress.totalSteps ? "text-success" : undefined}
            data-composer-task-progress="true"
          >
            {progress.activity?.currentStep ?? progress.completedSteps}/{progress.totalSteps}
          </ComposerBanner.Count>
        ) : null}
        <TaskSegments className="hidden w-20 @min-[560px]:flex" steps={steps} />
        <ComposerBanner.ToggleIcon expanded={expanded} />
      </ComposerBanner.Actions>
    </>
  );
}

export const ComposerTasksBadge = memo(function ComposerTasksBadge({
  expanded,
  onToggle,
  placement = "tab",
  progress,
  steps,
}: {
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly placement?: "inline" | "tab";
  readonly progress: ComposerTasksProgress;
  readonly steps: readonly ComposerTaskStep[];
}) {
  if (progress.totalSteps <= 0 && !progress.activity) return null;

  const row = (
    <ComposerBanner.Row
      render={<button type="button" />}
      aria-expanded={expanded}
      aria-label={`${expanded ? "Collapse activity" : "Expand activity"}. ${progress.totalSteps > 0 ? `${progress.completedSteps} of ${progress.totalSteps} complete.` : "No plan published."} Current task: ${progress.step}`}
      data-composer-tasks-badge="true"
      onClick={onToggle}
      onPointerDown={(event) => event.preventDefault()}
    >
      <TaskSummary expanded={expanded} progress={progress} steps={steps} />
    </ComposerBanner.Row>
  );
  const summary = (
    <div className="flex min-w-0 items-center">
      <div className="min-w-0 flex-1">{row}</div>
      {progress.activity?.files.at(-1) ? (
        <div className="max-w-28 shrink-0 pe-2">
          <Button
            size="xs"
            variant="ghost"
            title={progress.activity.files.at(-1)}
            onClick={() => progress.activity?.onOpenFile(progress.activity.files.at(-1)!)}
          >
            <span className="truncate">
              {progress.activity.files.at(-1)!.split(/[/\\]/).at(-1)}
            </span>
          </Button>
        </div>
      ) : null}
    </div>
  );
  return placement === "inline" ? (
    summary
  ) : (
    <ComposerBanner.Root density="comfortable" data-composer-shoulder-tab>
      {summary}
    </ComposerBanner.Root>
  );
});

export const ComposerTasksContent = memo(function ComposerTasksContent({
  expanded,
  onToggle,
  progress,
  steps,
}: {
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly progress: ComposerTasksProgress;
  readonly steps: readonly ComposerTaskStep[];
}) {
  return (
    <div
      data-chat-composer-collapsed-controls="true"
      data-chat-composer-tasks-drawer={expanded ? "true" : undefined}
    >
      <ComposerTasksBadge
        expanded={expanded}
        onToggle={onToggle}
        placement="inline"
        progress={progress}
        steps={steps}
      />
      {expanded ? (
        <ComposerBanner.Scroll data-composer-tasks-scroll="true">
          <ComposerBanner.Children
            render={<ul role="list" />}
            aria-label={`Task list. ${progress.completedSteps} of ${progress.totalSteps} complete.`}
            data-composer-tasks-list="true"
          >
            {keyedTaskSteps(steps).map(({ key, step }) => (
              <ComposerBanner.Row key={key} render={<li />} className="items-start py-1 pe-2">
                <ComposerBanner.Icon
                  className={cn(
                    "h-4",
                    step.status === "completed"
                      ? "text-success"
                      : step.status === "inProgress"
                        ? "text-primary"
                        : "text-muted-foreground/40",
                  )}
                >
                  {step.status === "completed" ? (
                    <CheckIcon />
                  ) : step.status === "inProgress" ? (
                    <CircleDotIcon />
                  ) : (
                    <CircleIcon />
                  )}
                </ComposerBanner.Icon>
                <ComposerBanner.Content
                  className={cn(
                    "block wrap-anywhere",
                    step.status === "completed"
                      ? "text-muted-foreground/55"
                      : step.status === "inProgress"
                        ? "text-foreground/90"
                        : "text-muted-foreground/70",
                  )}
                >
                  <span className="sr-only">{taskStatusLabels[step.status]}: </span>
                  {step.step}
                </ComposerBanner.Content>
                <ComposerBanner.Actions>
                  <span
                    className="w-12 text-right text-3xs/4 text-muted-foreground/45 tabular-nums"
                    data-composer-task-duration="true"
                  >
                    {step.durationMs !== undefined
                      ? formatDuration(step.durationMs)
                      : step.status === "inProgress"
                        ? "now"
                        : null}
                  </span>
                </ComposerBanner.Actions>
              </ComposerBanner.Row>
            ))}
          </ComposerBanner.Children>
          {progress.activity ? (
            <div className="space-y-2 px-3 pb-3 text-xs text-muted-foreground">
              <p>
                {progress.totalSteps === 0
                  ? "No plan published yet."
                  : progress.activity.finishing
                    ? "Finishing the last step"
                    : `${progress.activity.remaining} steps remaining`}
              </p>
              {progress.activity.tool ? <p>Current tool: {progress.activity.tool}</p> : null}
              {progress.activity.explanation ? <p>{progress.activity.explanation}</p> : null}
              {steps.some((step) => step.status === "pending") ? (
                <p>Next: {steps.find((step) => step.status === "pending")?.step}</p>
              ) : null}
              {progress.activity.files.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {progress.activity.files.map((path) => (
                    <Button
                      key={path}
                      size="xs"
                      variant="outline"
                      onClick={() => progress.activity?.onOpenFile(path)}
                    >
                      {path}
                    </Button>
                  ))}
                </div>
              ) : null}
              {progress.activity.notes.length > 0 ? (
                <details key={progress.activity.startedAt}>
                  <summary className="cursor-pointer focus-visible:outline-2">
                    Show action notes
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {progress.activity.notes.map((note, index) => (
                      <li key={index}>{note}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </ComposerBanner.Scroll>
      ) : null}
    </div>
  );
});

export const ComposerTasksDrawer = memo(function ComposerTasksDrawer({
  onCollapse,
  ...props
}: Omit<ComponentProps<typeof ComposerTasksContent>, "expanded" | "onToggle"> & {
  readonly onCollapse: () => void;
}) {
  return (
    <ComposerBanner.Attachment>
      <ComposerBanner.Root>
        <ComposerTasksContent {...props} expanded onToggle={onCollapse} />
      </ComposerBanner.Root>
    </ComposerBanner.Attachment>
  );
});
