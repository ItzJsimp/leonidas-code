import type { SDKControlGetContextUsageResponse } from "@anthropic-ai/claude-agent-sdk";
import type { ProviderAdapterV2ContextReport } from "@t3tools/provider-core/server/ProviderAdapter";

const wholeTokens = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;

/**
 * Maps the Claude Agent SDK getContextUsage answer to the provider-neutral
 * report. Classification stays on the SDK's `kind`, never the English row name.
 * Only fields every Claude CLI version sends are read; newer optional sections
 * (system prompt sections, slash commands) are left out until a UI needs them.
 */
export function claudeContextReportFromUsage(
  usage: SDKControlGetContextUsageResponse,
): ProviderAdapterV2ContextReport {
  const window = usage.rawMaxTokens > 0 ? usage.rawMaxTokens : usage.maxTokens;
  return {
    model: usage.model.length > 0 ? usage.model : null,
    totalTokens: wholeTokens(usage.totalTokens),
    maxTokens: window > 0 ? wholeTokens(window) : null,
    categories: usage.categories.map((category) => ({
      name: category.name,
      kind: category.kind,
      tokens: wholeTokens(category.tokens),
    })),
    memoryFiles: usage.memoryFiles.map((file) => ({
      path: file.path,
      type: file.type,
      tokens: wholeTokens(file.tokens),
    })),
    mcpTools: usage.mcpTools.map((tool) => ({
      name: tool.name,
      server: tool.serverName,
      tokens: wholeTokens(tool.tokens),
    })),
    skills: (usage.skills?.skillFrontmatter ?? []).map((skill) => ({
      name: skill.name,
      source: skill.source,
      tokens: wholeTokens(skill.tokens),
    })),
    agents: usage.agents.map((agent) => ({
      name: agent.agentType,
      source: agent.source,
      tokens: wholeTokens(agent.tokens),
    })),
  };
}
