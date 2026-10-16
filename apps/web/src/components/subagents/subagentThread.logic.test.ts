import { describe, expect, it } from "vite-plus/test";

import type { SubagentCatalogEntry } from "@t3tools/contracts";

import {
  composerSubagentOptions,
  searchSubagentOptions,
  withAttachedSubagent,
} from "./subagentThread.logic";

const entry = (over: Partial<SubagentCatalogEntry>): SubagentCatalogEntry => ({
  name: "a",
  description: null,
  source: "aios",
  projectName: null,
  specPath: "/x/a.md",
  extends: null,
  enabled: true,
  model: null,
  account: null,
  tier: null,
  tools: [],
  never: [],
  context: [],
  estimatedStartTokens: null,
  legacy: false,
  error: null,
  ...over,
});

describe("composerSubagentOptions", () => {
  it("keeps on, valid entries once per name, sorted", () => {
    const options = composerSubagentOptions([
      entry({ name: "zed" }),
      entry({ name: "alpha", description: "First" }),
      entry({ name: "alpha", source: "project", specPath: "/p/alpha.md" }),
      entry({ name: "off", enabled: false }),
      entry({ name: "old", legacy: true }),
      entry({ name: "bad", error: "x" }),
    ]);
    expect(options.map((option) => option.name)).toEqual(["alpha", "zed"]);
    expect(options[0]?.description).toBe("First");
  });
});

describe("searchSubagentOptions", () => {
  const options = [
    { name: "executor", description: "Runs edits" },
    { name: "frontend-designer", description: null },
  ];
  it("matches name and description", () => {
    expect(searchSubagentOptions(options, "front").map((o) => o.name)).toEqual([
      "frontend-designer",
    ]);
    expect(searchSubagentOptions(options, "EDITS").map((o) => o.name)).toEqual(["executor"]);
    expect(searchSubagentOptions(options, " ")).toHaveLength(2);
  });
});

describe("withAttachedSubagent", () => {
  const known = new Set(["executor", "frontend-designer"]);
  it("leads every message with the attached name", () => {
    expect(withAttachedSubagent("fix it", "executor", known)).toBe("@executor fix it");
    expect(withAttachedSubagent("again", "executor", known)).toBe("@executor again");
  });
  it("keeps a message that names its own subagent", () => {
    expect(withAttachedSubagent("@frontend-designer fix", "executor", known)).toBe(
      "@frontend-designer fix",
    );
  });
  it("leaves blank text and leading commands alone", () => {
    expect(withAttachedSubagent("  ", "executor", known)).toBe("  ");
    expect(withAttachedSubagent("/compact", "executor", known)).toBe("/compact");
  });
  it("sends text unchanged with no attach or an unknown attach", () => {
    expect(withAttachedSubagent("hi", null, known)).toBe("hi");
    expect(withAttachedSubagent("hi", "gone", known)).toBe("hi");
  });
});
