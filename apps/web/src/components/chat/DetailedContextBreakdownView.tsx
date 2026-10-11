import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileCodeIcon,
  FileTextIcon,
  LayersIcon,
  Loader2Icon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
  TerminalIcon,
  WrenchIcon,
} from "lucide-react";
import { memo, useMemo, useState } from "react";

import { useThreadContextBreakdown } from "../../state/queries";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  barSegments,
  breakdownSections,
  formatWindowPercent,
  sectionTokens,
  type BreakdownRow,
  type BreakdownSort,
  type ToolCallGroup,
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
          <span className="text-sm font-semibold">Context Breakdown</span>
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
          <span className="text-sm font-semibold">Context Breakdown</span>
        </div>
        <span>No context data reported yet for this thread.</span>
      </div>
    );
  }

  const percentLabel = formatWindowPercent(breakdown.totalTokens, breakdown.maxTokens);

  return (
    <div className="flex max-h-[min(32rem,calc(100dvh-6rem))] flex-col gap-3.5 overflow-y-auto overscroll-contain p-1 [scrollbar-width:thin]">
      {/* Header with back button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="icon-xs" variant="ghost" onClick={onBack} aria-label="Go back to overview">
            <ArrowLeftIcon className="size-4" />
          </Button>
          <span className="text-sm font-semibold">Context Breakdown</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" size="sm" className="tabular-nums">
            {formatTokenCount(breakdown.totalTokens)}
            {breakdown.maxTokens ? ` / ${formatTokenCount(breakdown.maxTokens)}` : ""} tokens
          </Badge>
          {percentLabel ? (
            <Badge variant="secondary" size="sm" className="tabular-nums font-semibold">
              {percentLabel}
            </Badge>
          ) : null}
          <Badge
            variant={breakdown.source === "provider" ? "info" : "outline"}
            size="sm"
            className="text-2xs"
          >
            {breakdown.source === "provider"
              ? "Provider reported"
              : breakdown.source === "estimated"
                ? "Estimated"
                : "Mixed"}
          </Badge>
        </div>
      </div>

      {/* Visual Context Gauge Bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          {segments
            .filter((seg) => seg.width > 0)
            .map((seg) => (
              <div
                key={seg.name}
                className={seg.fill}
                style={{ width: `${seg.width}%` }}
                title={`${seg.name}: ${formatTokenCount(seg.tokens)} tokens (${seg.width.toFixed(1)}%)`}
              />
            ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs">
          {segments.map((seg) => (
            <div key={seg.name} className="flex items-center gap-1">
              <span className={`size-2 shrink-0 rounded-full ${seg.fill}`} />
              <span className="text-muted-foreground">{seg.name}</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatTokenCount(seg.tokens)}
              </span>
              {seg.estimated ? <span className="text-muted-foreground">(est)</span> : null}
            </div>
          ))}
        </div>
      </div>

      {/* Filter and Sort Toolbar */}
      <div className="flex items-center gap-2 pt-1">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter files, tools, skills..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs shrink-0"
          onClick={() => setSort((prev) => (prev === "size" ? "name" : "size"))}
        >
          Sort: {sort === "size" ? "Size ↓" : "Name A-Z"}
        </Button>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-3">
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
            title="Tool calls"
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
                      className="flex items-center justify-between gap-2 py-1 text-left text-xs hover:bg-muted/40 rounded px-1 -mx-1"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isExpanded ? (
                          <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="font-semibold text-foreground truncate">{group.name}</span>
                        <span className="text-2xs text-muted-foreground">({group.detail})</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                        <span className="font-medium text-foreground">
                          {formatTokenCount(group.tokens)}
                        </span>
                        <span className="text-2xs text-muted-foreground">
                          {formatWindowPercent(group.tokens, breakdown.maxTokens)}
                        </span>
                      </div>
                    </button>
                    {isExpanded ? (
                      <div className="ml-5 flex flex-col divide-y divide-border/20 border-l border-border/40 pl-2">
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
            title="System & Memory"
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
            title="MCP Tools"
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

        {/* Skills */}
        {sections.skills.length > 0 ? (
          <SectionContainer
            icon={SparklesIcon}
            title="Skills"
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
            title="Subagents"
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
          <div className="rounded-lg border bg-muted/30 p-2.5 text-2xs text-muted-foreground flex flex-col gap-1">
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
    <section className="flex flex-col rounded-xl border bg-card p-3 gap-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <Icon className="size-3.5 text-muted-foreground" />
          <span>{title}</span>
          <span className="text-2xs font-normal text-muted-foreground">({count})</span>
        </div>
        <div className="flex items-center gap-1.5 tabular-nums text-2xs">
          <span className="font-medium text-foreground">{formatTokenCount(tokens)}</span>
          <span className="text-muted-foreground">{formatWindowPercent(tokens, maxTokens)}</span>
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
      className={`flex items-baseline justify-between gap-2 py-1 ${compact ? "text-2xs" : "text-xs"}`}
    >
      <div className="flex flex-col min-w-0 flex-1">
        <span
          className={`truncate font-medium text-foreground ${isPath ? "font-mono text-2xs" : ""}`}
          title={row.name}
        >
          {row.name}
        </span>
        {row.detail ? (
          <span className="truncate text-2xs text-muted-foreground">{row.detail}</span>
        ) : null}
      </div>
      <div className="flex items-center gap-1 shrink-0 tabular-nums text-2xs">
        <span className="font-medium text-foreground">{formatTokenCount(row.tokens)}</span>
        {row.estimated ? <span className="text-muted-foreground">(est)</span> : null}
        <span className="text-muted-foreground w-10 text-right">
          {formatWindowPercent(row.tokens, maxTokens)}
        </span>
      </div>
    </div>
  );
}
