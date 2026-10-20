import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { checkFixedForYou, versionAtLeast } from "./fixedForYou";
import { createBoard, joinBoard, pushScore, weeklyStats, weekStart } from "./leaderboard";
import {
  buildStuckReport,
  errorCodeFromText,
  isStuckPhrase,
  screenFromPath,
  sendStuckReport,
} from "./stuckReport";
import { recordFeedbackError } from "../../components/feedback/feedbackContext";
import {
  USAGE_CONSENT_VERSION,
  useUsageAnalyticsStore,
} from "../usageAnalytics/usageAnalyticsStore";

const initial = useUsageAnalyticsStore.getState();
const fetchMock = vi.fn();

beforeEach(() => {
  useUsageAnalyticsStore.setState(initial, true);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, code: "ABCD2345" })));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("consent version", () => {
  it("asks again after the bump, including the leaderboard", () => {
    expect(USAGE_CONSENT_VERSION).toBe(3);
    const migrate = useUsageAnalyticsStore.persist.getOptions().migrate!;
    const migrated = migrate({ consent: "granted", leaderboardConsent: "granted" }, 2) as {
      consent: string;
      leaderboardConsent: string;
    };
    expect(migrated).toMatchObject({ consent: "unknown", leaderboardConsent: "unknown" });
    expect(migrate({ consent: "declined" }, 2)).toMatchObject({ consent: "declined" });
  });
});

describe("stuck report", () => {
  it("holds state codes only: no message, path or key fields", () => {
    recordFeedbackError("Failed to read C:\\Users\\jake\\secret.txt with key sk-ant-abc123");
    const report = buildStuckReport({ pathname: "/chat/3f2a9c1e-7777-4d1b", source: "button" });
    expect(Object.keys(report).sort()).toEqual([
      "appVersion",
      "errorCode",
      "lastAction",
      "platform",
      "provider",
      "reportId",
      "screen",
      "source",
    ]);
    const json = JSON.stringify(report);
    expect(json).not.toMatch(/jake|secret|sk-ant|C:|3f2a9c1e/);
    expect(report.screen).toBe("chat");
    expect(report.reportId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("does not reuse the analytics install id", () => {
    const { installId } = useUsageAnalyticsStore.getState();
    const report = buildStuckReport({ pathname: "/settings/models", source: "voice" });
    expect(JSON.stringify(report)).not.toContain(installId.replaceAll("-", ""));
    expect(report.reportId).not.toBe(installId);
  });

  it("posts the report and remembers its id on success", async () => {
    const report = buildStuckReport({ pathname: "/", source: "button" });
    expect(await sendStuckReport(report)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/stuck"),
      expect.objectContaining({ method: "POST", body: JSON.stringify(report) }),
    );
    expect(useUsageAnalyticsStore.getState().stuckReports.map((item) => item.id)).toEqual([
      report.reportId,
    ]);
  });

  it("maps messages to fixed codes and paths to plain screens", () => {
    expect(errorCodeFromText("HTTP 429 too many requests")).toBe("rate_limited");
    expect(errorCodeFromText("fetch failed")).toBe("provider_unreachable");
    expect(errorCodeFromText("weird thing")).toBe("unknown_error");
    expect(errorCodeFromText(null)).toBeNull();
    expect(screenFromPath("/C:/Users/jake/notes.md")).toBe("chat");
    expect(screenFromPath("/settings/models")).toBe("settings/models");
    expect(screenFromPath("/settings/jake-folder")).toBe("settings");
    expect(screenFromPath("/")).toBe("home");
  });

  it("hears the approved phrase and nothing near it", () => {
    for (const heard of [
      "Leonidas, I'm stuck",
      "leonidas im stuck.",
      "Hey Leonidas, I am stuck!",
    ]) {
      expect(isStuckPhrase(heard)).toBe(true);
    }
    for (const other of ["I'm stuck", "Leonidas, I'm stuck on this bug", "fix the stuck job"]) {
      expect(isStuckPhrase(other)).toBe(false);
    }
  });
});

describe("fixed for you", () => {
  it("compares plain versions", () => {
    expect(versionAtLeast("1.0.1", "1.0.1")).toBe(true);
    expect(versionAtLeast("1.0.0", "1.0.1")).toBe(false);
    expect(versionAtLeast("1.10.0", "1.9.9")).toBe(true);
  });

  /** A tiny Worker: report ids a and b are fixed in 1.0.1; the caller learns only about its own. */
  function worker() {
    return vi.fn(async (url: string) => {
      const ids = new URL(url).searchParams.get("ids")?.split(",") ?? [];
      const fixedHere = new Set(["a".repeat(32)]);
      const fixed = ids.filter((id) => fixedHere.has(id)).map((id) => ({ id, version: "1.0.1" }));
      return new Response(JSON.stringify({ fixed }));
    });
  }

  it("shows the notice to the reporting install only", async () => {
    const remote = worker();
    vi.stubGlobal("fetch", remote);
    const reporter = { ...initial, stuckReports: [{ id: "a".repeat(32), at: 1 }], fixedSeen: [] };
    const other = { ...initial, stuckReports: [{ id: "b".repeat(32), at: 1 }], fixedSeen: [] };

    useUsageAnalyticsStore.setState(reporter, true);
    expect(await checkFixedForYou("1.0.1")).toEqual(["1.0.1"]);
    // Told once: the next launch stays quiet.
    expect(await checkFixedForYou("1.0.1")).toEqual([]);

    useUsageAnalyticsStore.setState(other, true);
    expect(await checkFixedForYou("1.0.1")).toEqual([]);
    expect(remote.mock.calls.every(([url]) => !String(url).includes(initial.installId))).toBe(true);
  });

  it("waits until the fix version is installed, and asks nothing with no reports", async () => {
    const remote = worker();
    vi.stubGlobal("fetch", remote);
    useUsageAnalyticsStore.setState({ stuckReports: [{ id: "a".repeat(32), at: 1 }] });
    expect(await checkFixedForYou("1.0.0")).toEqual([]);
    useUsageAnalyticsStore.setState({ stuckReports: [], fixedSeen: [] });
    remote.mockClear();
    expect(await checkFixedForYou("1.0.1")).toEqual([]);
    expect(remote).not.toHaveBeenCalled();
  });
});

describe("friends leaderboard", () => {
  it("sends nothing without the leaderboard consent", async () => {
    useUsageAnalyticsStore.setState({ consent: "granted", leaderboardConsent: "unknown" });
    expect(await createBoard()).toBeNull();
    expect(await joinBoard("ABCD2345")).toBe(false);
    expect(await pushScore("ABCD2345", { words: 1, messages: 1, activeDays: 1 }, Date.now())).toBe(
      false,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stays anonymous by default and shares the nickname only when public", async () => {
    useUsageAnalyticsStore.setState({
      leaderboardConsent: "granted",
      boardNickname: "Shake",
      boardPublic: false,
    });
    await joinBoard("abcd2345");
    const anonymous = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(anonymous).toEqual({
      code: "ABCD2345",
      boardId: expect.stringMatching(/^[0-9a-f]{32}$/),
    });
    expect(useUsageAnalyticsStore.getState().boards).toEqual(["ABCD2345"]);

    useUsageAnalyticsStore.setState({ boardPublic: true });
    await joinBoard("ABCD2345");
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body as string).nickname).toBe("Shake");
  });

  it("uses a board id that is not the analytics install id", async () => {
    useUsageAnalyticsStore.setState({ leaderboardConsent: "granted" });
    await joinBoard("ABCD2345");
    const { installId, boardId } = useUsageAnalyticsStore.getState();
    expect(boardId).not.toBe(installId);
    expect(String(fetchMock.mock.calls[0]![1].body)).not.toContain(installId);
  });

  it("counts words and active days from this week's dictations only", () => {
    const now = Date.parse("2026-10-21T12:00:00Z");
    expect(weekStart(now)).toBe("2026-10-19");
    expect(
      weeklyStats(
        [
          { at: "2026-10-20T09:00:00Z", words: 40 },
          { at: "2026-10-20T18:00:00Z", words: 10 },
          { at: "2026-10-21T08:00:00Z", words: 5 },
          { at: "2026-10-12T08:00:00Z", words: 999 },
        ],
        7,
        now,
      ),
    ).toEqual({ words: 55, messages: 7, activeDays: 2 });
  });
});
