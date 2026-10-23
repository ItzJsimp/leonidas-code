import { describe, expect, it } from "vite-plus/test";

import { nextTabIndex, resolveWindowTab } from "./RailWindow";

const TABS = [
  { id: "all", label: "All" },
  { id: "needs", label: "Needs you" },
];

describe("resolveWindowTab", () => {
  it("shows the tab the search value names", () => {
    expect(resolveWindowTab(TABS, "needs")).toBe("needs");
  });
  it("falls back to the first tab for a missing or unknown value", () => {
    expect(resolveWindowTab(TABS, undefined)).toBe("all");
    expect(resolveWindowTab(TABS, "gone")).toBe("all");
    expect(resolveWindowTab([], "all")).toBeUndefined();
  });
});

describe("nextTabIndex", () => {
  it("moves with the arrow keys and wraps", () => {
    expect(nextTabIndex("ArrowRight", 0, 3)).toBe(1);
    expect(nextTabIndex("ArrowRight", 2, 3)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 0, 3)).toBe(2);
  });
  it("jumps with Home and End and ignores other keys", () => {
    expect(nextTabIndex("Home", 2, 3)).toBe(0);
    expect(nextTabIndex("End", 0, 3)).toBe(2);
    expect(nextTabIndex("a", 0, 3)).toBeNull();
    expect(nextTabIndex("ArrowRight", 0, 0)).toBeNull();
  });
});
