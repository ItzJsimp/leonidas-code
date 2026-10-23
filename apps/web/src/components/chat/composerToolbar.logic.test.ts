import { describe, expect, it } from "vite-plus/test";

import { moveToolbarEntry, resolveToolbarEntries } from "./composerToolbar.logic";

const empty = { hidden: [], order: [], custom: [] };

describe("composer toolbar entries", () => {
  it("falls back to the team default order", () => {
    expect(resolveToolbarEntries(empty).map((e) => e.id)).toEqual([
      "replyStyle",
      "saved",
      "stash",
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
      "replyStyle",
      "saved",
      "stash",
      "skills",
      "subagents",
    ]);
    expect(entries.find((e) => e.id === "stash")?.hidden).toBe(true);
    expect(entries.find((e) => e.id === "mine")?.custom).toBe(true);
  });

  it("moves an entry and stops at the ends", () => {
    const entries = resolveToolbarEntries(empty);
    expect(moveToolbarEntry(entries, "stash", -1).slice(0, 3)).toEqual([
      "replyStyle",
      "stash",
      "saved",
    ]);
    expect(moveToolbarEntry(entries, "replyStyle", -1)[0]).toBe("replyStyle");
  });
});
