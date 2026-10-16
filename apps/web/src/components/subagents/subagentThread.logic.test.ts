import { describe, expect, it } from "vite-plus/test";

import type { SubagentCatalogEntry } from "@t3tools/contracts";

import {
  composerSubagentOptions,
  findSubagentMention,
  resolveAttachedSubagent,
  splitSubagentMentions,
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

describe("findSubagentMention", () => {
  const options = [{ name: "explorer", description: "Finds things" }];

  it("finds a mention that names a subagent", () => {
    expect(findSubagentMention(options, "explorer")?.name).toBe("explorer");
  });

  it("leaves file paths and unknown names alone", () => {
    expect(findSubagentMention(options, "src/explorer")).toBeNull();
    expect(findSubagentMention(options, "explorer.ts")).toBeNull();
    expect(findSubagentMention(options, "other")).toBeNull();
  });
});

describe("splitSubagentMentions", () => {
  it("splits a known mention out of prose", () => {
    expect(splitSubagentMentions("ask @explorer to look, please", ["explorer"])).toEqual([
      { kind: "text", text: "ask " },
      { kind: "subagent", name: "explorer", raw: "@explorer" },
      { kind: "text", text: " to look, please" },
    ]);
  });

  it("keeps unknown names, addresses and plain text whole", () => {
    expect(splitSubagentMentions("mail me@explorer.com", ["explorer"])).toEqual([
      { kind: "text", text: "mail me@explorer.com" },
    ]);
    expect(splitSubagentMentions("@other hi", ["explorer"])).toEqual([
      { kind: "text", text: "@other hi" },
    ]);
    expect(splitSubagentMentions("no mention", ["explorer"])).toEqual([
      { kind: "text", text: "no mention" },
    ]);
  });

  it("matches a mention at the start and at the end", () => {
    const parts = splitSubagentMentions("@explorer", ["explorer"]);
    expect(parts).toEqual([{ kind: "subagent", name: "explorer", raw: "@explorer" }]);
  });
});

describe("resolveAttachedSubagent", () => {
  it("prefers the thread record over this device", () => {
    expect(resolveAttachedSubagent("explorer", "reviewer")).toBe("explorer");
  });

  it("falls back to this device for a draft or an older server", () => {
    expect(resolveAttachedSubagent(undefined, "reviewer")).toBe("reviewer");
    expect(resolveAttachedSubagent(null, "reviewer")).toBe("reviewer");
    expect(resolveAttachedSubagent(null, null)).toBeNull();
  });
});
