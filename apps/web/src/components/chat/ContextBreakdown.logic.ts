import type {
  ThreadContextBreakdown,
  ThreadContextBreakdownCategory,
  ThreadContextBreakdownFile,
  ThreadContextBreakdownToolCall,
} from "@t3tools/contracts";

export type { ThreadContextBreakdown };
export type BreakdownCategory = ThreadContextBreakdownCategory;
export type BreakdownFile = ThreadContextBreakdownFile;
export type BreakdownToolCall = ThreadContextBreakdownToolCall;
export type BreakdownSort = "size" | "name";

/** One row of any section: what it is, a second line, its weight, and how sure we are. */
export interface BreakdownRow {
  readonly key: string;
  readonly name: string;
  readonly detail: string | null;
  readonly tokens: number;
  readonly estimated: boolean;
}

export interface ToolCallGroup extends BreakdownRow {
  readonly calls: ReadonlyArray<BreakdownRow>;
}

export interface BreakdownSections {
  readonly files: ReadonlyArray<BreakdownRow>;
  readonly memory: ReadonlyArray<BreakdownRow>;
  readonly toolCalls: ReadonlyArray<ToolCallGroup>;
  readonly mcpTools: ReadonlyArray<BreakdownRow>;
  readonly skills: ReadonlyArray<BreakdownRow>;
  readonly agents: ReadonlyArray<BreakdownRow>;
}

/** Share of the window, or null when the window size is unknown. */
export function percentOfWindow(tokens: number, maxTokens: number | null): number | null {
  if (maxTokens === null || maxTokens <= 0) return null;
  return (Math.max(0, tokens) / maxTokens) * 100;
}

/** `12%`, `1.6%`, `<0.1%`, `0%`; empty when the window size is unknown. */
export function formatWindowPercent(tokens: number, maxTokens: number | null): string {
  const percent = percentOfWindow(tokens, maxTokens);
  if (percent === null) return "";
  if (percent === 0) return "0%";
  if (percent < 0.1) return "<0.1%";
  if (percent < 10) return `${percent.toFixed(1).replace(/\.0$/, "")}%`;
  return `${Math.round(percent)}%`;
}

/** Case-insensitive; every whitespace-separated term must appear in one of the fields. */
export function matchesQuery(query: string, ...fields: ReadonlyArray<string | null>): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = fields
    .filter((field) => field !== null)
    .join("\n")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/** Largest first (ties by name), or A to Z. Never mutates the input. */
export function sortRows<Row extends BreakdownRow>(
  rows: ReadonlyArray<Row>,
  sort: BreakdownSort,
): Row[] {
  return rows.toSorted((left, right) =>
    sort === "size"
      ? right.tokens - left.tokens || left.name.localeCompare(right.name)
      : left.name.localeCompare(right.name) || right.tokens - left.tokens,
  );
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function fileRow(file: BreakdownFile): BreakdownRow {
  const verb = file.origin === "edit" ? "edited" : file.origin === "memory" ? "loaded" : "read";
  return {
    key: `file:${file.path}`,
    name: file.path,
    detail: `${verb} ${plural(file.readCount, "time", "times")} · last in reply ${file.lastTurnIndex}`,
    tokens: file.tokens,
    estimated: file.estimated,
  };
}

/**
 * Calls grouped by tool name with summed tokens, each group's calls kept for the
 * expanded view. A query matches the tool name or any call's target; a group whose
 * name matches keeps all its calls.
 */
export function groupToolCalls(
  calls: ReadonlyArray<BreakdownToolCall>,
  query: string,
  sort: BreakdownSort,
): ToolCallGroup[] {
  const groups = new Map<string, BreakdownToolCall[]>();
  for (const call of calls) {
    const list = groups.get(call.name);
    if (list) list.push(call);
    else groups.set(call.name, [call]);
  }
  const result: ToolCallGroup[] = [];
  for (const [name, members] of groups) {
    const nameMatches = matchesQuery(query, name);
    const kept = nameMatches
      ? members
      : members.filter((call) => matchesQuery(query, call.name, call.target));
    if (kept.length === 0) continue;
    const rows = kept.map((call) => ({
      key: `call:${call.id}`,
      name: call.target ?? name,
      detail: `turn ${call.turnIndex}${call.status === "ok" ? "" : ` · ${call.status}`}`,
      tokens: call.tokens,
      estimated: call.estimated,
    }));
    result.push({
      key: `tool:${name}`,
      name,
      detail: plural(kept.length, "call", "calls"),
      tokens: kept.reduce((sum, call) => sum + call.tokens, 0),
      estimated: kept.some((call) => call.estimated),
      calls: sortRows(rows, sort),
    });
  }
  return sortRows(result, sort);
}

/** Every section filtered by `query` and sorted, ready to render. */
export function breakdownSections(
  breakdown: ThreadContextBreakdown,
  query: string,
  sort: BreakdownSort,
): BreakdownSections {
  const keep = (rows: ReadonlyArray<BreakdownRow>) =>
    sortRows(
      rows.filter((row) => matchesQuery(query, row.name, row.detail)),
      sort,
    );
  return {
    files: keep(breakdown.files.filter((file) => file.origin !== "memory").map(fileRow)),
    memory: keep(breakdown.files.filter((file) => file.origin === "memory").map(fileRow)),
    toolCalls: groupToolCalls(breakdown.toolCalls, query, sort),
    // The MCP, skill and agent counts come from the provider's own tool list, never estimated.
    mcpTools: keep(
      breakdown.mcpTools.map((tool) => ({
        key: `mcp:${tool.server}:${tool.name}`,
        name: tool.name,
        detail: tool.server,
        tokens: tool.tokens,
        estimated: false,
      })),
    ),
    skills: keep(
      breakdown.skills.map((skill) => ({
        key: `skill:${skill.source}:${skill.name}`,
        name: skill.name,
        detail: skill.source,
        tokens: skill.tokens,
        estimated: false,
      })),
    ),
    agents: keep(
      breakdown.agents.map((agent) => ({
        key: `agent:${agent.source}:${agent.name}`,
        name: agent.name,
        detail: agent.source,
        tokens: agent.tokens,
        estimated: false,
      })),
    ),
  };
}

export function sectionTokens(rows: ReadonlyArray<BreakdownRow>): number {
  return rows.reduce((sum, row) => sum + row.tokens, 0);
}

/** Fixed hues per position so the bar and its legend always agree. */
const SEGMENT_FILLS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-indigo-400",
  "bg-orange-500",
  "bg-lime-500",
  "bg-fuchsia-500",
] as const;

export interface BarSegment {
  readonly name: string;
  readonly kind: BreakdownCategory["kind"];
  readonly tokens: number;
  readonly estimated: boolean;
  /** Width in the bar, 0..100; 0 for deferred (not in the window) and free (the track). */
  readonly width: number;
  readonly fill: string;
}

/**
 * Legend and bar order: used categories largest first, then the buffer, then free
 * space, then deferred. Widths scale to the window, or to the total when the
 * categories overrun it, so the bar never overflows.
 */
export function barSegments(
  categories: ReadonlyArray<BreakdownCategory>,
  maxTokens: number | null,
): BarSegment[] {
  const rank = { used: 0, buffer: 1, free: 2, deferred: 3 } as const;
  const ordered = categories.toSorted(
    (left, right) => rank[left.kind] - rank[right.kind] || right.tokens - left.tokens,
  );
  const drawn = ordered.filter(
    (category) => category.kind === "used" || category.kind === "buffer",
  );
  const drawnTotal = drawn.reduce((sum, category) => sum + Math.max(0, category.tokens), 0);
  const scale = Math.max(maxTokens ?? 0, drawnTotal);
  let hue = 0;
  return ordered.map((category) => {
    const fill =
      category.kind === "used"
        ? (SEGMENT_FILLS[hue++ % SEGMENT_FILLS.length] ?? "bg-sky-500")
        : category.kind === "buffer"
          ? "bg-muted-foreground/45"
          : category.kind === "free"
            ? "bg-muted"
            : "bg-transparent";
    const width =
      scale > 0 && (category.kind === "used" || category.kind === "buffer")
        ? (Math.max(0, category.tokens) / scale) * 100
        : 0;
    return {
      name: category.name,
      kind: category.kind,
      tokens: category.tokens,
      estimated: category.estimated,
      width,
      fill,
    };
  });
}
