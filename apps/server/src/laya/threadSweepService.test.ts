import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import { toSweepThread } from "./threadSweepService.ts";
import { isSweepEligible } from "./threadSweep.ts";

const shell = (patch: Record<string, unknown> = {}) =>
  ({
    id: "thread-1",
    projectId: "project-1",
    title: "A chat",
    updatedAt: DateTime.makeUnsafe("2026-10-19T10:00:00.000Z"),
    archivedAt: null,
    settledOverride: null,
    pinnedAt: null,
    status: "idle",
    pendingRuntimeRequest: null,
    visibleItemCount: 12,
    ...patch,
  }) as unknown as Parameters<typeof toSweepThread>[0];

describe("toSweepThread", () => {
  it("turns the shell DateTime into an ISO string that Date.parse reads", () => {
    const thread = toSweepThread(shell());
    expect(thread.updatedAt).toBe("2026-10-19T10:00:00.000Z");
    expect(Number.isNaN(Date.parse(thread.updatedAt))).toBe(false);
  });

  it("makes a plain idle shell eligible for the sweep", () => {
    const thread = toSweepThread(shell());
    const now = Date.parse("2026-10-20T10:00:00.000Z");
    expect(
      isSweepEligible(
        {
          archived: thread.archived,
          settled: thread.settled,
          pinned: thread.pinned,
          running: false,
          updatedAtMs: Date.parse(thread.updatedAt),
        },
        now,
        12 * 3_600_000,
      ),
    ).toBe(true);
  });

  it("maps archived, settled, pinned and pending-request flags", () => {
    const thread = toSweepThread(
      shell({
        archivedAt: DateTime.makeUnsafe("2026-10-19T11:00:00.000Z"),
        settledOverride: "settled",
        pinnedAt: DateTime.makeUnsafe("2026-10-19T11:00:00.000Z"),
        pendingRuntimeRequest: { id: "r", kind: "approval" },
      }),
    );
    expect(thread).toMatchObject({
      archived: true,
      settled: true,
      pinned: true,
      hasPendingRequest: true,
    });
  });
});
