import { describe, expect, it } from "vite-plus/test";

import {
  deriveTrimSuggestions,
  estimateFixedOverheadTokens,
  splitInputByOverhead,
} from "./ContextTrim.logic.ts";

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

  it("suggests compacting old tool results but keeps the newest ten out of the total", () => {
    const call = (i: number, tokens: number) => ({
      id: `c${i}`,
      name: "Command",
      target: null,
      tokens,
      estimated: true,
      turnIndex: i,
      status: "ok" as const,
    });
    const toolCalls = [
      call(0, 1_500),
      call(1, 1_000),
      ...Array.from({ length: 10 }, (_, i) => call(i + 2, 900)),
    ];
    const result = deriveTrimSuggestions({ ...base, toolCalls });
    expect(result.map((s) => [s.kind, s.tokens, s.estimated])).toEqual([
      ["tool-results", 2_500, true],
    ]);
  });

  it("stays quiet when old tool results are small", () => {
    const toolCalls = Array.from({ length: 12 }, (_, i) => ({
      id: `c${i}`,
      name: "Read",
      target: null,
      tokens: 100,
      estimated: true,
      turnIndex: i,
      status: "ok" as const,
    }));
    expect(deriveTrimSuggestions({ ...base, toolCalls })).toEqual([]);
  });
});

describe("estimateFixedOverheadTokens", () => {
  it("adds MCP schemas, skills, agents and memory files, but not files the agent read", () => {
    const file = (origin: "memory" | "read", tokens: number) => ({
      path: `${origin}.md`,
      tokens,
      estimated: true,
      readCount: 1,
      lastTurnIndex: null,
      origin,
    });
    expect(
      estimateFixedOverheadTokens({
        mcpTools: [{ name: "a", server: "docs", tokens: 100 }],
        skills: [{ name: "s", source: "user", tokens: 20 }],
        agents: [{ name: "g", source: "user", tokens: 3 }],
        files: [file("memory", 4_000), file("read", 9_000)],
      }),
    ).toBe(4_123);
  });
});

describe("splitInputByOverhead", () => {
  it("keeps the two parts equal to the input", () => {
    expect(splitInputByOverhead(20_000, 6_000)).toEqual({ fixed: 6_000, conversation: 14_000 });
  });

  it("never lets the estimate exceed what was sent", () => {
    expect(splitInputByOverhead(1_000, 6_000)).toEqual({ fixed: 1_000, conversation: 0 });
  });

  it("says nothing without an estimate", () => {
    expect(splitInputByOverhead(1_000, 0)).toBeNull();
  });
});
