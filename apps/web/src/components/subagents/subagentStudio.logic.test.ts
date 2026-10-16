import type { SubagentCatalogEntry } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { countReady, formatTokensShort, groupStudioEntries } from "./subagentStudio.logic";

const entry = (overrides: Partial<SubagentCatalogEntry>): SubagentCatalogEntry => ({
  name: "explorer",
  description: "Finds code.",
  source: "aios",
  projectName: null,
  specPath: `/aios/.agents/subagents/${overrides.name ?? "explorer"}.md`,
  extends: null,
  enabled: true,
  model: "claude-haiku-5-5",
  account: null,
  tier: "free",
  tools: ["Read"],
  never: [],
  context: [],
  estimatedStartTokens: 8_000,
  legacy: false,
  error: null,
  ...overrides,
});

const entries = [
  entry({ name: "explorer" }),
  entry({ name: "summarizer", enabled: false }),
  entry({ name: "roblox", source: "project", projectName: "rent-due-games" }),
  entry({ name: "old", legacy: true, enabled: false }),
  entry({ name: "broken", error: "No base." }),
];

describe("groupStudioEntries", () => {
  it("splits on, catalog, projects and needs fixing", () => {
    const groups = groupStudioEntries(entries, "");
    expect(groups.map((group) => [group.key, group.entries.map((item) => item.name)])).toEqual([
      ["on", ["explorer"]],
      ["catalog", ["summarizer"]],
      ["projects", ["roblox"]],
      ["fix", ["old", "broken"]],
    ]);
  });

  it("searches name, description and project", () => {
    const names = (query: string) =>
      groupStudioEntries(entries, query).flatMap((group) => group.entries.map((item) => item.name));
    expect(names("rent-due")).toEqual(["roblox"]);
    expect(names("FINDS")).toHaveLength(5);
    expect(names("zzz")).toEqual([]);
  });
});

describe("KPI helpers", () => {
  it("counts only subagents that would start", () => {
    expect(countReady(entries)).toBe(2);
  });

  it("formats token counts for the strip", () => {
    expect(formatTokensShort(950)).toBe("950");
    expect(formatTokensShort(10_830)).toBe("10.8k");
  });
});
