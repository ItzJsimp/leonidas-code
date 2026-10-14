import type { ThreadContextBreakdown } from "@t3tools/contracts";

export interface TrimSuggestion {
  readonly key: string;
  readonly kind: "mcp" | "skill" | "agent" | "memory" | "tool-results";
  readonly label: string;
  /** Tokens this item adds to every turn while it stays loaded. */
  readonly tokens: number;
  readonly estimated: boolean;
}

const MIN_TRIM_TOKENS = 500;
const MAX_SUGGESTIONS = 5;
/** Newest tool calls kept out of the compact suggestion; the agent is most likely to reuse them. */
const KEEP_NEWEST_TOOL_CALLS = 10;
const MIN_OLD_TOOL_TOKENS = 2_000;

/**
 * Fixed overhead worth removing: MCP servers (tool schemas summed per server), skills, agents and
 * memory files, which the provider loads on every turn. Files the agent read or edited are
 * conversation, not overhead, so they never appear here.
 */
export function deriveTrimSuggestions(
  breakdown: Pick<ThreadContextBreakdown, "mcpTools" | "skills" | "agents" | "files"> &
    Partial<Pick<ThreadContextBreakdown, "toolCalls">>,
): ReadonlyArray<TrimSuggestion> {
  const servers = new Map<string, number>();
  for (const tool of breakdown.mcpTools) {
    servers.set(tool.server, (servers.get(tool.server) ?? 0) + tool.tokens);
  }
  const all: TrimSuggestion[] = [
    ...[...servers].map(([server, tokens]) => ({
      key: `mcp:${server}`,
      kind: "mcp" as const,
      label: server,
      tokens,
      estimated: false,
    })),
    ...breakdown.skills.map((skill) => ({
      key: `skill:${skill.source}:${skill.name}`,
      kind: "skill" as const,
      label: skill.name,
      tokens: skill.tokens,
      estimated: false,
    })),
    ...breakdown.agents.map((agent) => ({
      key: `agent:${agent.source}:${agent.name}`,
      kind: "agent" as const,
      label: agent.name,
      tokens: agent.tokens,
      estimated: false,
    })),
    ...breakdown.files
      .filter((file) => file.origin === "memory")
      .map((file) => ({
        key: `memory:${file.path}`,
        kind: "memory" as const,
        label: file.path,
        tokens: file.tokens,
        estimated: file.estimated,
      })),
  ];
  // Every old tool result is resent each turn until the chat compacts. Calls arrive oldest first.
  const oldCalls = (breakdown.toolCalls ?? []).slice(0, -KEEP_NEWEST_TOOL_CALLS);
  const oldTokens = oldCalls.reduce((total, call) => total + call.tokens, 0);
  if (oldTokens >= MIN_OLD_TOOL_TOKENS) {
    all.push({
      key: "tool-results:old",
      kind: "tool-results",
      label: `${oldCalls.length} older tool results (compact the chat)`,
      tokens: oldTokens,
      estimated: true,
    });
  }
  return all
    .filter((item) => item.tokens >= MIN_TRIM_TOKENS)
    .toSorted((a, b) => b.tokens - a.tokens || a.label.localeCompare(b.label))
    .slice(0, MAX_SUGGESTIONS);
}

const sumTokens = (items: ReadonlyArray<{ readonly tokens: number }>) =>
  items.reduce((total, item) => total + item.tokens, 0);

/** Estimated tokens the provider carries on every turn before the conversation starts. */
export function estimateFixedOverheadTokens(
  breakdown: Pick<ThreadContextBreakdown, "mcpTools" | "skills" | "agents" | "files">,
): number {
  return (
    sumTokens(breakdown.mcpTools) +
    sumTokens(breakdown.skills) +
    sumTokens(breakdown.agents) +
    sumTokens(breakdown.files.filter((file) => file.origin === "memory"))
  );
}

/** Splits one turn's input into the fixed part and the rest; the estimate is capped at the input. */
export function splitInputByOverhead(
  inputTokens: number,
  overheadTokens: number,
): { readonly fixed: number; readonly conversation: number } | null {
  if (overheadTokens <= 0 || inputTokens <= 0) return null;
  const fixed = Math.min(overheadTokens, inputTokens);
  return { fixed, conversation: inputTokens - fixed };
}
