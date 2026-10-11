import { describe, expect, it } from "vite-plus/test";
import { parseSemver, compareSemverVersions, satisfiesSemverRange } from "./semver.ts";
import {
  formatUsd,
  formatCount,
  formatTokens,
  formatPercent,
  formatDayShort,
  enumerateDays,
  enumerateHourStarts,
} from "./usageFormat.ts";
import {
  countSentences,
  capSentences,
  withModelPrediction,
  contextualPromptCandidates,
  buildPromptCandidates,
  predictPrompt,
} from "./promptPrediction.ts";
import {
  normalizeSearchQuery,
  scoreSubsequenceMatch,
  insertRankedSearchResult,
} from "./searchRanking.ts";
import { splitFilePathPosition, resolvePathLinkTarget } from "./fileLinks.ts";
import { nextTerminalId } from "./terminalLabels.ts";

describe("harness reliability at shared client boundaries", () => {
  it("compares build metadata without changing version precedence", () => {
    expect(parseSemver("2.1.3+build.42")).toMatchObject({
      major: 2,
      minor: 1,
      patch: 3,
      prerelease: [],
    });
    expect(compareSemverVersions("2.1.3+one", "2.1.3+two")).toBe(0);
    expect(satisfiesSemverRange("24.10.0+vendor.1", ">=24.10")).toBe(true);
  });
  it("preserves hyphens within prerelease identifiers", () => {
    expect(parseSemver("1.2.3-alpha-beta.2")?.prerelease).toEqual(["alpha-beta", "2"]);
    expect(compareSemverVersions("1.2.3-alpha-beta.2", "1.2.3-alpha-beta.1")).toBeGreaterThan(0);
  });
  it.each([
    "1..2",
    "1.2.3-",
    "1.2.3-alpha..1",
    "1.2.3-01",
    "1.2.3-alpha!",
    "9007199254740992.0.0",
    "1.2.3+",
    "1.2.3+a..b",
  ])("rejects malformed version %s", (value) => {
    expect(parseSemver(value)).toBeNull();
  });
  it("orders prerelease text by ASCII and large numeric identifiers exactly", () => {
    expect(compareSemverVersions("1.0.0-Z", "1.0.0-a")).toBeLessThan(0);
    expect(compareSemverVersions("1.0.0-9007199254740992", "1.0.0-9007199254740993")).toBeLessThan(
      0,
    );
  });
  it.each([NaN, Infinity, -Infinity])(
    "labels unavailable telemetry %s without inventing a total",
    (value) => {
      expect(formatUsd(value)).toBe("Unavailable");
      expect(formatCount(value)).toBe("Unavailable");
      expect(formatTokens(value)).toBe("Unavailable");
      expect(formatPercent(value)).toBe("Unavailable");
    },
  );
  it("promotes rounded token counts and removes insignificant decimal zeros", () => {
    expect(formatTokens(999_999)).toBe("1M");
    expect(formatTokens(-999_999)).toBe("-1M");
    expect(formatTokens(1_200)).toBe("1.2K");
  });
  it("bounds caller supplied percentage precision", () => {
    expect(formatPercent(0.125, -1)).toBe("13%");
    expect(formatPercent(0.125, 200)).toBe("12.500000%");
    expect(formatPercent(0.125, NaN)).toBe("12.5%");
  });
  it.each(["2026-02-30", "2026-13-01", "bad", "2026-2-1"])(
    "preserves invalid day labels and rejects invalid bucket bounds %s",
    (day) => {
      expect(formatDayShort(day)).toBe(day);
      expect(enumerateDays(day, "2026-12-31")).toEqual([]);
    },
  );
  it("bounds calendar and hourly allocations on corrupt wide windows", () => {
    expect(enumerateDays("0001-01-01", "9999-12-31")).toEqual([]);
    expect(enumerateHourStarts("0001-01-01T00:00:00Z", "9999-12-31T00:00:00Z")).toEqual([]);
    expect(enumerateDays("2024-02-28", "2024-03-01")).toEqual([
      "2024-02-28",
      "2024-02-29",
      "2024-03-01",
    ]);
  });
  it("counts empty prompts and caps an unpunctuated seventh sentence", () => {
    expect(countSentences("   ")).toBe(0);
    const six = "One. Two. Three. Four. Five. Six.";
    expect(capSentences(`${six} Seven`)).toBe(six);
  });
  it("rejects oversized model completions and keeps the combined candidate budget", () => {
    const base = Array.from({ length: 256 }, (_, index) => ({
      text: `Review feature ${index}`,
      count: 1,
      lastSeen: index,
      prefixOnly: true,
    }));
    expect(withModelPrediction(base, "x".repeat(2001))).toBe(base);
    expect(withModelPrediction(base, "Review the tests")).toHaveLength(256);
  });
  it("caps explicit next replies as well as history prompts", () => {
    const six = "One. Two. Three. Four. Five. Six.";
    expect(
      predictPrompt(
        contextualPromptCandidates(
          [],
          [{ role: "assistant", text: `Recommended reply: ${six} Seven` }],
        ),
        "",
      ),
    ).toBe(six);
  });
  it("aggregates history after sentence capping", () => {
    const six = "One. Two. Three. Four. Five. Six.";
    const row = (text: string) =>
      JSON.stringify({ cleaned_text: text, app: "claude", mode: "dictation" });
    expect(buildPromptCandidates(`${row(`${six} Seven.`)}\n${row(`${six} Eight.`)}`)).toEqual([
      { text: six, count: 2, lastSeen: 2 },
    ]);
  });
  it("normalizes whitespace left after removing a composer trigger", () => {
    expect(normalizeSearchQuery("$  UI", { trimLeadingPattern: /^\$+/ })).toBe("ui");
    expect(scoreSubsequenceMatch("ab", "abc")).toBeNull();
    expect(scoreSubsequenceMatch("axxxxx", "az")).toBeNull();
  });
  it("rejects invalid search result budgets instead of growing the list", () => {
    for (const limit of [NaN, Infinity, 0.5]) {
      const entries: Array<{ item: string; score: number; tieBreaker: string }> = [];
      insertRankedSearchResult(entries, { item: "a", score: 0, tieBreaker: "a" }, limit);
      expect(entries).toEqual([]);
    }
  });
  it("never sends unsafe editor line or column offsets", () => {
    expect(splitFilePathPosition("file.ts:9007199254740992")).toEqual({ path: "file.ts" });
    expect(splitFilePathPosition("file.ts:1:9007199254740992")).toEqual({
      path: "file.ts",
      line: 1,
    });
  });
  it("resolves Windows home links with case insensitive folders and native separators", () => {
    expect(resolvePathLinkTarget("~/notes.md", "C:\\users\\Alex\\code")).toBe(
      "C:\\users\\Alex\\notes.md",
    );
    expect(resolvePathLinkTarget("~\\notes.md", "C:\\Users\\Alex\\code")).toBe(
      "C:\\Users\\Alex\\notes.md",
    );
  });
  it("reserves terminal numbers even when stored with leading zeros", () => {
    expect(nextTerminalId(["term-01", "terminal-002"])).toBe("term-3");
  });
});
