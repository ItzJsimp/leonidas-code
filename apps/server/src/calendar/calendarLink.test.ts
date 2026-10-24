import { describe, expect, it } from "@effect/vitest";

import {
  checkCalendarLink,
  defaultCalendarName,
  maskCalendarLink,
  pickColor,
} from "./calendarLink.ts";

describe("checkCalendarLink", () => {
  it("accepts https and http links", () => {
    expect(checkCalendarLink(" https://example.com/a.ics ")).toEqual({
      ok: true,
      url: "https://example.com/a.ics",
    });
    expect(checkCalendarLink("http://example.com/a.ics").ok).toBe(true);
  });

  it("turns webcal into https", () => {
    expect(checkCalendarLink("webcal://p01-caldav.icloud.com/published/2/abc")).toEqual({
      ok: true,
      url: "https://p01-caldav.icloud.com/published/2/abc",
    });
    expect(checkCalendarLink("WEBCALS://example.com/x").ok).toBe(true);
  });

  it("rejects other schemes, blanks, junk and long links with plain words", () => {
    for (const bad of [
      "",
      "   ",
      "ftp://example.com/a.ics",
      "file:///C:/a.ics",
      "javascript:alert(1)",
      "not a link",
    ]) {
      const result = checkCalendarLink(bad);
      expect(result.ok).toBe(false);
    }
    expect(checkCalendarLink(`https://example.com/${"a".repeat(3000)}`).ok).toBe(false);
  });
});

describe("link helpers", () => {
  it("masks all but the host and four letters", () => {
    const masked = maskCalendarLink(
      "https://calendar.google.com/calendar/ical/me%40x.com/private-SECRET1234/basic.ics",
    );
    expect(masked).toBe("calendar.google.com/...1234");
    expect(masked).not.toContain("SECRET");
  });

  it("names a calendar by its site and keeps a valid colour", () => {
    expect(defaultCalendarName("https://www.example.com/a.ics")).toBe("example.com");
    expect(pickColor("#ABCDEF", 0)).toBe("#abcdef");
    expect(pickColor("red", 1)).toBe("#34a853");
  });
});
