import { describe, expect, it } from "vite-plus/test";

import {
  addToHistory,
  buildSimReport,
  clicksInStep,
  finishRun,
  isCountedKey,
  moveToStep,
  recordClick,
  recordKey,
  reportFileName,
  startRun,
  totalKeys,
} from "./onboardingSim.logic";

describe("onboarding simulation run", () => {
  it("counts active time per step and caps long pauses", () => {
    let run = recordClick(startRun("fresh", 0), "Continue", 3_000);
    run = recordClick(run, "Continue", 4_000);
    run = moveToStep(run, "connect");
    run = recordKey(run, 100_000); // a 96s pause is the tester talking, not the user working
    expect(run.stepMs).toEqual({ welcome: 4_000, connect: 8_000 });
    expect(run.keys).toEqual({ connect: 1 });
  });

  it("keeps the last runs, newest first, without duplicates", () => {
    const run = finishRun(recordClick(startRun("veteran", 0), "Import", 1_000), 2_000, null);
    const once = addToHistory([], run);
    expect(addToHistory(once, run)).toBe(once);
    expect(once[0]?.report).toContain("1 clicks");
    expect(reportFileName(once[0]!)).toMatch(
      /^onboarding-sim-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-veteran\.md$/,
    );
  });

  it("reports totals, notes and the outside-the-app steps", () => {
    const base = moveToStep(startRun("fresh", 0), "agents");
    const run = finishRun(
      {
        ...base,
        stepMs: { agents: 5_000 },
        clicks: [
          { step: "welcome", label: "Continue", at: 1 },
          { step: "agents", label: "Continue with ChatGPT", at: 2 },
        ],
        keys: { agents: 3 },
        notes: [{ step: "agents", text: "Sign-in needs fewer steps", at: 3, clicksSoFar: 2 }],
        external: [{ step: "agents", label: "ChatGPT sign-in page" }],
      },
      5_000,
      "Started the AIOS chat",
    );
    const report = buildSimReport(run);
    expect(clicksInStep(run, "agents")).toBe(1);
    expect(totalKeys(run)).toBe(3);
    expect(report).toContain("**2 clicks, 3 keystrokes, 10s of active use");
    expect(report).toContain("Ended: Started the AIOS chat");
    expect(report).toContain("[Agents, after click 2] Sign-in needs fewer steps");
    expect(report).toContain("- [Agents] ChatGPT sign-in page");
    expect(report).toContain("2. [Agents] Continue with ChatGPT");
  });

  it("counts typing and Enter but not shortcuts or navigation keys", () => {
    const key = (value: string, mods = {}) => ({
      key: value,
      ctrlKey: false,
      metaKey: false,
      ...mods,
    });
    expect(isCountedKey(key("a"))).toBe(true);
    expect(isCountedKey(key("Enter"))).toBe(true);
    expect(isCountedKey(key("Shift"))).toBe(false);
    expect(isCountedKey(key("Tab"))).toBe(false);
    expect(isCountedKey(key("c", { ctrlKey: true }))).toBe(false);
  });
});
