// @effect-diagnostics globalDate:off - the ICS maths works on epoch numbers and Intl, not DateTime.
import { describe, expect, it } from "@effect/vitest";

import { countIcsEvents, expandIcs, looksLikeIcs } from "./ics.ts";

const wrap = (...events: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");
const vevent = (...lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");
const ms = (iso: string) => Date.parse(iso);
const WIDE_FROM = ms("2026-01-01T00:00:00Z");
const WIDE_TO = ms("2027-01-01T00:00:00Z");

describe("expandIcs", () => {
  it("reads a UTC event and unescapes text", () => {
    const ics = wrap(
      vevent(
        "UID:a",
        "DTSTART:20260310T150000Z",
        "DTEND:20260310T160000Z",
        "SUMMARY:Plan\\, review\\nround two",
        "LOCATION:Room 4",
      ),
    );
    const [event] = expandIcs(ics, WIDE_FROM, WIDE_TO);
    expect(event).toMatchObject({
      title: "Plan, review\nround two",
      start: ms("2026-03-10T15:00:00Z"),
      end: ms("2026-03-10T16:00:00Z"),
      allDay: false,
      location: "Room 4",
    });
  });

  it("joins folded lines", () => {
    const ics = wrap(
      "BEGIN:VEVENT\r\nUID:f\r\nDTSTART:20260310T150000Z\r\nSUMMARY:A very long\r\n  title that wraps\r\nEND:VEVENT",
    );
    expect(expandIcs(ics, WIDE_FROM, WIDE_TO)[0]?.title).toBe("A very long title that wraps");
  });

  it("converts an IANA TZID, with DST", () => {
    const winter = wrap(
      vevent(
        "UID:w",
        "DTSTART;TZID=America/New_York:20260115T090000",
        "DTEND;TZID=America/New_York:20260115T100000",
        "SUMMARY:W",
      ),
    );
    const summer = wrap(
      vevent(
        "UID:s",
        "DTSTART;TZID=America/New_York:20260715T090000",
        "DTEND;TZID=America/New_York:20260715T100000",
        "SUMMARY:S",
      ),
    );
    expect(expandIcs(winter, WIDE_FROM, WIDE_TO)[0]?.start).toBe(ms("2026-01-15T14:00:00Z"));
    expect(expandIcs(summer, WIDE_FROM, WIDE_TO)[0]?.start).toBe(ms("2026-07-15T13:00:00Z"));
  });

  it("converts a Windows TZID", () => {
    const ics = wrap(
      vevent("UID:o", "DTSTART;TZID=Pacific Standard Time:20260715T090000", "SUMMARY:O"),
    );
    expect(expandIcs(ics, WIDE_FROM, WIDE_TO)[0]?.start).toBe(ms("2026-07-15T16:00:00Z"));
  });

  it("reads an all-day event as local midnight with an exclusive end", () => {
    const ics = wrap(
      vevent("UID:d", "DTSTART;VALUE=DATE:20260310", "DTEND;VALUE=DATE:20260312", "SUMMARY:Trip"),
    );
    const [event] = expandIcs(ics, WIDE_FROM, WIDE_TO);
    expect(event?.allDay).toBe(true);
    expect(event?.start).toBe(new Date(2026, 2, 10).getTime());
    expect(event?.end).toBe(new Date(2026, 2, 12).getTime());
  });

  it("repeats weekly on chosen days, honours EXDATE and COUNT", () => {
    const ics = wrap(
      vevent(
        "UID:r",
        "DTSTART:20260302T170000Z", // Monday
        "DTEND:20260302T180000Z",
        "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6",
        "EXDATE:20260304T170000Z",
        "SUMMARY:Standup",
      ),
    );
    const starts = expandIcs(ics, WIDE_FROM, WIDE_TO).map((e) =>
      new Date(e.start).toISOString().slice(0, 10),
    );
    // Six instances (Mar 2, 4, 9, 11, 16, 18) minus the excluded Mar 4.
    expect(starts).toEqual(["2026-03-02", "2026-03-09", "2026-03-11", "2026-03-16", "2026-03-18"]);
  });

  it("stops a weekly rule at UNTIL and keeps the zone wall time across DST", () => {
    const ics = wrap(
      vevent(
        "UID:u",
        "DTSTART;TZID=America/New_York:20260302T090000",
        "DTEND;TZID=America/New_York:20260302T100000",
        "RRULE:FREQ=WEEKLY;UNTIL=20260316T120000Z",
        "SUMMARY:Sync",
      ),
    );
    const events = expandIcs(ics, WIDE_FROM, WIDE_TO);
    // DST starts Mar 8: 09:00 New York is 14:00 UTC before and 13:00 UTC after.
    expect(events.map((e) => e.start)).toEqual([
      ms("2026-03-02T14:00:00Z"),
      ms("2026-03-09T13:00:00Z"),
    ]);
  });

  it("repeats daily with an interval and clips to the window", () => {
    const ics = wrap(
      vevent("UID:i", "DTSTART:20260301T100000Z", "RRULE:FREQ=DAILY;INTERVAL=2", "SUMMARY:Pill"),
    );
    const events = expandIcs(ics, ms("2026-03-10T00:00:00Z"), ms("2026-03-15T00:00:00Z"));
    expect(events.map((e) => new Date(e.start).getUTCDate())).toEqual([11, 13]);
  });

  it("replaces one repeat with its RECURRENCE-ID change and drops cancelled events", () => {
    const ics = wrap(
      vevent(
        "UID:m",
        "DTSTART:20260302T170000Z",
        "DTEND:20260302T180000Z",
        "RRULE:FREQ=WEEKLY;COUNT=2",
        "SUMMARY:Weekly",
      ),
      vevent(
        "UID:m",
        "RECURRENCE-ID:20260309T170000Z",
        "DTSTART:20260309T200000Z",
        "DTEND:20260309T210000Z",
        "SUMMARY:Weekly (moved)",
      ),
      vevent("UID:x", "DTSTART:20260305T100000Z", "STATUS:CANCELLED", "SUMMARY:Gone"),
    );
    const events = expandIcs(ics, WIDE_FROM, WIDE_TO);
    expect(events.map((e) => [e.title, new Date(e.start).toISOString()])).toEqual([
      ["Weekly", "2026-03-02T17:00:00.000Z"],
      ["Weekly (moved)", "2026-03-09T20:00:00.000Z"],
    ]);
  });

  it("repeats monthly and yearly on the start day", () => {
    const monthly = wrap(
      vevent("UID:mo", "DTSTART:20260131T100000Z", "RRULE:FREQ=MONTHLY;COUNT=3", "SUMMARY:M"),
    );
    // Feb has no 31st, so that month is skipped.
    expect(
      expandIcs(monthly, WIDE_FROM, WIDE_TO).map((e) =>
        new Date(e.start).toISOString().slice(0, 10),
      ),
    ).toEqual(["2026-01-31", "2026-03-31", "2026-05-31"]);
    const yearly = wrap(
      vevent("UID:y", "DTSTART;VALUE=DATE:20200614", "RRULE:FREQ=YEARLY", "SUMMARY:Birthday"),
    );
    expect(expandIcs(yearly, WIDE_FROM, WIDE_TO)).toHaveLength(1);
  });

  it("finds a meeting link in the description or location", () => {
    const ics = wrap(
      vevent(
        "UID:j",
        "DTSTART:20260310T150000Z",
        "SUMMARY:Call",
        "DESCRIPTION:Join https://acme.zoom.us/j/123?pwd=x\\nthanks",
      ),
    );
    expect(expandIcs(ics, WIDE_FROM, WIDE_TO)[0]?.joinUrl).toBe("https://acme.zoom.us/j/123?pwd=x");
  });

  it("keeps an event that started before the window but is still running", () => {
    const ics = wrap(
      vevent("UID:l", "DTSTART:20260310T220000Z", "DTEND:20260311T020000Z", "SUMMARY:Late"),
    );
    expect(expandIcs(ics, ms("2026-03-11T00:00:00Z"), ms("2026-03-12T00:00:00Z"))).toHaveLength(1);
  });
});

describe("ICS checks", () => {
  it("tells a calendar from a web page and counts events", () => {
    expect(looksLikeIcs("<html>")).toBe(false);
    const ics = wrap(
      vevent("UID:1", "DTSTART:20260310T150000Z"),
      vevent("UID:2", "DTSTART:20260311T150000Z"),
    );
    expect(looksLikeIcs(ics)).toBe(true);
    expect(countIcsEvents(ics)).toBe(2);
  });
});
