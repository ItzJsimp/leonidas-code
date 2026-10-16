import { describe, expect, it } from "vite-plus/test";

import { SUBAGENT_STARTERS, subagentStarterFiles } from "./subagentStarters";

describe("subagent starters", () => {
  it("bundles all 7 starters: 5 on and 2 off", () => {
    expect(SUBAGENT_STARTERS).toHaveLength(7);
    expect(
      SUBAGENT_STARTERS.filter((starter) => starter.enabled).map((starter) => starter.name),
    ).toEqual(["explorer", "frontend-designer", "researcher", "reviewer", "verifier"]);
    expect(
      SUBAGENT_STARTERS.filter((starter) => !starter.enabled).map((starter) => starter.name),
    ).toEqual(["backend-builder", "summarizer"]);
  });

  it("writes one file per starter under .agents/subagents with the full spec", () => {
    const files = subagentStarterFiles();
    expect(files.map((file) => file.relativePath)).toContain(
      ".agents/subagents/frontend-designer.md",
    );
    for (const file of files) {
      expect(file.contents.startsWith("---\n")).toBe(true);
      expect(file.contents).toContain("\nname: ");
    }
  });
});
