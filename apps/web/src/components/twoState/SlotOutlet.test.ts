import { describe, expect, it } from "vite-plus/test";

import { slotRegistry } from "./SlotOutlet";

describe("slotRegistry", () => {
  it("finds the built-in home cards through the *.slot.tsx glob, in page order", () => {
    expect(slotRegistry.ccHome.map((entry) => entry.id).slice(0, 3)).toEqual([
      "finish-setup",
      "direction",
      "aios-home",
    ]);
    expect(slotRegistry.ccHome).toHaveLength(11);
  });
});
