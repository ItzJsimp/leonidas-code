import { describe, expect, it } from "vite-plus/test";

import { moveToolbarEntry, resolveToolbarEntries } from "./composerToolbar.logic";

const empty = { hidden: [], order: [], custom: [] };

describe("composer toolbar entries", () => {
  it("falls back to the team default order", () => {
    expect(resolveToolbarEntries(empty).map((e) => e.id)).toEqual([
      "saved",
      "stash",
      "capture",
      "skills",
      "subagents",
      "nextAction",
    ]);
  });

  it("applies the user's order, hidden ids and custom buttons, ignoring unknown ids", () => {
    const entries = resolveToolbarEntries({
      hidden: ["stash"],
      order: ["nextAction", "gone", "mine"],
      custom: [{ id: "mine", label: "Standup", prompt: "write standup" }],
    });
    expect(entries.map((e) => e.id)).toEqual([
      "nextAction",
      "mine",
      "saved",
      "stash",
      "capture",
      "skills",
      "subagents",
    ]);
    expect(entries.find((e) => e.id === "stash")?.hidden).toBe(true);
    expect(entries.find((e) => e.id === "mine")?.custom).toBe(true);
  });

  it("moves an entry and stops at the ends", () => {
    const entries = resolveToolbarEntries(empty);
    expect(moveToolbarEntry(entries, "capture", -1).slice(0, 3)).toEqual([
      "saved",
      "capture",
      "stash",
    ]);
    expect(moveToolbarEntry(entries, "saved", -1)[0]).toBe("saved");
  });
});
