import { describe, expect, it } from "vite-plus/test";

import {
  barSegments,
  formatWindowPercent,
  groupToolCalls,
  matchesQuery,
  percentOfWindow,
  sortRows,
  type BreakdownRow,
} from "./ContextBreakdown.logic.ts";

describe("ContextBreakdown.logic", () => {
  describe("percentOfWindow", () => {
    it("computes percentage correctly", () => {
      expect(percentOfWindow(50_000, 200_000)).toBe(25);
      expect(percentOfWindow(0, 200_000)).toBe(0);
      expect(percentOfWindow(10_000, null)).toBeNull();
      expect(percentOfWindow(10_000, 0)).toBeNull();
    });
  });

  describe("formatWindowPercent", () => {
    it("formats window percentages nicely", () => {
      expect(formatWindowPercent(50_000, 200_000)).toBe("25%");
      expect(formatWindowPercent(0, 200_000)).toBe("0%");
      expect(formatWindowPercent(50, 200_000)).toBe("<0.1%");
      expect(formatWindowPercent(3_200, 200_000)).toBe("1.6%");
      expect(formatWindowPercent(10_000, null)).toBe("");
    });
  });

  describe("matchesQuery", () => {
    it("matches empty queries", () => {
      expect(matchesQuery("", "foo", "bar")).toBe(true);
      expect(matchesQuery("   ", "foo")).toBe(true);
    });

    it("matches all words case-insensitively", () => {
      expect(matchesQuery("foo bar", "Foo and Bar")).toBe(true);
      expect(matchesQuery("foo baz", "Foo and Bar")).toBe(false);
      expect(matchesQuery("sub", null, "Subagent tool")).toBe(true);
    });
  });

  describe("sortRows", () => {
    const rows: BreakdownRow[] = [
      { key: "1", name: "b.ts", detail: null, tokens: 500, estimated: false },
      { key: "2", name: "a.ts", detail: null, tokens: 1000, estimated: false },
      { key: "3", name: "c.ts", detail: null, tokens: 500, estimated: false },
    ];

    it("sorts by size descending with name tie-breaker", () => {
      const sorted = sortRows(rows, "size");
      expect(sorted.map((r) => r.name)).toEqual(["a.ts", "b.ts", "c.ts"]);
    });

    it("sorts by name ascending", () => {
      const sorted = sortRows(rows, "name");
      expect(sorted.map((r) => r.name)).toEqual(["a.ts", "b.ts", "c.ts"]);
    });
  });

  describe("groupToolCalls", () => {
    it("groups calls by tool name and aggregates tokens", () => {
      const groups = groupToolCalls(
        [
          {
            id: "1",
            name: "read_file",
            target: "foo.ts",
            tokens: 100,
            estimated: false,
            turnIndex: 1,
            status: "ok",
          },
          {
            id: "2",
            name: "read_file",
            target: "bar.ts",
            tokens: 200,
            estimated: true,
            turnIndex: 2,
            status: "ok",
          },
          {
            id: "3",
            name: "run_command",
            target: "ls",
            tokens: 50,
            estimated: false,
            turnIndex: 3,
            status: "ok",
          },
        ],
        "",
        "size",
      );

      expect(groups).toHaveLength(2);
      expect(groups[0]?.name).toBe("read_file");
      expect(groups[0]?.tokens).toBe(300);
      expect(groups[0]?.estimated).toBe(true);
      expect(groups[0]?.calls).toHaveLength(2);
      expect(groups[1]?.name).toBe("run_command");
      expect(groups[1]?.tokens).toBe(50);
    });
  });

  describe("barSegments", () => {
    it("ranks used categories before buffer and free space", () => {
      const segments = barSegments(
        [
          { name: "Free", kind: "free", tokens: 150_000, estimated: false },
          { name: "Buffer", kind: "buffer", tokens: 20_000, estimated: false },
          { name: "Files", kind: "used", tokens: 10_000, estimated: false },
          { name: "Transcript", kind: "used", tokens: 20_000, estimated: true },
        ],
        200_000,
      );

      expect(segments.map((s) => s.name)).toEqual(["Transcript", "Files", "Buffer", "Free"]);
      expect(segments[0]?.width).toBe(10); // 20k / 200k = 10%
      expect(segments[1]?.width).toBe(5); // 10k / 200k = 5%
    });
  });
});
