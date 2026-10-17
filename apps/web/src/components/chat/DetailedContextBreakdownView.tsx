import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  FileCodeIcon,
  FileTextIcon,
  LayersIcon,
  Loader2Icon,
  RefreshCwIcon,
  SparklesIcon,
  TerminalIcon,
  WrenchIcon,
} from "lucide-react";
import { memo, useMemo, useState } from "react";

import { useThreadContextBreakdown } from "../../state/queries";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  matchesQuery,
  barSegments,
  breakdownSections,
  formatWindowPercent,
  sectionTokens,
  type BreakdownRow,
  type BreakdownSort,
} from "./ContextBreakdown.logic";
import { formatTokenCount } from "../../lib/usageLimitsPopover";

export const DetailedContextBreakdownView = memo(function DetailedContextBreakdownView({
  environmentId,
  threadId,
  onBack,
}: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly onBack: () => void;
}) {
  const query = useThreadContextBreakdown({ environmentId, threadId });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<BreakdownSort>("size");
  const [expandedTools, setExpandedTools] = useState<ReadonlySet<string>>(new Set());

  const breakdown = query.data;

  const toggleToolExpanded = (name: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const sections = useMemo(() => {
    if (!breakdown) return null;
    return breakdownSections(breakdown, search, sort);
  }, [breakdown, search, sort]);

  const usedSkills = useMemo(
    () =>
      (breakdown?.usedSkills ?? []).filter((skill) =>
        matchesQuery(
          search,
          skill.name,
          skill.path,
          skill.reason,
          skill.origins.map((origin) => (origin === "user" ? "You" : "Auto")).join(" "),
        ),
      ),
    [breakdown, search],
  );

  const segments = useMemo(() => {
    if (!breakdown) return [];
    return barSegments(breakdown.categories, breakdown.maxTokens);
  }, [breakdown]);

  if (query.isPending && !breakdown) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" />
        <span className="text-xs">Analyzing context window...</span>
      </div>
    );
  }

  if (query.error && !breakdown) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Button size="icon-xs" variant="ghost" onClick={onBack} aria-label="Go back">
            <ArrowLeftIcon className="size-4" />
          </Button>
          <span className="text-sm font-semibold">Chat memory</span>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          Failed to load context breakdown: {query.error}
        </div>
        <Button size="sm" variant="outline" onClick={query.refresh} className="self-start">
          <RefreshCwIcon className="mr-1.5 size-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  if (!breakdown || !sections) {
    return (
      <div className="flex flex-col gap-3 p-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Button size="icon-xs" variant="ghost" onClick={onBack} aria-label="Go back">
            <ArrowLeftIcon className="size-4" />
          </Button>
          <span className="text-sm font-semibold">Chat memory</span>
        </div>
        <span>No memory data for this chat yet.</span>
      </div>
    );
  }

  const percentLabel = formatWindowPercent(breakdown.totalTokens, breakdown.maxTokens);

  return (
    <div className="flex max-h-[min(32rem,calc(100dvh-6rem))] flex-col gap-4 overflow-y-auto overscroll-contain p-1 [scrollbar-width:thin]">
      {/* Header with back button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button size="icon-xs" variant="ghost" onClick={onBack} aria-label="Go back to overview">
            <ArrowLeftIcon className="size-4" />
          </Button>
          <span className="text-sm font-semibold tracking-tight">Chat memory</span>
        </div>
        <span className="pe-1 text-2xs text-muted-foreground">
          {breakdown.source === "provider"
            ? "Reported by the AI service"
            : breakdown.source === "estimated"
              ? "Estimated"
              : "Reported and estimated"}
        </span>
      </div>

      {/* Hero figure */}
      <div className="flex items-baseline gap-2 px-1 tabular-nums">
        <span className="text-2xl font-semibold leading-none tracking-tight text-foreground">
          {percentLabel ?? formatTokenCount(breakdown.totalTokens)}
        </span>
        <span className="text-xs text-muted-foreground">
          {percentLabel ? `${formatTokenCount(breakdown.totalTokens)} of ` : "tokens"}
          {percentLabel && breakdown.maxTokens
            ? `${formatTokenCount(breakdown.maxTokens)} tokens`
            : ""}
        </span>
      </div>

      {/* Visual Context Gauge Bar */}
      <div className="flex flex-col gap-3 px-1">
        <div className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-muted/60">
          {segments
            .filter((seg) => seg.width > 0)
            .map((seg) => (
              <Tooltip key={seg.name}>
                <TooltipTrigger
                  render={
                    <div
                      className={`${seg.fill} min-w-0.5 opacity-80 transition-opacity hover:opacity-100`}
                      style={{ width: `${seg.width}%` }}
                    />
                  }
                />
                <TooltipPopup>
                  {seg.name}: {formatTokenCount(seg.tokens)} tokens ({seg.width.toFixed(1)}%)
                </TooltipPopup>
              </Tooltip>
            ))}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
          {segments.map((seg) => (
            <div key={seg.name} className="flex min-w-0 items-center gap-2">
              <span className={`size-2 shrink-0 rounded-full ${seg.fill} opacity-80`} />
              <Tooltip>
                <TooltipTrigger
                  render={<span className="min-w-0 truncate text-muted-foreground" />}
                >
                  {seg.name}
                </TooltipTrigger>
                <TooltipPopup>{seg.name}</TooltipPopup>
              </Tooltip>
              <span className="ml-auto shrink-0 tabular-nums text-foreground">
                {formatTokenCount(seg.tokens)}
              </span>
              {seg.estimated ? (
                <span className="shrink-0 text-2xs text-muted-foreground/70">est.</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Filter and Sort Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files, tools, skills..."
            aria-label="Search chat memory"
            size="compact"
            className="h-8"
          />
        </div>
        <Button
          size="sm"
          variant="ghost-muted"
          className="h-8 shrink-0"
          onClick={() => setSort((prev) => (prev === "size" ? "name" : "size"))}
        >
          Sort: {sort === "size" ? "Size ↓" : "Name A-Z"}
        </Button>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-4">
        {/* Files Loaded */}
        {sections.files.length > 0 ? (
          <SectionContainer
            icon={FileCodeIcon}
            title="Files loaded"
            count={sections.files.length}
            tokens={sectionTokens(sections.files)}
            maxTokens={breakdown.maxTokens}
          >
            <div className="flex flex-col divide-y divide-border/40">
              {sections.files.map((file) => (
                <RowItem key={file.key} row={file} maxTokens={breakdown.maxTokens} isPath />
              ))}
            </div>
          </SectionContainer>
        ) : null}

        {/* Tool Calls */}
        {sections.toolCalls.length > 0 ? (
          <SectionContainer
            icon={TerminalIcon}
            title="Tool use"
            count={sections.toolCalls.length}
            tokens={sections.toolCalls.reduce((s, g) => s + g.tokens, 0)}
            maxTokens={breakdown.maxTokens}
          >
            <div className="flex flex-col divide-y divide-border/40">
              {sections.toolCalls.map((group) => {
                const isExpanded = expandedTools.has(group.name);
                return (
                  <div key={group.key} className="flex flex-col py-1">
                    <button
                      type="button"
                      onClick={() => toggleToolExpanded(group.name)}
                      aria-expanded={isExpanded}
                      className="-mx-1.5 flex cursor-pointer items-center justify-between gap-3 rounded-md px-1.5 py-2 text-left text-xs transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <ChevronRightIcon
                          aria-hidden
                          className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                        />
                        <span className="truncate font-medium text-foreground">{group.name}</span>
                        <span className="shrink-0 text-2xs text-muted-foreground">
                          {group.detail}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-baseline gap-2 tabular-nums">
                        <span className="text-foreground">{formatTokenCount(group.tokens)}</span>
                        <span className="w-11 text-right text-2xs text-muted-foreground">
                          {formatWindowPercent(group.tokens, breakdown.maxTokens)}
                        </span>
                      </div>
                    </button>
                    {isExpanded ? (
                      <div className="mb-1 ml-2 flex min-w-0 flex-col divide-y divide-border/30 border-l border-border/60 pl-4">
                        {group.calls.map((call) => (
                          <RowItem
                            key={call.key}
                            row={call}
                            maxTokens={breakdown.maxTokens}
                            compact
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </SectionContainer>
        ) : null}

        {/* Workspace & Memory */}
        {sections.memory.length > 0 ? (
          <SectionContainer
            icon={LayersIcon}
            title="System and notes"
            count={sections.memory.length}
            tokens={sectionTokens(sections.memory)}
            maxTokens={breakdown.maxTokens}
          >
            <div className="flex flex-col divide-y divide-border/40">
              {sections.memory.map((mem) => (
                <RowItem key={mem.key} row={mem} maxTokens={breakdown.maxTokens} />
              ))}
            </div>
          </SectionContainer>
        ) : null}

        {/* MCP Tools */}
        {sections.mcpTools.length > 0 ? (
          <SectionContainer
            icon={WrenchIcon}
            title="Tools you added"
            count={sections.mcpTools.length}
            tokens={sectionTokens(sections.mcpTools)}
            maxTokens={breakdown.maxTokens}
          >
            <div className="flex flex-col divide-y divide-border/40">
              {sections.mcpTools.map((tool) => (
                <RowItem key={tool.key} row={tool} maxTokens={breakdown.maxTokens} />
              ))}
            </div>
          </SectionContainer>
        ) : null}

        {usedSkills.length > 0 ? (
          <section className="flex min-w-0 flex-col" aria-label="Skills used in this chat">
            <div className="flex items-center gap-2 border-b border-border/60 pb-2 text-xs font-medium">
              <SparklesIcon aria-hidden className="size-3.5 text-muted-foreground" />
              <span>Skills used in this chat</span>
              <span className="text-2xs text-muted-foreground">{usedSkills.length}</span>
            </div>
            <p className="py-2 text-2xs text-muted-foreground">
              Recorded use across turns. Compaction can remove loaded instructions.
            </p>
            <div className="flex flex-col divide-y divide-border/40">
              {usedSkills.map((skill) => (
                <div
                  key={skill.name}
                  className="flex min-w-0 items-start justify-between gap-3 py-2 text-xs"
                >
                  <div className="flex min-w-0 flex-col">
                    <Tooltip>
                      <TooltipTrigger render={<span tabIndex={0} className="truncate leading-5" />}>
                        {skill.name}
                      </TooltipTrigger>
                      <TooltipPopup>{skill.path ?? "Path not recorded"}</TooltipPopup>
                    </Tooltip>
                    {skill.reason ? (
                      <span className="text-2xs text-muted-foreground">{skill.reason}</span>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {skill.origins
                      .map((origin) => (origin === "user" ? "You" : "Auto"))
                      .join(" / ")}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Skills */}
        {sections.skills.length > 0 ? (
          <SectionContainer
            icon={SparklesIcon}
            title="Available skills"
            count={sections.skills.length}
            tokens={sectionTokens(sections.skills)}
            maxTokens={breakdown.maxTokens}
          >
            <div className="flex flex-col divide-y divide-border/40">
              {sections.skills.map((skill) => (
                <RowItem key={skill.key} row={skill} maxTokens={breakdown.maxTokens} />
              ))}
            </div>
          </SectionContainer>
        ) : null}

        {/* Agents */}
        {sections.agents.length > 0 ? (
          <SectionContainer
            icon={FileTextIcon}
            title="Helpers"
            count={sections.agents.length}
            tokens={sectionTokens(sections.agents)}
            maxTokens={breakdown.maxTokens}
          >
            <div className="flex flex-col divide-y divide-border/40">
              {sections.agents.map((agent) => (
                <RowItem key={agent.key} row={agent} maxTokens={breakdown.maxTokens} />
              ))}
            </div>
          </SectionContainer>
        ) : null}

        {/* Notes if any */}
        {breakdown.notes.length > 0 ? (
          <div className="border-t border-border/50 pt-3 text-2xs leading-relaxed text-muted-foreground flex flex-col gap-1">
            <span className="font-semibold text-foreground">Notes:</span>
            {breakdown.notes.map((note) => (
              <span key={note}>• {note}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
});

function SectionContainer({
  icon: Icon,
  title,
  count,
  tokens,
  maxTokens,
  children,
}: {
  readonly icon: typeof FileCodeIcon;
  readonly title: string;
  readonly count: number;
  readonly tokens: number;
  readonly maxTokens: number | null;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border/60 pb-2 text-xs">
        <div className="flex min-w-0 items-center gap-2 font-medium text-foreground">
          <Icon aria-hidden className="size-3.5 text-muted-foreground" />
          <span>{title}</span>
          <span className="text-2xs font-normal tabular-nums text-muted-foreground">{count}</span>
        </div>
        <div className="flex items-baseline gap-2 tabular-nums">
          <span className="font-medium text-foreground">{formatTokenCount(tokens)}</span>
          <span className="w-11 text-right text-2xs text-muted-foreground">
            {formatWindowPercent(tokens, maxTokens)}
          </span>
        </div>
      </div>
      {children}
    </section>
  );
}

function RowItem({
  row,
  maxTokens,
  isPath = false,
  compact = false,
}: {
  readonly row: BreakdownRow;
  readonly maxTokens: number | null;
  readonly isPath?: boolean;
  readonly compact?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-2 ${compact ? "text-2xs" : "text-xs"}`}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className={`truncate leading-5 text-foreground ${isPath ? "text-left font-mono text-2xs [direction:rtl]" : ""}`}
              />
            }
          >
            {isPath ? <bdi>{row.name}</bdi> : row.name}
          </TooltipTrigger>
          <TooltipPopup variant={isPath ? "code" : "default"}>{row.name}</TooltipPopup>
        </Tooltip>
        {row.detail ? (
          <span className="truncate text-2xs text-muted-foreground">{row.detail}</span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-baseline gap-2 tabular-nums text-2xs">
        <span className="text-foreground">
          {formatTokenCount(row.tokens)}
          {row.estimated ? <span className="ms-1 text-muted-foreground/70">est.</span> : null}
        </span>
        <span className="w-11 text-right text-muted-foreground">
          {formatWindowPercent(row.tokens, maxTokens)}
        </span>
      </div>
    </div>
  );
}
