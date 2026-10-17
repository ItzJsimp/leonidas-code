import { describe, expect, it, vi } from "vite-plus/test";

import {
  FIRST_PLAN_PROMPT,
  WEEKLY_REPLAN_PROMPT,
  horizonPreview,
  placeReplanPrompt,
  replanPrompt,
  staleMessage,
} from "./direction.logic";

describe("replanPrompt", () => {
  it("offers the first-time grill when there are no goals and no items", () => {
    expect(replanPrompt({ goals: [], horizons: [] })).toBe(FIRST_PLAN_PROMPT);
  });
  it("offers the weekly grill when goals exist", () => {
    const goal = { id: "G0", goal: "x", measuredBy: "", targetDate: "", status: "" };
    expect(replanPrompt({ goals: [goal], horizons: [] })).toBe(WEEKLY_REPLAN_PROMPT);
  });
  it("tells the agent which file and markers to change", () => {
    expect(WEEKLY_REPLAN_PROMPT).toContain("ideal-state/horizons.md");
    expect(WEEKLY_REPLAN_PROMPT).toContain("<!-- week:start -->");
  });
});

describe("staleMessage", () => {
  it("is null for a fresh week", () => {
    expect(staleMessage({ weekStale: false, weekAgeDays: 3 })).toBeNull();
  });
  it("names the age, or the missing date", () => {
    expect(staleMessage({ weekStale: true, weekAgeDays: 9 })).toContain("9 days old");
    expect(staleMessage({ weekStale: true, weekAgeDays: null })).toContain("no date");
  });
});

describe("placeReplanPrompt", () => {
  it("copies and fills the chat box, and starts nothing else", async () => {
    const setPrompt = vi.fn();
    const writeClipboard = vi.fn().mockResolvedValue(undefined);
    const openDraft = vi.fn().mockResolvedValue({ setPrompt });
    const result = await placeReplanPrompt({ openDraft, writeClipboard }, "hello");
    expect(result).toEqual({ copied: true, placed: true });
    expect(writeClipboard).toHaveBeenCalledWith("hello");
    expect(setPrompt).toHaveBeenCalledWith("hello");
    expect(setPrompt).toHaveBeenCalledTimes(1);
  });

  it("still fills the box when the clipboard fails", async () => {
    const setPrompt = vi.fn();
    const result = await placeReplanPrompt(
      {
        openDraft: async () => ({ setPrompt }),
        writeClipboard: () => Promise.reject(new Error("denied")),
      },
      "hello",
    );
    expect(result).toEqual({ copied: false, placed: true });
    expect(setPrompt).toHaveBeenCalledWith("hello");
  });

  it("reports not placed when no draft can open", async () => {
    const result = await placeReplanPrompt(
      { openDraft: async () => null, writeClipboard: async () => {} },
      "hello",
    );
    expect(result).toEqual({ copied: true, placed: false });
  });
});

describe("horizonPreview", () => {
  it("shortens long text and handles empty lists", () => {
    expect(horizonPreview([])).toBe("Nothing planned yet.");
    expect(horizonPreview(["a".repeat(200)]).length).toBe(90);
  });
});
