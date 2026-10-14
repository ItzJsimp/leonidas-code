import {
  BotIcon,
  BrainIcon,
  DatabaseIcon,
  EyeIcon,
  FileTextIcon,
  GlobeIcon,
  HourglassIcon,
  LibraryIcon,
  ListTodoIcon,
  type LucideIcon,
  PencilIcon,
  SearchIcon,
  SparklesIcon,
  TerminalIcon,
  WrenchIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import type { AccessedFile, AgentActivity, WaitingKind, WaitingOn } from "../../agentActivity";
import { AgentElapsed } from "./AgentElapsed";
import type { ActivityKind } from "../../agentActivityAccess";
import { formatDuration } from "../../session-logic";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

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

const KIND_TINT: Record<IconKind, string> = {
  read: "text-info",
  write: "text-warning",
  search: "text-muted-foreground",
  command: "text-muted-foreground",
  web: "text-info",
  skill: "text-primary",
  memory: "text-success",
  tool: "text-muted-foreground",
  agent: "text-primary",
  think: "text-muted-foreground",
  idle: "text-muted-foreground",
};

export function ActivityKindIcon({
  kind,
  className,
}: {
  readonly kind: IconKind;
  readonly className?: string;
}) {
  const Icon = KIND_ICON[kind];
  return <Icon aria-hidden className={cn(KIND_TINT[kind], className)} />;
}

const WAITING_ICON: Record<WaitingKind, LucideIcon> = {
  shell: TerminalIcon,
  subagent: BotIcon,
  app: WrenchIcon,
  web: GlobeIcon,
};

export function WaitingKindIcon({
  kind,
  className,
}: {
  readonly kind: WaitingKind;
  readonly className?: string;
}) {
  const Icon = WAITING_ICON[kind];
  return <Icon aria-hidden className={className} />;
}

/** Each dependency the agent is blocked on, with how long it has been waiting. */
function WaitingSection({ waiting }: { readonly waiting: readonly WaitingOn[] }) {
  if (waiting.length === 0) return null;
  return (
    <section aria-label="Waiting on" className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 px-1.5 pb-1 text-2xs font-medium text-warning">
        <HourglassIcon aria-hidden className="size-3" />
        <span>Waiting on {waiting.length === 1 ? "1 thing" : `${waiting.length} things`}</span>
      </div>
      {waiting.map((entry) => (
        <div
          key={entry.id}
          className="flex w-full min-w-0 items-start gap-2 rounded-md px-1.5 py-1"
        >
          <WaitingKindIcon kind={entry.kind} className="size-3.5 shrink-0 text-warning" />
          <span className="min-w-0 flex-1 break-words" title={entry.full ?? undefined}>
            <span className="font-medium text-foreground/90">{entry.source}</span>
            {entry.full ? (
              <span className="font-mono text-muted-foreground"> · {entry.full}</span>
            ) : null}
          </span>
          {entry.since ? (
            <span className="shrink-0 text-2xs text-muted-foreground tabular-nums">
              <AgentElapsed
                compact
                agent={{ status: "running", startedAt: entry.since, completedAt: null }}
              />
            </span>
          ) : null}
        </div>
      ))}
      <p className="px-1.5 pt-1 text-muted-foreground">
        The agent is paused and picks up again as soon as {waiting.length === 1 ? "this" : "these"}{" "}
        finish.
      </p>
    </section>
  );
}

/** Skills, AIOS files and project files used so far: glanceable counts for the collapsed bar. */
export function ActivityCounters({ activity }: { readonly activity: AgentActivity }) {
  const counters = [
    { label: "skills", count: activity.skills.length, Icon: SparklesIcon },
    { label: "AIOS files", count: activity.aios.length, Icon: LibraryIcon },
    { label: "project files", count: activity.project.length, Icon: FileTextIcon },
  ].filter((counter) => counter.count > 0);
  if (counters.length === 0) return null;
  return (
    <span className="hidden items-center gap-2 text-2xs text-muted-foreground tabular-nums @min-[420px]:flex">
      {counters.map(({ label, count, Icon }) => (
        <span key={label} className="flex items-center gap-1">
          <Icon aria-hidden className="size-3" />
          <span aria-label={`${count} ${label}`}>{count}</span>
        </span>
      ))}
    </span>
  );
}

/** A row that opens a file; the full path shows on hover. */
function PathButton({
  path,
  onOpenFile,
  className,
  children,
}: {
  readonly path: string;
  readonly onOpenFile: (path: string) => void;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => onOpenFile(path)}
            className={cn(
              "flex w-full min-w-0 items-center rounded-md px-1.5 py-1 text-left transition-colors hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              className,
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipPopup side="top" variant="code">
        {path}
      </TooltipPopup>
    </Tooltip>
  );
}

function FileRow({
  file,
  label,
  onOpenFile,
}: {
  readonly file: AccessedFile;
  readonly label: string;
  readonly onOpenFile: (path: string) => void;
}) {
  const AccessIcon = file.access === "write" ? PencilIcon : EyeIcon;
  return (
    <PathButton path={file.path} onOpenFile={onOpenFile} className="gap-2 text-xs">
      <AccessIcon
        aria-label={file.access === "write" ? "Edited" : "Read"}
        className={cn("size-3 shrink-0", file.access === "write" ? "text-warning" : "text-info")}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {file.count > 1 ? (
        <span className="shrink-0 text-2xs text-muted-foreground tabular-nums">×{file.count}</span>
      ) : null}
    </PathButton>
  );
}

function Chip({ name, count, icon: Icon }: { name: string; count: number; icon: LucideIcon }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs">
      <Icon aria-hidden className="size-3 shrink-0 text-muted-foreground" />
      <span className="truncate">{name}</span>
      {count > 1 ? (
        <span className="text-2xs text-muted-foreground tabular-nums">×{count}</span>
      ) : null}
    </span>
  );
}

type AccessTab = "aios" | "skills" | "files" | "tools";

function AccessSection({
  activity,
  onOpenFile,
}: {
  readonly activity: AgentActivity;
  readonly onOpenFile: (path: string) => void;
}) {
  const [selected, setSelected] = useState<AccessTab>("aios");
  const tabs = [
    { id: "aios", label: "AIOS", Icon: LibraryIcon, count: activity.aios.length },
    { id: "skills", label: "Skills", Icon: SparklesIcon, count: activity.skills.length },
    { id: "files", label: "Files", Icon: FileTextIcon, count: activity.project.length },
    { id: "tools", label: "Tools", Icon: WrenchIcon, count: activity.tools.length },
  ] as const satisfies ReadonlyArray<{
    id: AccessTab;
    label: string;
    Icon: LucideIcon;
    count: number;
  }>;
  const visible = tabs.filter((tab) => tab.count > 0);
  const active = visible.find((tab) => tab.id === selected) ?? visible[0];
  if (!active) {
    return (
      <p className="text-xs text-muted-foreground">
        Skills, AIOS files and project files show up here as the agent uses them.
      </p>
    );
  }

  const folders = new Map<string, typeof activity.aios>();
  for (const file of activity.aios) {
    folders.set(file.folder, [...(folders.get(file.folder) ?? []), file]);
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div role="tablist" aria-label="What the agent used" className="flex flex-wrap gap-1">
        {visible.map(({ id, label, Icon, count }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active.id === id}
            onClick={() => setSelected(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              active.id === id
                ? "border-transparent bg-accent font-medium text-accent-foreground"
                : "border-border/60 text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-3" />
            {label}
            <span className="tabular-nums opacity-70">{count}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" className="flex min-w-0 flex-col gap-1">
        {active.id === "aios"
          ? [...folders].map(([folder, files]) => (
              <div key={folder} className="flex min-w-0 flex-col">
                <span className="px-1.5 pt-1 pb-0.5 text-2xs font-medium text-muted-foreground">
                  {folder === "root" ? "canon" : `${folder}/`}
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
            ))
          : null}
        {active.id === "skills" ? (
          <div className="flex flex-wrap gap-1.5 px-0.5">
            {activity.skills.map((skill) => (
              <Chip key={skill.name} name={skill.name} count={skill.count} icon={SparklesIcon} />
            ))}
          </div>
        ) : null}
        {active.id === "files"
          ? activity.project.map((file) => (
              <FileRow key={file.path} file={file} label={file.name} onOpenFile={onOpenFile} />
            ))
          : null}
        {active.id === "tools" ? (
          <div className="flex flex-wrap gap-1.5 px-0.5">
            {activity.tools.map((tool) => (
              <Chip key={tool.name} name={tool.name} count={tool.count} icon={WrenchIcon} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The expanded activity body: what the agent is thinking and saying, its recent
 * actions newest first, and what it has used (AIOS files, skills, project files, tools).
 */
export function ActivityDetails({
  activity,
  onOpenFile,
}: {
  readonly activity: AgentActivity;
  readonly onOpenFile: (path: string) => void;
}) {
  const feed = activity.events.toReversed().slice(0, 8);
  return (
    <div className="flex flex-col gap-4 px-3 pt-1 pb-3 text-xs">
      <WaitingSection waiting={activity.waiting} />
      {activity.thought || activity.said ? (
        <div className="flex flex-col gap-1.5">
          {activity.thought ? (
            <p className="flex items-start gap-2 text-muted-foreground">
              <BrainIcon aria-hidden className="mt-px size-3.5 shrink-0" />
              <span className="min-w-0 wrap-anywhere italic">{activity.thought}</span>
            </p>
          ) : null}
          {activity.said ? (
            <p className="flex items-start gap-2 text-foreground/80">
              <SparklesIcon aria-hidden className="mt-px size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 wrap-anywhere">{activity.said}</span>
            </p>
          ) : null}
        </div>
      ) : null}
      {feed.length > 0 ? (
        <section aria-label="Recent actions" className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between px-1.5 pb-1 text-2xs font-medium text-muted-foreground">
            <span>Recent actions</span>
            <span className="tabular-nums">{activity.actionCount} this run</span>
          </div>
          {feed.map((event) => {
            const content = (
              <>
                <ActivityKindIcon kind={event.kind} className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  <span className={cn(event.failed ? "text-destructive" : "text-muted-foreground")}>
                    {event.label}
                  </span>{" "}
                  <span className="text-foreground/90">{event.target}</span>
                </span>
                <span className="w-10 shrink-0 text-right text-2xs text-muted-foreground/70 tabular-nums">
                  {event.running
                    ? "now"
                    : event.failed
                      ? "failed"
                      : event.durationMs !== null && event.durationMs >= 1000
                        ? formatDuration(event.durationMs)
                        : null}
                </span>
              </>
            );
            const rowClass =
              "flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left";
            return event.path ? (
              <PathButton
                key={event.id}
                path={event.path}
                onOpenFile={onOpenFile}
                className="gap-2"
              >
                {content}
              </PathButton>
            ) : (
              <div key={event.id} className={rowClass}>
                {content}
              </div>
            );
          })}
        </section>
      ) : null}
      <section aria-label="Used by the agent" className="flex flex-col gap-1">
        <span className="px-1.5 text-2xs font-medium text-muted-foreground">Used so far</span>
        <AccessSection activity={activity} onOpenFile={onOpenFile} />
      </section>
      {activity.explanation ? (
        <p className="text-muted-foreground">{activity.explanation}</p>
      ) : null}
    </div>
  );
}
