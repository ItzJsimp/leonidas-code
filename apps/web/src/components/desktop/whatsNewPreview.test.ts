import { describe, expect, it } from "vite-plus/test";

import { parseReleaseBullets } from "./whatsNewPreview";

describe("parseReleaseBullets", () => {
  it("keeps all bullets, newest first", () => {
    const body = ["Intro line", ...Array.from({ length: 10 }, (_, i) => `- change ${i}`)].join(
      "\n",
    );
    const items = parseReleaseBullets(body);
    expect(items).toHaveLength(10);
    expect(items[0]).toBe("change 9");
    expect(parseReleaseBullets("Built from abc1234")).toEqual([]);
  });
});
