import { describe, expect, it } from "vite-plus/test";

import { greetingFor } from "./copy";

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
