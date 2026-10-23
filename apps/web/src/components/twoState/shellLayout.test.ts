import { describe, expect, it } from "vite-plus/test";

import { clampRatio, keyRatio, paneLayout, stepRatio } from "./shellLayout";

describe("paneLayout", () => {
  it("splits at 1280 px and wider when the split is on", () => {
    expect(paneLayout({ width: 1280, split: true, routeKind: "window" }).mode).toBe("split");
    expect(paneLayout({ width: 1920, split: true, routeKind: "thread" }).mode).toBe("split");
  });

  it("shows one pane below 1280 px", () => {
    expect(paneLayout({ width: 1279, split: true, routeKind: "window" })).toEqual({
      mode: "single",
      show: "left",
    });
    expect(paneLayout({ width: 900, split: true, routeKind: "thread" })).toEqual({
      mode: "single",
      show: "chat",
    });
  });

  it("shows one pane when the person turned the split off", () => {
    expect(paneLayout({ width: 1920, split: false, routeKind: "thread" })).toEqual({
      mode: "single",
      show: "chat",
    });
  });
});

describe("clampRatio", () => {
  it("keeps 360 px for each pane", () => {
    expect(clampRatio(0.1, 1200)).toBeCloseTo(0.3);
    expect(clampRatio(0.95, 1200)).toBeCloseTo(0.7);
    expect(clampRatio(0.5, 1200)).toBe(0.5);
  });

  it("falls back to half when the width cannot hold two panes", () => {
    expect(clampRatio(0.1, 600)).toBe(0.5);
    expect(clampRatio(0.9, 0)).toBe(0.5);
  });

  it("ignores a ratio that is not a number", () => {
    expect(clampRatio(Number.NaN, 1200)).toBe(0.5);
  });
});

describe("stepRatio", () => {
  it("moves 2 percent and stays inside the limits", () => {
    expect(stepRatio(0.5, 1, 1200)).toBeCloseTo(0.52);
    expect(stepRatio(0.5, -1, 1200)).toBeCloseTo(0.48);
    expect(stepRatio(0.7, 1, 1200)).toBeCloseTo(0.7);
  });
});

describe("keyRatio", () => {
  it("steps with the arrow keys and jumps to the limits with Home and End", () => {
    expect(keyRatio("ArrowRight", 0.5, 1200)).toBeCloseTo(0.52);
    expect(keyRatio("ArrowLeft", 0.5, 1200)).toBeCloseTo(0.48);
    expect(keyRatio("Home", 0.5, 1200)).toBeCloseTo(0.3);
    expect(keyRatio("End", 0.5, 1200)).toBeCloseTo(0.7);
  });
  it("ignores other keys", () => {
    expect(keyRatio("a", 0.5, 1200)).toBeNull();
  });
});
