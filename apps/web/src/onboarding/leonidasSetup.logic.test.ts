import { describe, expect, it } from "vite-plus/test";

import {
  AIOS_PRESET,
  buildAiosSetupPrompt,
  DEFAULT_AIOS_FOLDER,
  LEONIDAS_GOALS,
  normalizeGoalIds,
  selectVisibleGoals,
  toggleGoal,
} from "./leonidasSetup.logic";

describe("leonidasSetup.logic", () => {
  it("offers ten goals", () => {
    expect(LEONIDAS_GOALS).toHaveLength(10);
  });

  it("drops stored goals that no longer exist", () => {
    expect(normalizeGoalIds(["web-apps", "retired"])).toEqual(["web-apps"]);
  });

  it("toggles a goal on and off", () => {
    expect(toggleGoal([], "games")).toEqual(["games"]);
    expect(toggleGoal(["games"], "games")).toEqual([]);
  });

  it("shows six goals until the user asks for more", () => {
    expect(selectVisibleGoals([], false)).toHaveLength(6);
    expect(selectVisibleGoals([], true)).toHaveLength(10);
  });

  it("keeps a picked goal visible even past the collapsed list", () => {
    const visible = selectVisibleGoals(["learning"], false).map((goal) => goal.id);
    expect(visible).toHaveLength(7);
    expect(visible).toContain("learning");
  });

  it("names the picked goals and every preset path in the prompt", () => {
    const prompt = buildAiosSetupPrompt(["games", "data"]);
    expect(prompt).toContain("Games, Data and numbers");
    for (const entry of AIOS_PRESET) expect(prompt).toContain(entry.path);
  });

  it("stays general when no goal is picked", () => {
    expect(buildAiosSetupPrompt([])).toContain("keep the setup general");
  });

  it("defaults the AIOS folder to a named folder in Documents", () => {
    expect(DEFAULT_AIOS_FOLDER).toBe("~/Leonidas AIOS");
  });

  it("tells the chat to keep files that already exist in the folder", () => {
    const prompt = buildAiosSetupPrompt([], { inCurrentFolder: true });
    expect(prompt).toContain("Leave them alone");
    expect(prompt).toContain("ask me before you change it");
  });
});
