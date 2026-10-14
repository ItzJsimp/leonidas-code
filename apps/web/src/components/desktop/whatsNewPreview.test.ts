import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { fetchLatestReleaseWhatsNew, parseReleaseBullets } from "./whatsNewPreview";

afterEach(() => vi.unstubAllGlobals());

describe("parseReleaseBullets", () => {
  it("keeps highlights before details in publisher order", () => {
    const body = ["Intro line", ...Array.from({ length: 10 }, (_, i) => `- change ${i}`)].join(
      "\n",
    );
    const items = parseReleaseBullets(body);
    expect(items).toHaveLength(10);
    expect(items[0]).toBe("change 0");
    expect(parseReleaseBullets("Built from abc1234")).toEqual([]);
  });
});

describe("latest release preview", () => {
  it("shows no invented sample notes when a release has an empty body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tag_name: "v0.42.0", body: "" }),
      }),
    );
    expect(await fetchLatestReleaseWhatsNew()).toEqual({ version: "0.42.0", items: [] });
  });

  it("reports an unavailable release rather than presenting an API error as notes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await fetchLatestReleaseWhatsNew();
    expect(result.version).toBe("");
    expect(result.items).toEqual([
      "Release notes could not be loaded. Open update history to try again.",
    ]);
  });
});
