import { describe, expect, it } from "@effect/vitest";

import { triageDrop } from "./triage.ts";

// Tuesday 2026-10-13, local time.
const NOW = new Date(2026, 9, 13, 9, 0, 0).getTime();

describe("triageDrop", () => {
  it("files a plain imperative as a confident task and reads the date word", () => {
    expect(triageDrop("Call Mob about the hotkey tomorrow", NOW)).toEqual({
      kind: "task",
      confident: true,
      title: "Call Mob about the hotkey tomorrow",
      due: "2026-10-14",
    });
  });

  it("honours explicit prefixes and strips them from the title", () => {
    expect(triageDrop("todo: renew the domain friday", NOW)).toMatchObject({
      kind: "task",
      confident: true,
      title: "Renew the domain friday",
      due: "2026-10-16",
    });
    expect(triageDrop("idea: capture from the terminal", NOW)).toMatchObject({
      kind: "idea",
      confident: true,
      title: "Capture from the terminal",
    });
  });

  it("reads reminder phrasing as a task", () => {
    expect(triageDrop("remind me to send the invoice", NOW)).toMatchObject({
      kind: "task",
      confident: true,
      title: "Send the invoice",
    });
  });

  it("keeps questions, long text and multi-line dumps as unconfident notes", () => {
    expect(triageDrop("Should we call Mob about this?", NOW)).toMatchObject({
      kind: "note",
      confident: false,
    });
    expect(triageDrop("Meeting notes\n- hotkey works\n- send recap", NOW)).toMatchObject({
      kind: "note",
      confident: false,
    });
    expect(triageDrop("call ".concat("word ".repeat(40)), NOW).confident).toBe(false);
  });

  it("treats 'what if' style musings as ideas", () => {
    expect(triageDrop("What if drops could be voice notes", NOW)).toMatchObject({
      kind: "idea",
      confident: true,
    });
  });

  it("accepts an ISO date and ignores impossible ones", () => {
    expect(triageDrop("pay rent 2026-11-01", NOW).due).toBe("2026-11-01");
    expect(triageDrop("pay rent 2026-13-45", NOW).due).toBeNull();
  });
});
