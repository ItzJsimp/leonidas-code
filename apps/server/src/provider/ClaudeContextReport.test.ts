import { describe, expect, it } from "vite-plus/test";
import type { SDKControlGetContextUsageResponse } from "@anthropic-ai/claude-agent-sdk";

import { claudeContextReportFromUsage } from "./ClaudeContextReport.ts";

const usage = (
  overrides: Partial<SDKControlGetContextUsageResponse> = {},
): SDKControlGetContextUsageResponse =>
  ({
    categories: [
      { name: "System prompt", tokens: 3200.4, color: "x", kind: "used" },
      { name: "MCP tools (deferred)", tokens: 900, color: "x", kind: "deferred", isDeferred: true },
      { name: "Free space", tokens: 190_000, color: "x", kind: "free" },
      { name: "Autocompact buffer", tokens: 33_000, color: "x", kind: "buffer" },
    ],
    totalTokens: 4100,
    maxTokens: 167_000,
    rawMaxTokens: 200_000,
    percentage: 2,
    gridRows: [],
    model: "claude-sonnet-5-5",
    memoryFiles: [{ path: "D:/repo/CLAUDE.md", type: "Project", tokens: 800 }],
    mcpTools: [{ name: "mcp__t3__list", serverName: "t3", tokens: 120 }],
    agents: [{ agentType: "executor", source: "projectSettings", tokens: 60 }],
    skills: {
      totalSkills: 2,
      includedSkills: 1,
      tokens: 40,
      skillFrontmatter: [{ name: "tdd", source: "projectSettings", tokens: 40 }],
    },
    ...overrides,
  }) as SDKControlGetContextUsageResponse;

describe("claudeContextReportFromUsage", () => {
  it("keeps SDK kinds, renames server and agent fields, and rounds tokens", () => {
    const report = claudeContextReportFromUsage(usage());
    expect(report.model).toBe("claude-sonnet-5-5");
    expect(report.totalTokens).toBe(4100);
    expect(report.maxTokens).toBe(200_000);
    expect(report.categories.map((c) => [c.kind, c.tokens])).toEqual([
      ["used", 3200],
      ["deferred", 900],
      ["free", 190_000],
      ["buffer", 33_000],
    ]);
    expect(report.memoryFiles).toEqual([
      { path: "D:/repo/CLAUDE.md", type: "Project", tokens: 800 },
    ]);
    expect(report.mcpTools).toEqual([{ name: "mcp__t3__list", server: "t3", tokens: 120 }]);
    expect(report.agents).toEqual([{ name: "executor", source: "projectSettings", tokens: 60 }]);
    expect(report.skills).toEqual([{ name: "tdd", source: "projectSettings", tokens: 40 }]);
  });

  it("tolerates missing skills, an unknown window and bad numbers", () => {
    const legacyUsage = usage({
      rawMaxTokens: 0,
      maxTokens: 0,
      totalTokens: Number.NaN,
      model: "",
    });
    Reflect.deleteProperty(legacyUsage, "skills");
    const report = claudeContextReportFromUsage(legacyUsage);
    expect(report.skills).toEqual([]);
    expect(report.maxTokens).toBeNull();
    expect(report.totalTokens).toBe(0);
    expect(report.model).toBeNull();
  });
});
