import { describe, expect, it } from "vite-plus/test";

import { plainEventBody, plainEventCause, plainEventTitle, plainText } from "./eventText";

/** The 12-hour local time of an instant, built from the local clock so the test works in any zone. */
const local = (ms: number) => {
  const date = new Date(ms);
  const h = date.getHours();
  return `${h % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

describe("plainText", () => {
  it("removes backticks", () => {
    expect(plainText("Run `pnpm test` first")).toBe("Run pnpm test first");
  });

  it("turns an exit code into plain words", () => {
    expect(plainText("Backup stopped (exit 1)")).toBe("Backup stopped (failed)");
    expect(plainText("Nightly backup failed (exit 1)")).toBe("Nightly backup failed");
    expect(plainText("Script ended with exit code 0")).toBe("Script ended (finished)");
    expect(plainText("exit 2")).toBe("failed");
  });

  it("writes UTC and ISO times as local 12-hour time", () => {
    expect(plainText("Ran at 2026-10-23 04:40 UTC.")).toBe(
      `Ran at ${local(Date.UTC(2026, 9, 23, 4, 40))}.`,
    );
    expect(plainText("At 2026-10-23T16:05:09Z")).toBe(
      `At ${local(Date.UTC(2026, 9, 23, 16, 5, 9))}`,
    );
    expect(plainText("At 2026-10-23T16:05:09-07:00")).toBe(
      `At ${local(Date.UTC(2026, 9, 23, 23, 5, 9))}`,
    );
  });

  it("reads a time without a zone as local time", () => {
    expect(plainText("At 2026-10-23 00:07")).toBe("At 12:07 AM");
    expect(plainText("At 2026-10-23T13:30:00")).toBe("At 1:30 PM");
  });

  it("leaves other text alone", () => {
    expect(plainText("Nothing to change")).toBe("Nothing to change");
  });
});

describe("plainEventTitle", () => {
  it("turns a file name into a plain title", () => {
    expect(plainEventTitle("nightly-backup.md")).toBe("Nightly backup");
    expect(plainEventTitle("2026-10-23-weekly_review.md")).toBe("Weekly review");
    expect(plainEventTitle("logs/backup.log")).toBe("Backup");
  });

  it("keeps real sentences and cleans them", () => {
    expect(plainEventTitle("Nightly backup failed (exit 1)")).toBe("Nightly backup failed");
    expect(plainEventTitle("Check `inbox.md` now")).toBe("Check inbox.md now");
  });

  it("keeps a file name that is only a date", () => {
    expect(plainEventTitle("2026-10-23.md")).toBe("2026-10-23.md");
  });
});

describe("plainEventBody", () => {
  it("cleans the body and returns null for none", () => {
    expect(plainEventBody("See `logs/backup.log`, exit 1")).toBe("See logs/backup.log (failed)");
    expect(plainEventBody(undefined)).toBeNull();
    expect(plainEventBody("")).toBeNull();
  });
});

describe("plainEventCause", () => {
  it("gives a failure a cause line even with no body", () => {
    expect(plainEventCause({ level: "failed" })).toBe("No cause was recorded.");
    expect(plainEventCause({ level: "failed", body: "Disk full, exit 1" })).toBe(
      "Disk full (failed)",
    );
    expect(plainEventCause({ level: "info" })).toBeNull();
  });
});
