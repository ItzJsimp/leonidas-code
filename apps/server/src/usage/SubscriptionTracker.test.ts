// @effect-diagnostics nodeBuiltinImport:off - temporary fixture directories only.
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { describe, expect, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as DateTime from "effect/DateTime";
import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { makeSubscriptionTracker } from "./SubscriptionTracker.ts";
import { UsageService } from "./UsageService.ts";
import { emptyTotals } from "./subscriptionTracking.ts";

const start = Date.parse("2026-10-11T00:00:00Z");
function provider(
  percent: number,
  minute = 0,
  email = "fixture@example.test",
  plan = "Pro",
): ServerProvider {
  const checkedAt = DateTime.formatIso(DateTime.makeUnsafe(start + minute * 60_000));
  return {
    instanceId: ProviderInstanceId.make("codex"),
    driver: ProviderDriverKind.make("codex"),
    status: "ready",
    enabled: true,
    installed: true,
    version: "fixture",
    auth: { status: "authenticated", email, label: plan },
    checkedAt,
    models: [],
    skills: [],
    slashCommands: [],
    usageLimits: {
      checkedAt,
      windows: [
        {
          id: "primary",
          kind: "session",
          label: "Session",
          usedPercent: percent,
          resetsAt: "2026-10-11T05:00:00Z",
        },
        {
          id: "secondary",
          kind: "weekly",
          label: "Weekly",
          usedPercent: percent,
          resetsAt: "2026-10-18T00:00:00Z",
        },
      ],
    },
  };
}
const capacity = (p: ServerProvider, index = 0) =>
  p.usageLimits?.windows[index]?.tokenEstimate?.capacityTokens;

describe("server subscription tracking", () => {
  it.live("persists calibration across restart and keeps sparse weekly observations", () =>
    Effect.gen(function* () {
      const dir = yield* Effect.acquireRelease(
        Effect.promise(() =>
          NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "subscription fixture ")),
        ),
        (dir) => Effect.promise(() => NodeFSP.rm(dir, { recursive: true, force: true })),
      );
      yield* Effect.gen(function* () {
        const track = yield* makeSubscriptionTracker(dir);
        expect(capacity(yield* track(provider(20)))).toBeUndefined();
        expect(capacity(yield* track(provider(30, 1)))).toBe(500_000);
        const restart = yield* makeSubscriptionTracker(dir);
        const sparse = provider(40, 2);
        yield* restart({
          ...sparse,
          usageLimits: { ...sparse.usageLimits!, windows: sparse.usageLimits!.windows.slice(0, 1) },
        });
        const next = yield* restart(provider(50, 3));
        expect(capacity(next)).toBe(500_000);
        expect(capacity(next, 1)).toBe(500_000);
      }).pipe(
        Effect.provide(NodeServices.layer),
        Effect.provideService(
          UsageService,
          UsageService.of({
            readSummary: () => Effect.die("unused"),
            refreshRates: Effect.die("unused"),
            readSubscriptionTokens: (_id, since, until) =>
              Effect.succeed({
                sourceKey: "fixture source",
                totals: { ...emptyTotals(), outputTokens: ((until - since) / 60_000) * 50_000 },
              }),
          }),
        ),
      );
      const ledger = yield* Effect.promise(() =>
        NodeFSP.readFile(NodePath.join(dir, "subscription-calibration.json"), "utf8"),
      );
      expect(ledger).not.toContain("fixture@example.test");
      const events = (yield* Effect.promise(() =>
        NodeFSP.readFile(NodePath.join(dir, "subscription-observations.jsonl"), "utf8"),
      ))
        .trim()
        .split("\n");
      expect(events).toHaveLength(4);
    }).pipe(Effect.scoped),
  );
  it.live("isolates account and plan changes and restarts on missing token coverage", () =>
    Effect.gen(function* () {
      const dir = yield* Effect.acquireRelease(
        Effect.promise(() =>
          NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "subscription fixture ")),
        ),
        (dir) => Effect.promise(() => NodeFSP.rm(dir, { recursive: true, force: true })),
      );
      let missing = false;
      yield* Effect.gen(function* () {
        const track = yield* makeSubscriptionTracker(dir);
        yield* track(provider(20));
        expect(capacity(yield* track(provider(30, 1)))).toBe(500_000);
        expect(capacity(yield* track(provider(40, 2, "other@example.test")))).toBeUndefined();
        expect(
          capacity(yield* track(provider(50, 3, "other@example.test", "Plus"))),
        ).toBeUndefined();
        expect(capacity(yield* track(provider(60, 4, "other@example.test", "Plus")))).toBe(500_000);
        missing = true;
        const gap = yield* track(provider(70, 5, "other@example.test", "Plus"));
        expect(capacity(gap)).toBeUndefined();
        expect(gap.usageLimits?.windows[0]?.tokenEstimate?.status).toBe("unavailable");
      }).pipe(
        Effect.provide(NodeServices.layer),
        Effect.provideService(
          UsageService,
          UsageService.of({
            readSummary: () => Effect.die("unused"),
            refreshRates: Effect.die("unused"),
            readSubscriptionTokens: () =>
              Effect.succeed(
                missing
                  ? null
                  : {
                      sourceKey: "fixture source",
                      totals: { ...emptyTotals(), outputTokens: 50_000 },
                    },
              ),
          }),
        ),
      );
    }).pipe(Effect.scoped),
  );
});
