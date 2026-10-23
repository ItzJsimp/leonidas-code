import { describe, expect, it } from "vite-plus/test";

import { slots } from "./homeCards.slot";

const ids = (slots.ccHome ?? []).map((entry) => entry.id);

describe("built-in Command Center home cards", () => {
  it("leaves Goal progress to the widget and drops Voice-log and Extra cards", () => {
    for (const id of ["goal-progress", "voice-log", "home-extras", "direction", "aios-home"]) {
      expect(ids).not.toContain(id);
    }
    expect(ids).toEqual(["finish-setup", "workspace-pack", "team"]);
  });

  it("keeps Value meter, Helpers, Laya and Ponytail off the home page", () => {
    for (const id of ["value-meter", "subagent-studio", "laya-monitor", "ponytail"]) {
      expect(ids).not.toContain(id);
    }
  });
});
