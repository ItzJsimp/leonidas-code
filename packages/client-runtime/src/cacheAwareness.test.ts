import { describe, expect, it } from "vite-plus/test";
import { cacheStatus, cacheActionImpact, collectExpiryNotices } from "./cacheAwareness.ts";

const now = Date.parse("2026-10-16T12:00:00Z");
const observation = {
  inputTokens: 250_000,
  cachedInputTokens: 230_000,
  reportedAt: now - 50 * 60_000,
  ttlMs: 60 * 60_000,
  anchorAt: now - 51 * 60_000,
};
describe("cache awareness", () => {
  it("counts from the conservative request anchor, not response completion", () => {
    expect(cacheStatus(observation, now)).toMatchObject({
      state: "estimated",
      remainingMs: 9 * 60_000,
      readRate: 0.92,
    });
    expect(cacheStatus(observation, now + 10 * 60_000).state).toBe("possibly-expired");
  });
  it("never invents an expiry from reads alone or missing telemetry", () => {
    expect(cacheStatus({ ...observation, ttlMs: undefined }, now)).toMatchObject({
      state: "reported",
      remainingMs: null,
    });
    expect(cacheStatus({ ...observation, cachedInputTokens: undefined }, now).readRate).toBeNull();
    expect(cacheStatus(null, now).state).toBe("unknown");
    expect(cacheStatus({ ...observation, anchorAt: NaN }, now).remainingMs).toBeNull();
    expect(cacheStatus({ ...observation, cachedInputTokens: 0 }, now).state).toBe("no-reuse");
  });
  it("does not claim an exact countdown when only the report timestamp is known", () => {
    expect(cacheStatus({ ...observation, anchorAt: undefined }, now).remainingMs).toBeNull();
  });
  it("confirms model or account changes only when reusable context was reported", () => {
    const from = { instanceId: "claude", model: "opus", options: { effort: "high" } };
    expect(cacheActionImpact(from, { ...from, model: "sonnet" }, true)?.category).toBe("model");
    expect(cacheActionImpact(from, { ...from, instanceId: "other" }, true)?.category).toBe(
      "account",
    );
    expect(cacheActionImpact(from, { ...from, options: { effort: "low" } }, true)).toMatchObject({
      category: "configuration",
      confirmed: false,
    });
    expect(cacheActionImpact(from, from, true)).toBeNull();
    expect(cacheActionImpact(from, { ...from, model: "sonnet" }, false)).toBeNull();
  });
  it("groups recent chats once per cycle, respects snooze, and ignores stale chats", () => {
    const records = [
      { key: "chat α", observation, lastViewedAt: now - 1, notifiedCycle: null },
      { key: "chat β", observation, lastViewedAt: now - 30 * 60_000, notifiedCycle: null },
      { key: "old", observation, lastViewedAt: now - 61 * 60_000, notifiedCycle: null },
    ];
    expect(collectExpiryNotices(records, now, 0).map((x) => x.key)).toEqual(["chat α", "chat β"]);
    expect(collectExpiryNotices(records, now, now + 60_000)).toEqual([]);
    expect(
      collectExpiryNotices([{ ...records[0]!, notifiedCycle: observation.anchorAt }], now, 0),
    ).toEqual([]);
    expect(
      collectExpiryNotices(
        [{ ...records[0]!, observation: { ...observation, ttlMs: undefined } }],
        now,
        0,
      ),
    ).toEqual([]);
    expect(collectExpiryNotices([], now, 0)).toEqual([]);
    expect(collectExpiryNotices(records, now + 20 * 60_000, 0)).toEqual([]);
  });
});

it("keeps a 100-chat scan below the 5ms tick budget", () => {
  const records = Array.from({ length: 100 }, (_, index) => ({
    key: String(index),
    observation,
    lastViewedAt: now,
    notifiedCycle: null,
  }));
  const samples = Array.from({ length: 3 }, () => {
    const start = performance.now();
    for (let index = 0; index < 1_000; index += 1) collectExpiryNotices(records, now, 0);
    return (performance.now() - start) / 1_000;
  }).sort((a, b) => a - b);
  expect(samples[1]).toBeLessThan(5);
});
