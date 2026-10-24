import { describe, expect, it } from "@effect/vitest";

import { BRIEF_PATH, toggleBriefLine } from "./briefPriorityToggle.ts";

const brief = [
  "# Brief",
  "- **Priorities Seeded:**",
  "- [ ] **Ship:** today",
  "  - [x] **Rest:** sleep",
  "",
].join("\n");

describe("toggleBriefLine", () => {
  it("ticks the one matching line and leaves every other byte alone", () => {
    const result = toggleBriefLine(brief, "- [ ] **Ship:** today", true);
    expect(result).toEqual({
      ok: true,
      text: brief.replace("- [ ] **Ship:**", "- [x] **Ship:**"),
      line: "- [x] **Ship:** today",
    });
  });

  it("clears an indented line and keeps its indent and CRLF ending", () => {
    const crlf = brief.replaceAll("\n", "\r\n");
    const result = toggleBriefLine(crlf, "- [x] **Rest:** sleep", false);
    expect(result).toMatchObject({ ok: true, line: "- [ ] **Rest:** sleep" });
    if (result.ok) expect(result.text).toBe(crlf.replace("  - [x] **Rest:**", "  - [ ] **Rest:**"));
  });

  it("refuses a line that is gone, doubled, or not a checkbox", () => {
    expect(toggleBriefLine(brief, "- [ ] **Ship:** tomorrow", true)).toEqual({
      ok: false,
      reason: "line_missing",
    });
    const doubled = `${brief}- [ ] **Ship:** today\n`;
    expect(toggleBriefLine(doubled, "- [ ] **Ship:** today", true)).toEqual({
      ok: false,
      reason: "line_ambiguous",
    });
    expect(toggleBriefLine(brief, "# Brief", true)).toEqual({
      ok: false,
      reason: "not_a_priority",
    });
  });

  it("does not match a line that only contains the priority text", () => {
    const text = "note: - [ ] **Ship:** today\n";
    expect(toggleBriefLine(text, "- [ ] **Ship:** today", true)).toMatchObject({ ok: false });
  });
});

describe("BRIEF_PATH", () => {
  it("accepts only a daily brief path", () => {
    expect(BRIEF_PATH.test("logs/briefings/2026-10-23-briefing.md")).toBe(true);
    expect(BRIEF_PATH.test("logs/briefings/../../tasks/x-briefing.md")).toBe(false);
    expect(BRIEF_PATH.test("tasks/one.md")).toBe(false);
  });
});
