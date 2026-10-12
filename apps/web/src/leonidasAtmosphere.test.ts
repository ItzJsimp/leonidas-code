import { describe, expect, it } from "vite-plus/test";

import { clampLeonidasGlowStrength, DEFAULT_LEONIDAS_GLOW_STRENGTH } from "./leonidasAtmosphere";

describe("Leonidas atmosphere settings", () => {
  it("rounds glow values to the slider step and clamps the supported range", () => {
    expect(clampLeonidasGlowStrength(-20)).toBe(0);
    expect(clampLeonidasGlowStrength(27)).toBe(25);
    expect(clampLeonidasGlowStrength(120)).toBe(100);
    expect(clampLeonidasGlowStrength(Number.NaN)).toBe(DEFAULT_LEONIDAS_GLOW_STRENGTH);
  });
});
