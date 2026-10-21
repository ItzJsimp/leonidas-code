import {
  BotIcon,
  BrainIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleDotIcon,
  CircleIcon,
  CircleXIcon,
  DatabaseIcon,
  EyeIcon,
  FileTextIcon,
  GlobeIcon,
  LibraryIcon,
  ListTodoIcon,
  type LucideIcon,
  PencilIcon,
  SearchIcon,
  SparklesIcon,
  TerminalIcon,
  WrenchIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type { AccessedFile, AgentActivity } from "../../agentActivity";
import type { ActivityKind } from "../../agentActivityAccess";
import { formatDuration } from "../../session-logic";
import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../ui/collapsible";
import { ScrollArea } from "../ui/scroll-area";
import { Spinner } from "../ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { AgentElapsed } from "./AgentElapsed";

type IconKind = ActivityKind | "think" | "idle";

const KIND_ICON: Record<IconKind, LucideIcon> = {
  read: FileTextIcon,
  write: PencilIcon,
  search: SearchIcon,
  command: TerminalIcon,
  web: GlobeIcon,
  skill: SparklesIcon,
  memory: DatabaseIcon,
  tool: WrenchIcon,
  agent: BotIcon,
  think: BrainIcon,
  idle: ListTodoIcon,
};

export function ActivityKindIcon({
  kind,
  className,
}: {
  readonly kind: IconKind;
  readonly className?: string;
}) {
  const Icon = KIND_ICON[kind];
  return <Icon aria-hidden className={cn("text-muted-foreground", className)} />;
}

const isCode = (kind: IconKind) => kind === "command" || kind === "search";

function Section({
  title,
  aside,
  children,
}: {
  readonly title: string;
  readonly aside?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="flex min-w-0 flex-col gap-2.5 border-b border-border/60 px-4 py-4 last:border-b-0"
    >
      <h3 className="flex items-baseline justify-between gap-3 text-xs font-medium text-muted-foreground">
        <span>{title}</span>
        {aside ? <span className="font-normal tabular-nums">{aside}</span> : null}
      </h3>
      {children}
    </section>
  );
}

function EventIcon({
  event,
}: {
  readonly event: { readonly kind: IconKind; readonly running: boolean; readonly failed: boolean };
}) {
  if (event.running) return <Spinner size="sm" tone="muted" className="shrink-0" aria-hidden />;
  if (event.failed)
    return <CircleXIcon aria-label="Failed" className="size-3.5 shrink-0 text-destructive" />;
  return <ActivityKindIcon kind={event.kind} className="size-3.5 shrink-0" />;
}

function NowSection({
  activity,
  live,
  onShowItem,
}: {
  readonly activity: AgentActivity;
  readonly live: boolean;
  readonly onShowItem: (itemId: string) => void;
}) {
  const { now } = activity;
  const verb = now.failed && !now.running ? "Failed" : now.label;
  const showRaw = now.kind === "command" && now.full !== null && now.full !== now.target;
  return (
    <Section title={live ? "Now" : "Last action"}>
      <div className="flex min-w-0 items-center gap-2 text-sm">
        {now.kind === "think" || now.kind === "idle" ? (
          <ActivityKindIcon kind={now.kind} className="size-4 shrink-0" />
        ) : (
          <EventIcon event={now} />
        )}
        <span className={cn("font-medium", now.failed && !now.running && "text-destructive")}>
          {verb}
        </span>
        {live && now.running && now.since ? (
          <span className="ms-auto text-xs text-muted-foreground tabular-nums">
            <AgentElapsed agent={{ status: "running", startedAt: now.since, completedAt: null }} />
          </span>
        ) : null}
      </div>
      {now.target ? (
        isCode(now.kind) ? (
          <code className="block rounded-lg bg-muted/70 px-3 py-2 font-mono text-xs leading-relaxed break-words text-foreground/90 select-text">
            {now.target}
          </code>
        ) : (
          <p className="text-sm leading-relaxed text-foreground/85 wrap-anywhere">{now.target}</p>
        )
      ) : null}
      {showRaw ? (
        <p className="font-mono text-2xs leading-relaxed break-all text-muted-foreground select-text">
          <span className="font-sans">Full command: </span>
          {now.full}
        </p>
      ) : null}
      {now.itemId ? (
        <Button
          size="xs"
          variant="outline"
          className="self-start"
          onClick={() => onShowItem(now.itemId!)}
        >
          Show in chat
        </Button>
      ) : null}
    </Section>
  );
}

/** Step text can repeat, so each key counts earlier steps with the same text. */
function keyedSteps(steps: AgentActivity["steps"]) {
  const seen = new Map<string, number>();
  return steps.map((step) => {
    const occurrence = seen.get(step.step) ?? 0;
    seen.set(step.step, occurrence + 1);
    return { key: `${step.step}:${occurrence}`, step };
  });
}

function PlanSection({
  activity,
  live,
}: {
  readonly activity: AgentActivity;
  readonly live: boolean;
}) {
  if (activity.steps.length === 0) return null;
  const current =
    activity.currentStep ?? Math.min(activity.completedSteps + 1, activity.totalSteps);
  return (
    <Section title="Plan" aside={`Step ${current} of ${activity.totalSteps}`}>
      <ol className="flex flex-col gap-1.5">
        {keyedSteps(activity.steps).map(({ key, step }) => (
          <li
            key={key}
            className={cn(
              "flex items-start gap-2.5 text-sm leading-snug",
              step.status === "completed" && "text-muted-foreground",
              step.status === "pending" && "text-muted-foreground",
            )}
          >
            <span className="flex h-5 w-3.5 shrink-0 items-center justify-center">
              {step.status === "completed" ? (
                <CheckIcon aria-label="Done" className="size-3.5 text-success" />
              ) : step.status === "inProgress" && live ? (
                <Spinner size="sm" aria-label="In progress" />
              ) : step.status === "inProgress" ? (
                // A finished run whose agent never closed this step.
                <CircleDotIcon
                  aria-label="Not finished"
                  className="size-3.5 text-muted-foreground"
                />
              ) : (
                <CircleIcon aria-label="Not started" className="size-3 text-muted-foreground/50" />
              )}
            </span>
            <span className="min-w-0 flex-1 wrap-anywhere">{step.step}</span>
            {step.durationMs !== undefined && step.durationMs >= 1000 ? (
              <span className="shrink-0 pt-px text-xs text-muted-foreground tabular-nums">
                {formatDuration(step.durationMs)}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      {activity.explanation ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{activity.explanation}</p>
      ) : null}
    </Section>
  );
}

/** A row that opens a file; the full path shows on hover. */
function FileRow({
  file,
  label,
  onOpenFile,
}: {
  readonly file: AccessedFile;
  readonly label: string;
  readonly onOpenFile: (path: string) => void;
}) {
  const edited = file.access === "write";
  const AccessIcon = edited ? PencilIcon : EyeIcon;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => onOpenFile(file.path)}
            className="flex min-h-7 w-full min-w-0 items-center gap-2 rounded-md px-2 text-start text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          />
        }
      >
        <AccessIcon
          aria-label={edited ? "Edited" : "Read"}
          className={cn("size-3.5 shrink-0", edited ? "text-warning" : "text-muted-foreground")}
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {file.count > 1 ? (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{file.count}×</span>
        ) : null}
      </TooltipTrigger>
      <TooltipPopup side="left" variant="code">
        {file.path}
      </TooltipPopup>
    </Tooltip>
  );
}

function Chips({ items }: { readonly items: ReadonlyArray<{ name: string; count: number }> }) {
  return (
    <ul className="flex flex-wrap gap-1.5 px-1 pb-1">
      {items.map((item) => (
        <li
          key={item.name}
          className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs"
        >
          <span className="truncate">{item.name}</span>
          {item.count > 1 ? (
            <span className="text-muted-foreground tabular-nums">{item.count}×</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function UsedGroup({
  label,
  icon: Icon,
  count,
  children,
}: {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly count: number;
  readonly children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="group/used flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-start text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
        <ChevronRightIcon
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-panel-open/used:rotate-90"
        />
        <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1">{label}</span>
        <span className="rounded-full bg-muted px-2 text-xs font-normal text-muted-foreground tabular-nums">
          {count}
        </span>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="flex flex-col gap-0.5 ps-5 pt-1 pb-2">{children}</div>
      </CollapsiblePanel>
    </Collapsible>
  );
}

function UsedSection({
  activity,
  onOpenFile,
}: {
  readonly activity: AgentActivity;
  readonly onOpenFile: (path: string) => void;
}) {
  const folders = new Map<string, typeof activity.aios>();
  for (const file of activity.aios) {
    folders.set(file.folder, [...(folders.get(file.folder) ?? []), file]);
  }
  const empty =
    activity.skills.length +
      activity.aios.length +
      activity.project.length +
      activity.tools.length ===
    0;
  return (
    <Section title="Used this run">
      {empty ? (
        <p className="text-sm text-muted-foreground">
          Skills, AIOS files and project files show here when the AI uses them.
        </p>
      ) : (
        <div className="-mx-2 flex flex-col gap-0.5">
          <UsedGroup label="Skills" icon={SparklesIcon} count={activity.skills.length}>
            <Chips items={activity.skills} />
          </UsedGroup>
          <UsedGroup label="AIOS files" icon={LibraryIcon} count={activity.aios.length}>
            {[...folders].map(([folder, files]) => (
              <div key={folder} className="flex min-w-0 flex-col">
                <span className="px-2 pt-1.5 pb-0.5 text-xs text-muted-foreground">
                  {folder === "root" ? "Canon" : `${folder}/`}
                </span>
                {files.map((file) => (
                  <FileRow
                    key={file.path}
                    file={file}
                    label={file.relative.replace(`${folder}/`, "")}
                    onOpenFile={onOpenFile}
                  />
                ))}
              </div>
            ))}
          </UsedGroup>
          <UsedGroup label="Project files" icon={FileTextIcon} count={activity.project.length}>
            {activity.project.map((file) => (
              <FileRow key={file.path} file={file} label={file.name} onOpenFile={onOpenFile} />
            ))}
          </UsedGroup>
          <UsedGroup label="Tools" icon={WrenchIcon} count={activity.tools.length}>
            <Chips items={activity.tools} />
          </UsedGroup>
        </div>
      )}
    </Section>
  );
}

function ToolCallsSection({
  activity,
  onShowItem,
}: {
  readonly activity: AgentActivity;
  readonly onShowItem: (itemId: string) => void;
}) {
  if (activity.events.length === 0) return null;
  const shown = activity.events.toReversed();
  return (
    <Section
      title="Tool calls"
      aside={
        activity.actionCount > shown.length
          ? `Latest ${shown.length} of ${activity.actionCount}`
          : activity.actionCount
      }
    >
      <ul className="-mx-2 flex flex-col gap-0.5">
        {shown.map((event) => (
          <li key={event.id}>
            <button
              type="button"
              onClick={() => onShowItem(event.id)}
              aria-label={`${event.label} ${event.target ?? ""}. Show it in the chat.`}
              className="flex min-h-7 w-full min-w-0 items-center gap-2 rounded-md px-2 text-start text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <EventIcon event={event} />
              <span className="shrink-0 text-muted-foreground">{event.label}</span>
              <span
                className={cn("min-w-0 flex-1 truncate", isCode(event.kind) && "font-mono text-xs")}
              >
                {event.target}
              </span>
              <span
                className={cn(
                  "shrink-0 text-xs tabular-nums",
                  event.failed ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {event.running
                  ? "Now"
                  : event.failed
                    ? "Failed"
                    : event.durationMs !== null && event.durationMs >= 1000
                      ? formatDuration(event.durationMs)
                      : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/**
 * The Activity side panel: what the agent does now, its plan, everything it used
 * (skills, AIOS files, project files, tools) and its latest tool calls.
 */
export function ActivityPanel({
  activity,
  live,
  startedAt,
  onOpenFile,
  onShowItem,
}: {
  readonly activity: AgentActivity | null;
  /** The run is still working; a finished run shows its record. */
  readonly live: boolean;
  readonly startedAt: string | null;
  readonly onOpenFile: (path: string) => void;
  readonly onShowItem: (itemId: string) => void;
}) {
  if (!activity) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        <p className="max-w-64 leading-relaxed">
          No activity yet. When the AI works, each step, file and skill it uses shows here.
        </p>
      </div>
    );
  }
  return (
    <ScrollArea className="h-full" data-activity-panel="true">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 text-sm">
        {live ? (
          <Spinner size="sm" tone="muted" aria-hidden />
        ) : (
          <CheckIcon aria-hidden className="size-3.5 text-success" />
        )}
        <span className="font-medium">{live ? "Working" : "Finished"}</span>
        {live && startedAt ? (
          <span className="ms-auto text-xs text-muted-foreground tabular-nums">
            <AgentElapsed agent={{ status: "running", startedAt, completedAt: null }} />
          </span>
        ) : null}
      </div>
      <NowSection activity={activity} live={live} onShowItem={onShowItem} />
      <PlanSection activity={activity} live={live} />
      <UsedSection activity={activity} onOpenFile={onOpenFile} />
      <ToolCallsSection activity={activity} onShowItem={onShowItem} />
    </ScrollArea>
  );
}
