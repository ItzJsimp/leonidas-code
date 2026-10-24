import { describe, expect, it } from "vite-plus/test";

import { areaTrend, folderOf, recordAreas, searchNotes } from "./memoryOverview.logic";

describe("recordAreas", () => {
  it("saves today's counts and keeps the same object when nothing changed", () => {
    const first = recordAreas({}, "2026-10-24", [{ id: "wiki", units: 3 }]);
    expect(first).toEqual({ "2026-10-24": { wiki: 3 } });
    expect(recordAreas(first, "2026-10-24", [{ id: "wiki", units: 3 }])).toBe(first);
    expect(recordAreas(first, "2026-10-24", [])).toBe(first);
  });

  it("keeps only the newest 14 days", () => {
    let history = {};
    for (let day = 1; day <= 20; day++) {
      history = recordAreas(history, `2026-10-${String(day).padStart(2, "0")}`, [
        { id: "logs", units: day },
      ]);
    }
    const days = Object.keys(history);
    expect(days).toHaveLength(14);
    expect(days[0]).toBe("2026-10-07");
  });
});

describe("areaTrend", () => {
  const history = {
    "2026-10-10": { logs: 1 },
    "2026-10-18": { logs: 4 },
    "2026-10-20": { logs: 6, wiki: 2 },
    "2026-10-24": { logs: 9, wiki: 2 },
  };

  it("counts the change from the oldest day in the last week", () => {
    expect(areaTrend(history, "logs", "2026-10-24")).toEqual({
      series: [4, 6, 9],
      delta: 5,
      since: "2026-10-18",
    });
    expect(areaTrend(history, "wiki", "2026-10-24")).toMatchObject({
      delta: 0,
      since: "2026-10-20",
    });
  });

  it("has no change on the first day the app sees an area", () => {
    expect(areaTrend({ "2026-10-24": { logs: 9 } }, "logs", "2026-10-24")).toEqual({
      series: [9],
      delta: null,
      since: null,
    });
  });
});

describe("searchNotes", () => {
  const item = (path: string, title: string, summary = "") => ({
    path,
    title,
    summary,
    date: null,
    changedAt: 0,
  });

  it("matches every word across title, summary and path, in all folders", () => {
    const results = searchNotes(
      [
        { folder: "decisions", items: [item("decisions/0010-git.md", "Git replaces the log")] },
        { folder: "wiki", items: [item("wiki/git.md", "Git basics", "branches and logs")] },
      ],
      "git LOG",
    );
    expect(results.map((result) => [result.folder, result.path])).toEqual([
      ["decisions", "decisions/0010-git.md"],
      ["wiki", "wiki/git.md"],
    ]);
    expect(searchNotes([], "  ")).toEqual([]);
  });
});

describe("folderOf", () => {
  it("names the folder of a note path", () => {
    expect(folderOf("logs/briefings/a.md")).toBe("logs");
    expect(folderOf("tasks/a.md")).toBeNull();
  });
});
