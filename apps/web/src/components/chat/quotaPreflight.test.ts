import {
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProviderUsageWindow,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { ProviderFailoverTarget } from "./providerFailover";
import { getQuotaPreflightAdvice } from "./quotaPreflight";

const NOW = Date.parse("2026-10-11T12:00:00.000Z");
const RESET = "2026-10-12T00:00:00.000Z";

const window = (
  usedPercent: number,
  overrides: Partial<ServerProviderUsageWindow> = {},
): ServerProviderUsageWindow => ({
  id: "weekly",
  kind: "weekly",
  label: "Weekly",
  usedPercent,
  resetsAt: RESET,
  ...overrides,
});

const estimate = (
  remainingTokens: number,
): NonNullable<ServerProviderUsageWindow["tokenEstimate"]> => ({
  status: "estimated",
  message: "Estimated from measured turns",
  observedTokens: {
    uncachedInputTokens: 0,
    cachedInputTokens: 0,
    cacheCreationTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
  },
  observedPercent: 60,
  samples: 3,
  since: "2026-10-11T00:00:00.000Z",
  through: "2026-10-11T11:00:00.000Z",
  remainingTokens,
});

const codexTarget: ProviderFailoverTarget = {
  instanceId: ProviderInstanceId.make("codex"),
  driverKind: ProviderDriverKind.make("codex"),
  label: "Codex",
  modelSelection: {
    instanceId: ProviderInstanceId.make("codex"),
    model: "gpt-6.1-sol",
    options: [{ id: "effort", value: "medium" }],
  },
  availableModels: [{ slug: "gpt-6.1-sol", name: "GPT-6.1 Sol", isDefault: true }],
};

const current = (windows: ServerProviderUsageWindow[]) => ({
  instanceId: "claudeAgent",
  driverKind: "claudeAgent",
  label: "Claude Jake",
  windows,
});

describe("getQuotaPreflightAdvice", () => {
  it("warns before the next turn when the account is close to its limit", () => {
    const advice = getQuotaPreflightAdvice({
      current: current([window(92)]),
      recentTurnTokenUsages: [],
      targets: [codexTarget],
      nowMs: NOW,
    });

    expect(advice?.target.label).toBe("Codex");
    expect(advice?.usedPercent).toBe(92);
  });

  it("stays quiet while the account has headroom", () => {
    expect(
      getQuotaPreflightAdvice({
        current: current([window(40)]),
        recentTurnTokenUsages: [],
        targets: [codexTarget],
        nowMs: NOW,
      }),
    ).toBeNull();
  });

  it("has nothing to suggest when no other account is ready", () => {
    expect(
      getQuotaPreflightAdvice({
        current: current([window(92)]),
        recentTurnTokenUsages: [],
        targets: [],
        nowMs: NOW,
      }),
    ).toBeNull();
  });

  it("leaves an exhausted account to the usage-limit banner", () => {
    expect(
      getQuotaPreflightAdvice({
        current: current([window(100)]),
        recentTurnTokenUsages: [],
        targets: [codexTarget],
        nowMs: NOW,
      }),
    ).toBeNull();
  });

  it("warns when the measured quota cannot cover another typical turn", () => {
    const advice = getQuotaPreflightAdvice({
      current: current([window(40, { tokenEstimate: estimate(10_000) })]),
      recentTurnTokenUsages: [50_000],
      targets: [codexTarget],
      nowMs: NOW,
    });

    expect(advice?.target.label).toBe("Codex");
  });
});
