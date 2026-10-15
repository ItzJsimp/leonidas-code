import { CheckIcon, CircleDotIcon, CircleIcon, ListTodoIcon } from "lucide-react";
import { memo, type ComponentProps } from "react";

import { formatDuration } from "../../session-logic";
import { cn } from "~/lib/utils";
import { ComposerBanner } from "./ComposerBanner";
import { AgentElapsed } from "./AgentElapsed";
import { Button } from "../ui/button";
import type { AgentActivity } from "../../agentActivity";
import {
  ActivityCounters,
  ActivityDetails,
  ActivityKindIcon,
  WaitingKindIcon,
} from "./ComposerActivityDetails";

export interface ComposerTasksProgress {
  readonly step: string;
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly activity?: AgentActivity & {
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
const MAX_FILE_CHIPS = 3;

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
  const waiting = progress.activity?.waiting[0];
  const extraWaits = (progress.activity?.waiting.length ?? 0) - 1;
  return (
    <>
      <ComposerBanner.Icon>
        {waiting ? (
          <WaitingKindIcon kind={waiting.kind} className="text-warning" />
        ) : progress.activity ? (
          <ActivityKindIcon kind={progress.activity.now.kind} />
        ) : (
          <ListTodoIcon />
        )}
      </ComposerBanner.Icon>
      <ComposerBanner.Content>
        <span className={cn("shrink-0", waiting ? "text-warning" : "text-muted-foreground")}>
          {waiting ? "Waiting for" : "Activity"}
        </span>
        <span
          className="min-w-0 flex-1 truncate text-left font-medium text-foreground/80"
          data-composer-task-current="true"
          title={waiting?.full ? `${waiting.source}: ${waiting.full}` : undefined}
        >
          {waiting
            ? `${waiting.source}${waiting.detail ? `: ${waiting.detail}` : ""}${extraWaits > 0 ? ` +${extraWaits} more` : ""}`
            : progress.step}
        </span>
      </ComposerBanner.Content>
      <ComposerBanner.Actions>
        {progress.activity && !waiting ? <ActivityCounters activity={progress.activity} /> : null}
        {waiting?.since ? (
          <AgentElapsed
            compact
            agent={{ status: "running", startedAt: waiting.since, completedAt: null }}
          />
        ) : progress.activity?.startedAt ? (
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
  const chipFiles = progress.activity?.files.slice(-MAX_FILE_CHIPS) ?? [];

  const row = (
    <ComposerBanner.Row
      render={<button type="button" />}
      aria-expanded={expanded}
      aria-label={`${expanded ? "Hide activity" : "Show activity"}. ${progress.totalSteps > 0 ? `${progress.completedSteps} of ${progress.totalSteps} complete.` : "No plan yet."} Current task: ${progress.step}`}
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
      {chipFiles.length > 0 ? (
        <div className="flex min-w-0 max-w-[45%] shrink-0 items-center gap-0.5 pe-2">
          {chipFiles.map((path, index) => (
            <Button
              key={path}
              className={cn(
                "min-w-0 max-w-28 shrink",
                // Older chips drop out first as the composer narrows.
                index < chipFiles.length - 2
                  ? "hidden @min-[560px]:inline-flex"
                  : index < chipFiles.length - 1
                    ? "hidden @min-[420px]:inline-flex"
                    : undefined,
              )}
              size="xs"
              variant="ghost"
              title={path}
              onClick={() => progress.activity?.onOpenFile(path)}
            >
              <span className="min-w-0 flex-1 truncate">{path.split(/[/\\]/).at(-1)}</span>
            </Button>
          ))}
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
          {steps.length > 0 ? (
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
          ) : null}
          {progress.activity ? (
            <>
              {progress.totalSteps > 0 ? (
                <p className="px-3 pb-2 text-xs text-muted-foreground">
                  {progress.activity.finishing
                    ? "Finishing the last step"
                    : `${progress.activity.remaining} steps remaining`}
                  {steps.some((step) => step.status === "pending")
                    ? ` · Next: ${steps.find((step) => step.status === "pending")?.step}`
                    : null}
                </p>
              ) : null}
              <ActivityDetails
                activity={progress.activity}
                onOpenFile={progress.activity.onOpenFile}
              />
            </>
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
