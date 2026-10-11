import { describe, expect, it } from "vite-plus/test";

import { selectOptimalSwarmAccount, type SwarmAccountProfile } from "./shadowSwarmMultiplexer.js";

describe("shadowSwarmMultiplexer", () => {
  const nowMs = Date.parse("2026-10-11T00:00:00.000Z");
  const primary: SwarmAccountProfile = {
    providerInstanceId: "codex-personal",
    driverKind: "codex",
    identityKeys: ["personal@example.com"],
    modelIds: ["gpt-model"],
    windows: [{ usedPercent: 78 }],
    available: true,
  };
  const team: SwarmAccountProfile = {
    providerInstanceId: "codex-team",
    driverKind: "codex",
    identityKeys: ["team@example.com"],
    modelIds: ["gpt-model"],
    windows: [{ usedPercent: 34 }],
    available: true,
  };

  it("routes same-model background work to a healthier connected account", () => {
    const result = selectOptimalSwarmAccount({
      accounts: [primary, team],
      currentInstanceId: primary.providerInstanceId,
      driverKind: "codex",
      modelId: "gpt-model",
      nowMs,
    });

    expect(result?.selectedAccount.providerInstanceId).toBe("codex-team");
    expect(result?.usedPercent).toBe(34);
  });

  it("keeps model/provider compatibility and account identity as hard routing boundaries", () => {
    const result = selectOptimalSwarmAccount({
      accounts: [
        primary,
        { ...team, providerInstanceId: "other-provider", driverKind: "claude" },
        { ...team, providerInstanceId: "other-model", modelIds: ["different-model"] },
        { ...team, providerInstanceId: "same-login", identityKeys: ["personal@example.com"] },
      ],
      currentInstanceId: primary.providerInstanceId,
      driverKind: "codex",
      modelId: "gpt-model",
      nowMs,
    });

    expect(result).toBeUndefined();
  });

  it("never routes work to unavailable, exhausted, or unmeasured accounts", () => {
    const result = selectOptimalSwarmAccount({
      accounts: [
        { ...primary, windows: [{ usedPercent: 100 }] },
        { ...team, providerInstanceId: "disabled", available: false },
        { ...team, providerInstanceId: "limited", isRateLimited: true },
        { ...team, providerInstanceId: "unknown", windows: [] },
      ],
      currentInstanceId: primary.providerInstanceId,
      driverKind: "codex",
      modelId: "gpt-model",
      nowMs,
    });

    expect(result).toBeUndefined();
  });
});
