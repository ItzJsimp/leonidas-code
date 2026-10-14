// @effect-diagnostics globalDate:off -- Tests exercise local calendar days across timezones.
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  CaptureDraft,
  dailyFocusTasks,
  daysUntilDue,
  defaultDueForFocus,
  formatDue,
  localDateKey,
  quickDueOptions,
  taskSectionSlug,
  toggleCompletionStatus,
} from "./dailyPlanning.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

// 2026-10-14 23:30 UTC: still the 14th in Los Angeles, already the 15th in Auckland.
const LATE_UTC = Date.UTC(2026, 9, 14, 23, 30);

function task(
  overrides: Partial<{ status: string; due: string | null; projectSlug: string | null }>,
) {
  return {
    id: overrides.due ?? "none",
    status: "todo",
    due: null,
    projectSlug: null,
    ...overrides,
  } as {
    id: string;
    status: "todo" | "in_progress" | "review" | "blocked" | "done" | "parked" | "retired";
    due: string | null;
    projectSlug: string | null;
  };
}

describe("localDateKey", () => {
  it("uses the viewer's calendar day, not UTC", () => {
    vi.stubEnv("TZ", "America/Los_Angeles");
    expect(localDateKey(LATE_UTC)).toBe("2026-10-14");
    vi.stubEnv("TZ", "Pacific/Auckland");
    expect(localDateKey(LATE_UTC)).toBe("2026-10-15");
  });

  it("offsets by calendar days across a DST change", () => {
    vi.stubEnv("TZ", "America/New_York");
    // 2026-11-01 is the US fall-back day; a 24h step from midnight would land on the same date.
    const beforeFallBack = new Date(2026, 9, 31, 0, 30).getTime();
    expect(localDateKey(beforeFallBack, 1)).toBe("2026-11-01");
    expect(localDateKey(beforeFallBack, 2)).toBe("2026-11-02");
  });
});

describe("daysUntilDue", () => {
  it("counts local calendar days and rejects malformed dates", () => {
    vi.stubEnv("TZ", "Pacific/Auckland");
    expect(daysUntilDue("2026-10-15", LATE_UTC)).toBe(0);
    expect(daysUntilDue("2026-10-14", LATE_UTC)).toBe(-1);
    vi.stubEnv("TZ", "America/Los_Angeles");
    expect(daysUntilDue("2026-10-15", LATE_UTC)).toBe(1);
    expect(daysUntilDue("2026-02-30", LATE_UTC)).toBeNull();
    expect(daysUntilDue("soon", LATE_UTC)).toBeNull();
    expect(daysUntilDue(null, LATE_UTC)).toBeNull();
  });

  it("formats a readable label", () => {
    vi.stubEnv("TZ", "UTC");
    expect(formatDue("2026-10-12", LATE_UTC)).toBe("Overdue 2d");
    expect(formatDue("2026-10-14", LATE_UTC)).toBe("Due today");
    expect(formatDue("2026-10-17", LATE_UTC)).toBe("Due in 3d");
    expect(formatDue(undefined, LATE_UTC)).toBeNull();
  });
});

describe("dailyFocusTasks", () => {
  const tasks = [
    task({ due: "2026-10-10" }),
    task({ due: "2026-10-14", projectSlug: "leonidas-code" }),
    task({ due: "2026-10-20" }),
    task({ due: null }),
    task({ due: "2026-10-14", status: "done" }),
    task({ due: "2026-10-14", status: "parked" }),
  ];

  it("Today includes overdue work; Upcoming is today onward", () => {
    vi.stubEnv("TZ", "UTC");
    expect(dailyFocusTasks(tasks, "today", LATE_UTC).map((t) => t.due)).toEqual([
      "2026-10-10",
      "2026-10-14",
    ]);
    expect(dailyFocusTasks(tasks, "upcoming", LATE_UTC).map((t) => t.due)).toEqual([
      "2026-10-14",
      "2026-10-20",
    ]);
  });

  it("Inbox is open work with no project, ordered by due date with undated last", () => {
    vi.stubEnv("TZ", "UTC");
    expect(dailyFocusTasks(tasks, "inbox", LATE_UTC).map((t) => t.due)).toEqual([
      "2026-10-10",
      "2026-10-20",
      null,
    ]);
  });

  it("keeps completed work visible only when asked, so it can be reopened", () => {
    vi.stubEnv("TZ", "UTC");
    const withDone = dailyFocusTasks(tasks, "today", LATE_UTC, { includeDone: true });
    expect(withDone.map((t) => t.status)).toEqual(["todo", "todo", "done"]);
  });

  it("narrows to one project when one is selected", () => {
    vi.stubEnv("TZ", "UTC");
    expect(
      dailyFocusTasks(tasks, "today", LATE_UTC, { projectSlug: "leonidas-code" }).map(
        (t) => t.projectSlug,
      ),
    ).toEqual(["leonidas-code"]);
  });
});

describe("task state helpers", () => {
  it("toggles between done and todo, keeping in-progress work's status on reopen", () => {
    expect(toggleCompletionStatus("todo")).toBe("done");
    expect(toggleCompletionStatus("in_progress")).toBe("done");
    expect(toggleCompletionStatus("done")).toBe("todo");
  });

  it("files unlinked cards under the Inbox section", () => {
    expect(taskSectionSlug({ projectSlug: null })).toBe("general");
    expect(taskSectionSlug({ projectSlug: "  " })).toBe("general");
    expect(taskSectionSlug({ projectSlug: "aios" })).toBe("aios");
  });

  it("defaults new captures to today on the dated views", () => {
    vi.stubEnv("TZ", "UTC");
    expect(defaultDueForFocus("today", LATE_UTC)).toBe("2026-10-14");
    expect(defaultDueForFocus("upcoming", LATE_UTC)).toBe("2026-10-14");
    expect(defaultDueForFocus("inbox", LATE_UTC)).toBeNull();
  });

  it("offers quick due dates in the viewer's timezone", () => {
    vi.stubEnv("TZ", "Pacific/Auckland");
    expect(quickDueOptions(LATE_UTC).map((option) => option.due)).toEqual([
      "2026-10-15",
      "2026-10-16",
      "2026-10-22",
    ]);
  });
});

describe("CaptureDraft", () => {
  const keys = () => {
    let next = 0;
    return () => `key-${++next}`;
  };

  it("reuses one idempotency key across retries until the capture lands", () => {
    const typed = CaptureDraft.edit(CaptureDraft.empty(keys()), "  Call the bank ");
    const [sending, first] = CaptureDraft.submit(typed);
    expect(first).toEqual({ title: "Call the bank", idempotencyKey: "key-1" });
    // The socket dropped: text and key are kept, so the retry after reconnect cannot duplicate.
    const afterFailure = CaptureDraft.settle(sending, first!, { ok: false });
    expect(afterFailure.text).toBe("  Call the bank ");
    const [retrying, retry] = CaptureDraft.submit(afterFailure);
    expect(retry).toEqual(first);

    const afterSuccess = CaptureDraft.settle(retrying, retry!, { ok: true });
    expect(afterSuccess.text).toBe("");
    expect(CaptureDraft.submit(CaptureDraft.edit(afterSuccess, "Next"))[1]?.idempotencyKey).toBe(
      "key-2",
    );
  });

  it("starts a new key when the text changes after a send, even mid-flight", () => {
    const typed = CaptureDraft.edit(CaptureDraft.empty(keys()), "Draft");
    const [sending, sent] = CaptureDraft.submit(typed);
    const edited = CaptureDraft.edit(sending, "Draft two");
    expect(CaptureDraft.submit(edited)[1]?.idempotencyKey).toBe("key-2");
    // The older capture landing must not wipe the newer text.
    expect(CaptureDraft.settle(edited, sent!, { ok: true }).text).toBe("Draft two");
  });

  it("does not submit blank text", () => {
    const blank = CaptureDraft.edit(CaptureDraft.empty(keys()), "   ");
    expect(CaptureDraft.submit(blank)[1]).toBeNull();
  });
});
