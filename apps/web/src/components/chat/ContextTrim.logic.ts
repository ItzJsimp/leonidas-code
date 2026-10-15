import type { ThreadContextBreakdown } from "@t3tools/contracts";

export interface TrimSuggestion {
  readonly key: string;
  readonly kind: "mcp" | "skill" | "agent" | "memory" | "tool-results";
  readonly label: string;
  /** Tokens this item adds to every turn while it stays loaded. */
  readonly tokens: number;
  readonly estimated: boolean;
  /** MCP server that this chat loaded but never called; false when unknown. */
  readonly unused: boolean;
}

const MIN_TRIM_TOKENS = 500;
const MAX_SUGGESTIONS = 5;
/** Newest tool calls kept out of the compact suggestion; the agent is most likely to reuse them. */
const KEEP_NEWEST_TOOL_CALLS = 10;
const MIN_OLD_TOOL_TOKENS = 2_000;
/** Fewer calls than this say too little to call a server unused. */
const MIN_CALLS_TO_JUDGE_UNUSED = 5;

const normalizeServer = (name: string) => name.replaceAll(/[^a-z0-9-]+/gi, "_").toLowerCase();

/** Servers with no call in this chat. Claude names calls `mcp__<server>__<tool>`. */
function findUnusedServers(
  servers: Iterable<string>,
  toolCalls: ReadonlyArray<{ readonly name: string }>,
): ReadonlySet<string> {
  if (toolCalls.length < MIN_CALLS_TO_JUDGE_UNUSED) return new Set();
  const called = toolCalls.map((call) => call.name.toLowerCase());
  return new Set(
    [...servers].filter((server) => {
      const prefix = `mcp__${normalizeServer(server)}__`;
      return !called.some((name) => name.startsWith(prefix));
    }),
  );
}

/**
 * Fixed overhead worth removing: MCP servers (tool schemas summed per server), skills, agents and
 * memory files, which the provider loads on every turn. Files the agent read or edited are
 * conversation, not overhead, so they never appear here.
 */
export function deriveTrimSuggestions(
  breakdown: Pick<ThreadContextBreakdown, "mcpTools" | "skills" | "agents" | "files"> &
    Partial<Pick<ThreadContextBreakdown, "toolCalls" | "categories">>,
): ReadonlyArray<TrimSuggestion> {
  const servers = new Map<string, number>();
  for (const tool of breakdown.mcpTools) {
    servers.set(tool.server, (servers.get(tool.server) ?? 0) + tool.tokens);
  }
  // Deferred tools are not in context, so full schema sizes overstate what a server costs. When
  // the provider reports the MCP tokens actually loaded, share that total by schema size.
  const loadedMcp = (breakdown.categories ?? []).find(
    (category) => category.kind === "used" && category.name.toLowerCase() === "mcp tools",
  )?.tokens;
  const schemaTotal = [...servers.values()].reduce((total, tokens) => total + tokens, 0);
  const scaleToLoaded = loadedMcp !== undefined && schemaTotal > loadedMcp;
  const unusedServers = findUnusedServers(servers.keys(), breakdown.toolCalls ?? []);
  const all: TrimSuggestion[] = [
    ...[...servers].map(([server, tokens]) => ({
      key: `mcp:${server}`,
      kind: "mcp" as const,
      label: server,
      tokens: scaleToLoaded ? Math.round((tokens / schemaTotal) * loadedMcp) : tokens,
      estimated: scaleToLoaded,
      unused: unusedServers.has(server),
    })),
    ...breakdown.skills.map((skill) => ({
      key: `skill:${skill.source}:${skill.name}`,
      kind: "skill" as const,
      label: skill.name,
      tokens: skill.tokens,
      estimated: false,
      unused: false,
    })),
    ...breakdown.agents.map((agent) => ({
      key: `agent:${agent.source}:${agent.name}`,
      kind: "agent" as const,
      label: agent.name,
      tokens: agent.tokens,
      estimated: false,
      unused: false,
    })),
    ...breakdown.files
      .filter((file) => file.origin === "memory")
      .map((file) => ({
        key: `memory:${file.path}`,
        kind: "memory" as const,
        label: file.path,
        tokens: file.tokens,
        estimated: file.estimated,
        unused: false,
      })),
  ];
  // Every old tool result is resent each turn until the chat compacts. Calls arrive oldest first.
  const oldCalls = (breakdown.toolCalls ?? []).slice(0, -KEEP_NEWEST_TOOL_CALLS);
  const oldTokens = oldCalls.reduce((total, call) => total + call.tokens, 0);
  if (oldTokens >= MIN_OLD_TOOL_TOKENS) {
    all.push({
      key: "tool-results:old",
      kind: "tool-results",
      label: `${oldCalls.length} older tool results (shorten the history)`,
      tokens: oldTokens,
      estimated: true,
      unused: false,
    });
  }
  return all
    .filter((item) => item.tokens >= MIN_TRIM_TOKENS)
    .toSorted((a, b) => b.tokens - a.tokens || a.label.localeCompare(b.label))
    .slice(0, MAX_SUGGESTIONS);
}

const sumTokens = (items: ReadonlyArray<{ readonly tokens: number }>) =>
  items.reduce((total, item) => total + item.tokens, 0);

/**
 * Tokens the provider carries on every turn before the conversation starts. When the provider
 * names its conversation category ("Messages"), everything else it counts as used is setup; that
 * skips deferred tools, which are not in context. Without a provider split, setup is unknown (0).
 * Otherwise add up what the breakdown lists.
 */
export function estimateFixedOverheadTokens(
  breakdown: Pick<
    ThreadContextBreakdown,
    "categories" | "mcpTools" | "skills" | "agents" | "files"
  >,
): number {
  const used = breakdown.categories.filter((category) => category.kind === "used");
  // Without a provider split the categories are transcript estimates, so none of them is setup.
  if (used.some((category) => category.estimated)) return 0;
  if (used.some((category) => category.name.toLowerCase() === "messages")) {
    return sumTokens(used.filter((category) => category.name.toLowerCase() !== "messages"));
  }
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
