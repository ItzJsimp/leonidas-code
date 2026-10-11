import { describe, expect, it } from "vite-plus/test";
import { projectIdentityGlyph, threadActivityLine, threadTopicGlyph } from "./threadIdentity.ts";

describe("chat identity", () => {
  it("keeps existing emoji and assigns recognizable topic cues", () => {
    expect(threadTopicGlyph("🎨 My custom name")).toBeNull();
    expect(threadTopicGlyph("🇺🇸 Release")).toBeNull();
    expect(threadTopicGlyph("1️⃣ Roadmap")).toBeNull();
    expect(threadTopicGlyph("Fix account switching")).toBe("🔑");
    expect(threadTopicGlyph("Improve response readability")).toBe("🎨");
    expect(threadTopicGlyph("Discuss next steps")).toBe("💬");
  });
  it("gives projects stable identities without needing an AI request", () => {
    expect(projectIdentityGlyph("Leonidas AIOS")).toBe("🧠");
    expect(projectIdentityGlyph("Scribe")).toBe("✍️");
    expect(projectIdentityGlyph("  orchard  ")).toBe(projectIdentityGlyph("ORCHARD"));
  });
  it("shows actual progress, gives attention priority, and clears finished work", () => {
    const summary = {
      text: "Check\n narrow layout",
      currentStep: 2,
      completedSteps: 1,
      totalSteps: 4,
    };
    expect(threadActivityLine({ status: "working", summary })).toEqual({
      text: "Check narrow layout",
      progress: "2/4",
    });
    expect(threadActivityLine({ status: "approval", summary })).toEqual({
      text: "Needs your approval",
      progress: null,
    });
    expect(threadActivityLine({ status: "ready", summary })).toBeNull();
    expect(threadActivityLine({ status: "working" })).toEqual({
      text: "Working on this task",
      progress: null,
    });
  });
});
