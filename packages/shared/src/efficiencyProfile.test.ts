import { describe, expect, it } from "vite-plus/test";

import { EFFICIENCY_PROFILES } from "./efficiencyProfile.ts";

describe("EFFICIENCY_PROFILES", () => {
  it("routes Economy by cost, Max by quality, and leaves Balanced on the picked model", () => {
    expect(EFFICIENCY_PROFILES.economy.routePreference).toBe("cost");
    expect(EFFICIENCY_PROFILES.max.routePreference).toBe("quality");
    expect(EFFICIENCY_PROFILES.balanced.routePreference).toBeNull();
  });
});
