import { describe, expect, it } from "vite-plus/test";

import { EMPTY_LIST, fixtureList, fixturePost } from "./marketing.fixtures";
import {
  contentRows,
  DECIDE_REASON_TEXT,
  groupQueueByBrand,
  metricTotals,
  summarizeResults,
} from "./marketing.logic";

describe("groupQueueByBrand", () => {
  it("groups by brand and keeps the order", () => {
    const groups = groupQueueByBrand(fixtureList(4, 0).queue);
    expect(groups.map((g) => [g.brand, g.items.length])).toEqual([
      ["pixel-pets", 2],
      ["acme-games", 2],
    ]);
  });
  it("is empty for an empty queue", () => {
    expect(groupQueueByBrand(EMPTY_LIST.queue)).toEqual([]);
  });
});

describe("summarizeResults", () => {
  it("counts done and names each failure in plain words", () => {
    const out = summarizeResults([
      { ticketId: "apr_a", ok: true },
      { ticketId: "apr_b", ok: false, reason: "content_changed" },
    ]);
    expect(out.line).toBe("1 done, 1 not done.");
    expect(out.failed).toEqual([{ ticketId: "apr_b", text: DECIDE_REASON_TEXT.content_changed }]);
    expect(summarizeResults([{ ticketId: "apr_a", ok: true }]).line).toBe("1 item done.");
  });
});

describe("content and metrics", () => {
  it("joins the newest snapshot to each posted item", () => {
    const rows = contentRows(fixtureList(1, 2));
    const posted = rows.filter((row) => row.post.status === "posted");
    expect(posted.map((row) => row.latest?.impressions).toSorted()).toEqual([500, 501]);
    expect(rows.find((row) => row.post.status === "draft")?.latest).toBeNull();
  });
  it("counts each post once in the totals", () => {
    expect(metricTotals(fixtureList(0, 2).metrics)).toMatchObject({
      posts: 2,
      impressions: 1001,
      likes: 6,
    });
    expect(metricTotals([])).toMatchObject({ posts: 0, impressions: 0 });
  });
});

describe("visible text", () => {
  it("never says MCP, worktree or T3", () => {
    const text = JSON.stringify([DECIDE_REASON_TEXT, fixturePost(1).text]);
    expect(text).not.toMatch(/\bMCP\b|worktree|\bT3\b/i);
  });
});
