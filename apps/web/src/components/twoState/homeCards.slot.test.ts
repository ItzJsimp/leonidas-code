import { describe, expect, it } from "vite-plus/test";

import { slots } from "./homeCards.slot";

const ids = (slots.ccHome ?? []).map((entry) => entry.id);

describe("built-in Command Center home cards", () => {
  it("has one Goal progress card instead of Direction and The Focus", () => {
    expect(ids).toContain("goal-progress");
    expect(ids).not.toContain("direction");
    expect(ids).not.toContain("aios-home");
  });

  it("keeps Value meter, Helpers, Laya and Ponytail off the home page", () => {
    for (const id of ["value-meter", "subagent-studio", "laya-monitor", "ponytail"]) {
      expect(ids).not.toContain(id);
    }
  });
});
