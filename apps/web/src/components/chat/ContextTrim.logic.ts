import type { ThreadContextBreakdown } from "@t3tools/contracts";

export interface TrimSuggestion {
  readonly key: string;
  readonly kind: "mcp" | "skill" | "agent" | "memory";
  readonly label: string;
  /** Tokens this item adds to every turn while it stays loaded. */
  readonly tokens: number;
  readonly estimated: boolean;
}

const MIN_TRIM_TOKENS = 500;
const MAX_SUGGESTIONS = 5;

/**
 * Fixed overhead worth removing: MCP servers (tool schemas summed per server), skills, agents and
 * memory files, which the provider loads on every turn. Files the agent read or edited are
 * conversation, not overhead, so they never appear here.
 */
export function deriveTrimSuggestions(
  breakdown: Pick<ThreadContextBreakdown, "mcpTools" | "skills" | "agents" | "files">,
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
  return all
    .filter((item) => item.tokens >= MIN_TRIM_TOKENS)
    .toSorted((a, b) => b.tokens - a.tokens || a.label.localeCompare(b.label))
    .slice(0, MAX_SUGGESTIONS);
}
