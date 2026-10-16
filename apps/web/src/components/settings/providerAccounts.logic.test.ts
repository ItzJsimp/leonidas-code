import type { ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  accountUsage,
  describeAccount,
  groupAccountRows,
  shortPlanLabel,
} from "./providerAccounts.logic";

const provider = (patch: Record<string, unknown>): ServerProvider =>
  ({
    installed: true,
    status: "ready",
    auth: { status: "authenticated" },
    ...patch,
  }) as unknown as ServerProvider;

describe("groupAccountRows", () => {
  it("puts paid services first and keeps their accounts together", () => {
    const rows = [
      { id: "or", driver: "openrouter" },
      { id: "cx", driver: "codex" },
      { id: "c1", driver: "claudeAgent" },
      { id: "cu", driver: "cursor" },
      { id: "c2", driver: "claudeAgent" },
    ];
    const groups = groupAccountRows(rows, (driver) => driver);
    expect(groups.map((group) => group.driver)).toEqual([
      "claudeAgent",
      "codex",
      "openrouter",
      "cursor",
    ]);
    expect(groups[0]!.rows.map((row) => row.id)).toEqual(["c1", "c2"]);
  });
});

describe("describeAccount", () => {
  const base = { driver: "claudeAgent", enabled: true, needsApiKey: false };

  it("offers the Claude install when Claude is missing", () => {
    expect(describeAccount({ ...base, provider: provider({ installed: false }) })).toEqual({
      tone: "attention",
      text: "Claude is not installed",
      action: "install",
    });
  });

  it("offers sign-in when signed out", () => {
    const signedOut = provider({ status: "error", auth: { status: "unauthenticated" } });
    expect(describeAccount({ ...base, provider: signedOut }).action).toBe("signIn");
  });

  it("shows email and plan when ready", () => {
    const ready = provider({
      auth: { status: "authenticated", email: "g@x.com", label: "Claude Pro Subscription" },
    });
    expect(describeAccount({ ...base, provider: ready })).toEqual({
      tone: "ok",
      text: "g@x.com · Claude Pro",
      action: null,
    });
  });

  it("asks for an API key before anything else", () => {
    expect(
      describeAccount({ ...base, driver: "openrouter", needsApiKey: true, provider: undefined })
        .action,
    ).toBe("addKey");
  });

  it("says turned off without an action", () => {
    expect(describeAccount({ ...base, enabled: false, provider: provider({}) })).toEqual({
      tone: "off",
      text: "Turned off",
      action: null,
    });
  });
});

describe("accountUsage", () => {
  it("shows the five-hour limit above the weekly limit", () => {
    const withUsage = provider({
      usageLimits: {
        windows: [
          {
            id: "seven_day",
            kind: "weekly",
            label: "Weekly",
            usedPercent: 71.6,
          },
          {
            id: "five_hour",
            kind: "session",
            label: "5-hour",
            windowDurationMins: 300,
            usedPercent: 12.4,
          },
        ],
      },
    });
    expect(accountUsage(withUsage)).toEqual([
      { percent: 12, name: "5-hour", label: "5-hour session" },
      { percent: 72, name: "Weekly", label: "Weekly, all models" },
    ]);
  });

  it("leaves out a limit the provider has not reported", () => {
    const weeklyOnly = provider({
      usageLimits: {
        windows: [{ id: "seven_day", kind: "weekly", label: "Weekly", usedPercent: 40 }],
      },
    });
    expect(accountUsage(weeklyOnly).map((meter) => meter.name)).toEqual(["Weekly"]);
  });

  it("returns nothing when the provider reports no usage", () => {
    expect(accountUsage(provider({}))).toEqual([]);
  });
});

describe("shortPlanLabel", () => {
  it("drops the word Subscription", () => {
    expect(shortPlanLabel("ChatGPT Plus Subscription")).toBe("ChatGPT Plus");
    expect(shortPlanLabel(undefined)).toBeNull();
  });
});
