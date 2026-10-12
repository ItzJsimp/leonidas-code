import {
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProviderUsageWindow,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { ProviderFailoverTarget } from "./providerFailover.ts";
import { getQuotaPreflightAdvice } from "./quotaPreflight.ts";

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
  label: "Codex",
  modelSelection: {
    instanceId: ProviderInstanceId.make("codex"),
    model: "gpt-6.1-sol",
    options: [{ id: "effort", value: "medium" }],
  },
};

const current = (windows: ServerProviderUsageWindow[]) => ({
  instanceId: "claudeAgent",
  driverKind: "claudeAgent",
  label: "Claude Jake",
  windows,
});

describe("getQuotaPreflightAdvice", () => {
  it("warns when used percent reaches 90%", () => {
    const advice = getQuotaPreflightAdvice({
      current: current([window(92)]),
      recentTurnTokenUsages: [],
      targets: [codexTarget],
      nowMs: NOW,
    });
    expect(advice).toEqual({ target: codexTarget, usedPercent: 92 });
  });

  it("warns when remaining tokens cannot cover a typical turn", () => {
    const advice = getQuotaPreflightAdvice({
      current: current([window(80, { tokenEstimate: estimate(4_000) })]),
      recentTurnTokenUsages: [5_000, 6_000, 5_500],
      targets: [codexTarget],
      nowMs: NOW,
    });
    expect(advice).toEqual({ target: codexTarget, usedPercent: 80 });
  });

  it("stays quiet when quota is healthy", () => {
    const advice = getQuotaPreflightAdvice({
      current: current([window(40)]),
      recentTurnTokenUsages: [5_000],
      targets: [codexTarget],
      nowMs: NOW,
    });
    expect(advice).toBeNull();
  });

  it("returns null when no targets are available", () => {
    const advice = getQuotaPreflightAdvice({
      current: current([window(95)]),
      recentTurnTokenUsages: [],
      targets: [],
      nowMs: NOW,
    });
    expect(advice).toBeNull();
  });
});
