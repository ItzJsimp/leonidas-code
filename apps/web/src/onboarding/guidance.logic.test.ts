import { describe, expect, it } from "vite-plus/test";
import {
  newGuidanceProfile,
  guidanceDay,
  recordGuidanceAction,
  availableTips,
  dueWeeklyCheck,
  completeWeeklyCheck,
  guidanceProfileKey,
  resetGuidance,
  AI_LEVELS,
} from "./guidance.logic";

const start = new Date(2026, 9, 15, 23, 59);
describe("adaptive guidance", () => {
  it("keeps each environment and AIOS folder separate", () => {
    expect(guidanceProfileKey("one", "~/Alice AIOS")).not.toBe(
      guidanceProfileKey("two", "~/Alice AIOS"),
    );
    expect(guidanceProfileKey("one", "~/Alice AIOS")).not.toBe(
      guidanceProfileKey("one", "~/Bob AIOS"),
    );
  });
  it("keeps all four approved AI levels", () => {
    expect(AI_LEVELS.map((level) => level.label)).toEqual([
      "New to AI",
      "Beginner",
      "Comfortable",
      "Builder",
    ]);
  });
  it("changes day at local midnight, including a clock moved backwards", () => {
    const profile = newGuidanceProfile("new", start);
    expect(guidanceDay(profile, new Date(2026, 9, 16, 0, 1))).toBe(1);
    expect(guidanceDay(profile, new Date(2026, 9, 14, 12))).toBe(0);
  });
  it("retires a tip after three successful actions", () => {
    let profile = newGuidanceProfile("new", start);
    expect(availableTips(profile, "chat", start).some((tip) => tip.action === "prompt_sent")).toBe(
      true,
    );
    for (let i = 0; i < 3; i++) profile = recordGuidanceAction(profile, "prompt_sent", start);
    expect(availableTips(profile, "chat", start).some((tip) => tip.action === "prompt_sent")).toBe(
      false,
    );
    expect(recordGuidanceAction(profile, "prompt_sent", start).counts.prompt_sent).toBe(3);
  });
  it("requires the daily action and does not reuse yesterday's completion", () => {
    const profile = newGuidanceProfile("new", start);
    expect(recordGuidanceAction(profile, "reply_stopped", start).completedDays).toEqual([]);
    const done = recordGuidanceAction(profile, "prompt_sent", start);
    expect(done.completedDays).toEqual([0]);
    expect(
      recordGuidanceAction(done, "reply_stopped", new Date(2026, 9, 16)).completedDays,
    ).toEqual([0, 1]);
  });
  it("shows only new-feature tips after thirty days", () => {
    const profile = newGuidanceProfile("builder", start);
    expect(availableTips(profile, "chat", new Date(2026, 10, 14))).toEqual([]);
    expect(dueWeeklyCheck(profile, new Date(2026, 10, 14))).toBeNull();
  });
  it("gives builders advanced tips and all levels the basics", () => {
    for (const level of AI_LEVELS)
      expect(
        availableTips(newGuidanceProfile(level.id, start), "chat", start).some(
          (tip) => !tip.advanced,
        ),
      ).toBe(true);
    expect(
      availableTips(newGuidanceProfile("new", start), "chat", start).some((tip) => tip.advanced),
    ).toBe(false);
    expect(
      availableTips(newGuidanceProfile("builder", start), "chat", start).some(
        (tip) => tip.advanced,
      ),
    ).toBe(true);
  });
  it("requires five valid answers for a weekly check and records it once", () => {
    const profile = newGuidanceProfile("new", start);
    const day7 = new Date(2026, 9, 21);
    expect(dueWeeklyCheck(profile, day7)).toBe(1);
    expect(() => completeWeeklyCheck(profile, [0], day7)).toThrow();
    expect(() => completeWeeklyCheck(profile, Array<number>(5), day7)).toThrow();
    const done = completeWeeklyCheck(profile, [0, 0, 0, 0, 0], day7);
    expect(done.weeklyResults).toHaveLength(1);
    expect(dueWeeklyCheck(done, day7)).toBeNull();
  });
  it("resets progress without changing the selected level", () => {
    const profile = recordGuidanceAction(
      newGuidanceProfile("builder", start),
      "prompt_sent",
      start,
    );
    const reset = resetGuidance(profile, new Date(2026, 9, 18));
    expect(reset.level).toBe("builder");
    expect(reset.counts.prompt_sent).toBe(0);
    expect(reset.completedDays).toEqual([]);
    expect(guidanceDay(reset, new Date(2026, 9, 18))).toBe(0);
  });
});
