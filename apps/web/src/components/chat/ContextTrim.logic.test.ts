import { describe, expect, it } from "vite-plus/test";

import { deriveTrimSuggestions } from "./ContextTrim.logic.ts";

const base = { mcpTools: [], skills: [], agents: [], files: [] };

describe("deriveTrimSuggestions", () => {
  it("sums MCP tool schemas per server and ranks largest first", () => {
    const result = deriveTrimSuggestions({
      ...base,
      mcpTools: [
        { name: "a", server: "docs", tokens: 900 },
        { name: "b", server: "docs", tokens: 800 },
        { name: "c", server: "git", tokens: 1_000 },
      ],
    });
    expect(result.map((s) => [s.label, s.tokens, s.kind])).toEqual([
      ["docs", 1_700, "mcp"],
      ["git", 1_000, "mcp"],
    ]);
  });

  it("ignores items under the floor and caps the list", () => {
    const skills = Array.from({ length: 8 }, (_, i) => ({
      name: `s${i}`,
      source: "user",
      tokens: 1_000 + i,
    }));
    const result = deriveTrimSuggestions({
      ...base,
      skills: [...skills, { name: "tiny", source: "user", tokens: 50 }],
    });
    expect(result).toHaveLength(5);
    expect(result[0]?.label).toBe("s7");
    expect(result.some((s) => s.label === "tiny")).toBe(false);
  });

  it("offers loaded memory files but never files the agent read or edited", () => {
    const file = (path: string, origin: "memory" | "read") => ({
      path,
      tokens: 4_000,
      estimated: true,
      readCount: 1,
      lastTurnIndex: 0,
      origin,
    });
    const result = deriveTrimSuggestions({
      ...base,
      files: [file("CLAUDE.md", "memory"), file("src/a.ts", "read")],
    });
    expect(result.map((s) => s.label)).toEqual(["CLAUDE.md"]);
    expect(result[0]?.estimated).toBe(true);
  });
});
