import { describe, expect, it } from "vite-plus/test";

import { deriveWasteFindings } from "./ContextWaste.logic.ts";

const call = (
  id: string,
  over: Partial<{
    name: string;
    target: string | null;
    tokens: number;
    status: "ok" | "error" | "unknown";
  }> = {},
) => ({
  id,
  name: "Read",
  target: "a.ts" as string | null,
  tokens: 100,
  estimated: true,
  turnIndex: 1,
  status: "ok" as "ok" | "error" | "unknown",
  ...over,
});
const file = (path: string, readCount: number, tokens = 2_000) => ({
  path,
  tokens,
  estimated: true,
  readCount,
  lastTurnIndex: 3,
  origin: "read" as const,
});

describe("deriveWasteFindings", () => {
  it("flags a file read three or more times and counts the extra copies", () => {
    expect(deriveWasteFindings({ files: [file("src/a.ts", 4)], toolCalls: [] })).toEqual([
      {
        key: "reread:src/a.ts",
        kind: "repeated-read",
        label: "src/a.ts read 4 times",
        tokens: 6_000,
      },
    ]);
  });

  it("ignores files read once or twice and memory files", () => {
    expect(
      deriveWasteFindings({
        files: [file("a.ts", 2), { ...file("CLAUDE.md", 9), origin: "memory" }],
        toolCalls: [],
      }),
    ).toEqual([]);
  });

  it("flags a single tool result of 20k tokens or more", () => {
    const result = deriveWasteFindings({
      files: [],
      toolCalls: [call("1", { name: "Bash", target: "pnpm test", tokens: 25_000 })],
    });
    expect(result).toEqual([
      {
        key: "big:1",
        kind: "big-result",
        label: "Bash pnpm test returned a huge result",
        tokens: 25_000,
      },
    ]);
  });

  it("flags the same failing call repeated three times", () => {
    const failing = ["1", "2", "3"].map((id) =>
      call(id, { name: "Bash", target: "tsc", tokens: 400, status: "error" }),
    );
    expect(deriveWasteFindings({ files: [], toolCalls: failing })).toEqual([
      {
        key: "retry:Bash:tsc",
        kind: "retry-loop",
        label: "Bash tsc failed 3 times",
        tokens: 1_200,
      },
    ]);
  });

  it("ranks by tokens and keeps three", () => {
    const files = ["a", "b", "c", "d"].map((n, i) => file(`${n}.ts`, 3, 1_000 * (i + 1)));
    const result = deriveWasteFindings({ files, toolCalls: [] });
    expect(result.map((f) => f.label)).toEqual([
      "d.ts read 3 times",
      "c.ts read 3 times",
      "b.ts read 3 times",
    ]);
  });
});
