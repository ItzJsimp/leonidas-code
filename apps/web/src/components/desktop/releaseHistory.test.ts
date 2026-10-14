import { describe, expect, it, vi } from "vite-plus/test";
import { fetchReleaseEntry, fetchReleaseHistory, parseReleaseHistory } from "./releaseHistory";

describe("release history", () => {
  it("loads the exact downloaded release and rejects a mismatched version", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({ tag_name: "v0.42.0", body: "# Tasks\n\nTasks that stay in sync." }),
          ),
      );
    try {
      expect((await fetchReleaseEntry("v0.42.0")).article.title).toBe("Tasks");
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/tags/v0.42.0"), {
        signal: null,
      });
      await expect(fetchReleaseEntry("0.41.0")).rejects.toThrow("does not match");
      await expect(fetchReleaseEntry("../../private")).rejects.toThrow("Invalid release version");
    } finally {
      fetch.mockRestore();
    }
  });
  it("retains every bullet, including older 1.0 releases, and omits drafts", () => {
    const body = Array.from({ length: 12 }, (_, index) => `- Change ${index}`).join("\n");
    const entries = parseReleaseHistory([
      { tag_name: "v0.2.0", body, published_at: "2026-10-11T00:00:00Z" },
      { tag_name: "v1.0.16", body: "- Older update" },
      { tag_name: "v0.3.0", draft: true },
      { tag_name: "v0.2.1-nightly.1", prerelease: true },
      null,
    ]);
    expect(entries.map((entry) => entry.version)).toEqual(["0.2.0", "1.0.16"]);
    expect(entries[0]?.notes).toHaveLength(12);
  });
  it("reports network failures instead of inventing sample release notes", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 403 }));
    try {
      await expect(fetchReleaseHistory(1)).rejects.toThrow("limited requests");
    } finally {
      fetch.mockRestore();
    }
  });
  it("loads bounded older pages and rejects unexpected response shapes", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify(Array.from({ length: 10 }, (_, index) => ({ tag_name: `v0.1.${index}` }))),
        ),
      );
    try {
      expect((await fetchReleaseHistory(2)).hasMore).toBe(true);
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("per_page=10&page=2"), {
        signal: null,
      });
      expect(() => parseReleaseHistory({ message: "bad" })).toThrow();
    } finally {
      fetch.mockRestore();
    }
  });
});
