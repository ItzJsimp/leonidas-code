import { describe, expect, it } from "vite-plus/test";

import { greetingFor, statusLine } from "./copy";

const at = (hour: number, minute = 0) => new Date(2026, 9, 21, hour, minute);

describe("greetingFor", () => {
  it("changes at 5 AM, 12 PM and 5 PM", () => {
    expect(greetingFor(at(4, 59))).toBe("Good evening");
    expect(greetingFor(at(5))).toBe("Good morning");
    expect(greetingFor(at(11, 59))).toBe("Good morning");
    expect(greetingFor(at(12))).toBe("Good afternoon");
    expect(greetingFor(at(16, 59))).toBe("Good afternoon");
    expect(greetingFor(at(17))).toBe("Good evening");
    expect(greetingFor(at(0))).toBe("Good evening");
  });
});

const text = (parts: ReturnType<typeof statusLine>) => parts.map((part) => part.text).join(" ");

describe("statusLine", () => {
  it("matches the prototype sentence and makes the needs-you part strong", () => {
    const parts = statusLine({ needsYou: 2, running: 2, today: { done: 1, total: 4 } });
    expect(text(parts)).toBe(
      "2 things need you. 2 agents are working. 3 of 4 tasks are left today.",
    );
    expect(parts[0]).toEqual({ text: "2 things need you.", strong: true });
    expect(parts[1]?.strong).toBe(false);
  });

  it("uses singular words for one", () => {
    expect(text(statusLine({ needsYou: 1, running: 1, today: { done: 3, total: 4 } }))).toBe(
      "1 thing needs you. 1 agent is working. 1 of 4 tasks is left today.",
    );
  });

  it("says calm things when there is nothing", () => {
    const parts = statusLine({ needsYou: 0, running: 0, today: { done: 0, total: 0 } });
    expect(text(parts)).toBe("Nothing needs you. No agents are working. No priorities for today.");
    expect(parts.every((part) => !part.strong)).toBe(true);
  });

  it("says when today is done", () => {
    expect(text(statusLine({ needsYou: 0, running: 0, today: { done: 4, total: 4 } }))).toBe(
      "Nothing needs you. No agents are working. All 4 of today's tasks are done.",
    );
  });

  it("leaves out today when the AIOS has no brief yet", () => {
    expect(text(statusLine({ needsYou: 0, running: 3, today: null }))).toBe(
      "Nothing needs you. 3 agents are working.",
    );
  });
});
