import { describe, expect, it } from "vite-plus/test";

import {
  calculateTurnsRemaining,
  computeMaxUsedPercent,
  estimateAverageTurnCost,
  evaluatePredictiveQuota,
  rankCandidateAccounts,
  type PredictiveQuotaAccountCandidate,
} from "./predictiveQuotaHandoff.js";

describe("predictiveQuotaHandoff", () => {
  const nowMs = Date.parse("2026-10-11T00:00:00.000Z");
  const current: PredictiveQuotaAccountCandidate = {
    providerInstanceId: "claude-personal",
    accountLabel: "Claude Personal",
    driverKind: "claude",
    identityKeys: ["jake@example.com"],
    modelIds: ["claude-sonnet"],
    windows: [
      { usedPercent: 60 },
      {
        usedPercent: 75,
        tokenEstimate: { status: "estimated", capacityTokens: 20_000, remainingTokens: 5_000 },
      },
    ],
  };
  const healthy: PredictiveQuotaAccountCandidate = {
    providerInstanceId: "claude-team",
    accountLabel: "Claude Team",
    driverKind: "claude",
    identityKeys: ["team@example.com"],
    modelIds: ["claude-sonnet"],
    windows: [{ usedPercent: 30 }],
  };

  it("uses active measured quota windows and ignores expired windows", () => {
    expect(
      computeMaxUsedPercent(
        [
          { usedPercent: 99, resetsAt: "2026-10-10T23:00:00.000Z" },
          { usedPercent: 42, resetsAt: "2026-10-12T00:00:00.000Z" },
        ],
        nowMs,
      ),
    ).toBe(42);
    expect(computeMaxUsedPercent([], nowMs)).toBeUndefined();
  });

  it("estimates turns only from observed turn costs and remaining token estimates", () => {
    expect(estimateAverageTurnCost([3_000, 5_000])).toBe(4_000);
    expect(estimateAverageTurnCost([])).toBeUndefined();
    expect(calculateTurnsRemaining(current.windows, 2_000, nowMs)).toBe(2);
    expect(calculateTurnsRemaining([{ usedPercent: 90 }], 2_000, nowMs)).toBeUndefined();
  });

  it("marks an imminent account for preemptive handoff and ranks healthy alternatives", () => {
    const evaluation = evaluatePredictiveQuota({
      currentAccount: {
        ...current,
        windows: [{ usedPercent: 94 }],
      },
      nowMs,
      candidateAccounts: [
        { ...healthy, windows: [{ usedPercent: 35 }] },
        { ...healthy, providerInstanceId: "claude-other", windows: [{ usedPercent: 100 }] },
      ],
    });

    expect(evaluation.exhaustionRisk).toBe("imminent");
    expect(evaluation.shouldPreemptivelyHandoff).toBe(true);
    expect(evaluation.recommendedAccount?.providerInstanceId).toBe("claude-team");
  });

  it("predicts exhaustion from recent turns when the measured remaining tokens are lower", () => {
    const evaluation = evaluatePredictiveQuota({
      currentAccount: {
        ...current,
        windows: [
          {
            usedPercent: 20,
            tokenEstimate: { status: "estimated", remainingTokens: 900 },
          },
        ],
      },
      recentTurnTokenUsages: [1_200, 1_800],
      candidateAccounts: [{ ...healthy, windows: [{ usedPercent: 10 }] }],
      nowMs,
    });

    expect(evaluation.exhaustionRisk).toBe("imminent");
    expect(evaluation.shouldPreemptivelyHandoff).toBe(true);
    expect(evaluation.recommendedAccount?.providerInstanceId).toBe("claude-team");
  });

  it("does not invent a turn budget when providers have no token estimate", () => {
    const evaluation = evaluatePredictiveQuota({
      currentAccount: { ...current, windows: [{ usedPercent: 50 }] },
      nowMs,
    });

    expect(evaluation.predictedTurnsRemaining).toBeUndefined();
    expect(evaluation.exhaustionRisk).toBe("nominal");
  });

  it("filters exhausted and same-identity accounts", () => {
    const ranked = rankCandidateAccounts(
      [
        healthy,
        { ...healthy, providerInstanceId: "same-login", identityKeys: ["jake@example.com"] },
        { ...healthy, providerInstanceId: "limited", windows: [{ usedPercent: 100 }] },
      ],
      current.providerInstanceId,
      nowMs,
      current.identityKeys,
    );

    expect(ranked.map((candidate) => candidate.providerInstanceId)).toEqual(["claude-team"]);
  });
});
