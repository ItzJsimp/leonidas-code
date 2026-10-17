import { describe, expect, it } from "vite-plus/test";
import { ProviderDriverKind, ProviderInstanceId } from "./providerInstance.ts";
import type { ServerProvider } from "./server.ts";
import { getProviderReadiness } from "./providerReadiness.ts";

const now = Date.parse("2026-10-16T12:00:00Z");
const ready: ServerProvider = {
  instanceId: ProviderInstanceId.make("account_a"),
  driver: ProviderDriverKind.make("claudeAgent"),
  enabled: true,
  installed: true,
  version: "2.0.0",
  status: "ready",
  auth: { status: "authenticated" },
  checkedAt: "2026-10-16T12:00:00Z",
  models: [],
  slashCommands: [],
  skills: [],
};

describe("provider readiness before send", () => {
  it("keeps an unclassified failed usage check yellow", () => {
    expect(
      getProviderReadiness(
        {
          ...ready,
          usageLimits: {
            checkedAt: ready.checkedAt,
            windows: [],
            unavailable: {
              reason: "probeFailed",
              message: "Codex did not answer the usage request.",
            },
          },
        },
        { nowMs: now },
      ),
    ).toMatchObject({ color: "yellow", action: "check" });
  });
  it("uses failed authenticated usage checks instead of stale local sign-in evidence", () => {
    expect(
      getProviderReadiness(
        {
          ...ready,
          usageLimits: {
            checkedAt: ready.checkedAt,
            windows: [],
            unavailable: { reason: "probeFailed", message: "OAuth token expired" },
          },
        },
        { nowMs: now },
      ),
    ).toMatchObject({ color: "red", code: "token_expired", action: "sign_in" });
  });
  it.each([
    [{ installed: false, status: "error" }, "cli_missing", "CLI missing", "install"],
    [
      { compatibilityAdvisory: { status: "unsupported" } },
      "cli_too_old",
      "CLI update needed",
      "install",
    ],
    [
      { auth: { status: "unauthenticated" }, status: "error" },
      "signed_out",
      "Signed out",
      "sign_in",
    ],
    [
      { status: "error", message: "OAuth token expired" },
      "token_expired",
      "Token expired",
      "sign_in",
    ],
    [
      { status: "error", message: "Quota exceeded" },
      "quota_reached",
      "Quota reached; reset unknown",
      "check",
    ],
    [
      { status: "error", message: "connect ECONNREFUSED" },
      "network_blocked",
      "Network blocked",
      "check_connection",
    ],
  ] as const)("maps a confirmed failure to one repair: %s", (failure, code, reason, action) => {
    const provider = { ...ready, ...failure } as ServerProvider;
    expect(getProviderReadiness(provider, { nowMs: now })).toMatchObject({
      color: "red",
      code,
      reason,
      action,
    });
  });

  it("shows verified ready and uncertain auth separately", () => {
    expect(getProviderReadiness(ready, { nowMs: now })).toMatchObject({
      color: "green",
      action: null,
    });
    expect(
      getProviderReadiness({ ...ready, auth: { status: "unknown" } }, { nowMs: now }).color,
    ).toBe("yellow");
    expect(getProviderReadiness(ready, { nowMs: now + 600_001 }).color).toBe("yellow");
  });

  it("waits for the last exhausted window, without guessing missing reset times", () => {
    const provider = {
      ...ready,
      usageLimits: {
        checkedAt: ready.checkedAt,
        windows: [
          {
            id: "daily",
            kind: "other" as const,
            label: "Daily",
            usedPercent: 100,
            resetsAt: "2026-10-16T13:00:00Z",
          },
          {
            id: "weekly",
            kind: "weekly" as const,
            label: "Weekly",
            usedPercent: 100,
            resetsAt: "2026-10-17T13:00:00Z",
          },
        ],
      },
    };
    expect(getProviderReadiness(provider, { nowMs: now })).toMatchObject({
      color: "red",
      action: "wait",
      resetsAt: "2026-10-17T13:00:00Z",
    });
    expect(getProviderReadiness(provider, { nowMs: now, canSwitch: true }).action).toBe(
      "switch_account",
    );
    provider.usageLimits.windows[0] = { ...provider.usageLimits.windows[0]!, resetsAt: "" };
    expect(getProviderReadiness(provider, { nowMs: now }).action).toBe("check");
  });
});
