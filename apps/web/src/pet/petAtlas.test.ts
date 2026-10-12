import { describe, expect, it } from "vite-plus/test";

import { PET_STATE_DEFS, PET_STATES, frameAt } from "./petAtlas";

describe("frameAt", () => {
  it("walks idle frames by their hold times and loops", () => {
    expect(frameAt("idle", 0).col).toBe(0);
    expect(frameAt("idle", 279).col).toBe(0);
    expect(frameAt("idle", 280).col).toBe(1);
    expect(frameAt("idle", 280 + 110 + 110 + 140 + 140).col).toBe(5);
    const cycle = 280 + 110 + 110 + 140 + 140 + 320;
    expect(frameAt("idle", cycle).col).toBe(0);
    expect(frameAt("idle", -1).col).toBe(5);
  });

  it("holds the last frame of a uniform state longer", () => {
    const waving = PET_STATE_DEFS.waving.frames;
    expect(waving.map((f) => f.durationMs)).toEqual([140, 140, 140, 280]);
  });

  it("gives every state its own atlas row", () => {
    const rows = PET_STATES.map((state) => PET_STATE_DEFS[state].row);
    expect(rows).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
