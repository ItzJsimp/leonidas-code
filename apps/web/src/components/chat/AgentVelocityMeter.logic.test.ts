import { describe, expect, it } from "vite-plus/test";
import {
  analyzeToolCallCadence,
  calculateRollingVelocity,
  calculateTurnVelocity,
  deriveVelocitySummary,
  extractTurnOutputTokens,
  formatToolDuration,
  formatTpsLabel,
  type TurnSpeedSample,
} from "./AgentVelocityMeter.logic";
import type { OrchestrationV2ProviderTurn, OrchestrationV2TurnItem } from "@t3tools/contracts";

describe("AgentVelocityMeter.logic", () => {
  describe("extractTurnOutputTokens", () => {
    it("extracts output tokens from turnTokenUsage preferentially", () => {
      const turn = {
        turnTokenUsage: {
          usageScope: "main_agent",
          usageStatus: "complete",
          inputTokens: 100,
          outputTokens: 64,
          hasSubagents: false,
        },
        tokenUsage: {
          usedTokens: 164,
          outputTokens: 50,
          updatedAt: new Date().toISOString(),
        },
      } as unknown as OrchestrationV2ProviderTurn;

      expect(extractTurnOutputTokens(turn)).toBe(64);
    });

    it("falls back to tokenUsage when turnTokenUsage is not available", () => {
      const turn = {
        tokenUsage: {
          usedTokens: 164,
          outputTokens: 50,
          updatedAt: new Date().toISOString(),
        },
      } as unknown as OrchestrationV2ProviderTurn;

      expect(extractTurnOutputTokens(turn)).toBe(50);
    });

    it("returns 0 if neither is present or values are missing", () => {
      expect(extractTurnOutputTokens(null)).toBe(0);
      expect(extractTurnOutputTokens(undefined)).toBe(0);
      expect(extractTurnOutputTokens({} as OrchestrationV2ProviderTurn)).toBe(0);
    });
  });

  describe("calculateTurnVelocity", () => {
    it("computes accurate tokens per second for valid turn timing", () => {
      const turn = {
        startedAt: "2026-10-10T12:00:00.000Z",
        completedAt: "2026-10-10T12:00:01.000Z", // 1000ms
        turnTokenUsage: {
          usageScope: "main_agent",
          usageStatus: "complete",
          inputTokens: 200,
          outputTokens: 64,
          hasSubagents: false,
        },
      } as unknown as OrchestrationV2ProviderTurn;

      expect(calculateTurnVelocity(turn)).toBe(64);
    });

    it("returns null for sub-50ms flash executions to prevent extreme spikes", () => {
      const turn = {
        startedAt: "2026-10-10T12:00:00.000Z",
        completedAt: "2026-10-10T12:00:00.020Z", // 20ms
        tokenUsage: {
          usedTokens: 10,
          outputTokens: 5,
          updatedAt: "2026-10-10T12:00:00.020Z",
        },
      } as unknown as OrchestrationV2ProviderTurn;

      expect(calculateTurnVelocity(turn)).toBeNull();
    });

    it("returns null when output tokens are 0", () => {
      const turn = {
        startedAt: "2026-10-10T12:00:00.000Z",
        completedAt: "2026-10-10T12:00:02.000Z",
        tokenUsage: {
          usedTokens: 50,
          outputTokens: 0,
          updatedAt: "2026-10-10T12:00:02.000Z",
        },
      } as unknown as OrchestrationV2ProviderTurn;

      expect(calculateTurnVelocity(turn)).toBeNull();
    });
  });

  describe("calculateRollingVelocity", () => {
    const samples: TurnSpeedSample[] = [
      { turnId: "1", durationMs: 1000, outputTokens: 60, tps: 60, timestamp: 1 },
      { turnId: "2", durationMs: 1000, outputTokens: 70, tps: 70, timestamp: 2 },
      { turnId: "3", durationMs: 2000, outputTokens: 100, tps: 50, timestamp: 3 },
      { turnId: "4", durationMs: 1000, outputTokens: 40, tps: 40, timestamp: 4 },
      { turnId: "5", durationMs: 1000, outputTokens: 80, tps: 80, timestamp: 5 },
      { turnId: "6", durationMs: 1000, outputTokens: 90, tps: 90, timestamp: 6 },
    ];

    it("calculates weighted average over rolling window of 5", () => {
      // Last 5 samples: #2, #3, #4, #5, #6
      // tokens = 70 + 100 + 40 + 80 + 90 = 380
      // duration = 1000 + 2000 + 1000 + 1000 + 1000 = 6000ms
      // TPS = 380 / 6 = 63.3 t/s
      const avg = calculateRollingVelocity(samples, 5);
      expect(avg).toBe(63.3);
    });

    it("handles windows larger than sample count gracefully", () => {
      // All 6 samples: tokens = 60 + 380 = 440, duration = 7000ms => 440 / 7 = 62.9 t/s
      const avg = calculateRollingVelocity(samples, 20);
      expect(avg).toBe(62.9);
    });

    it("returns null for empty samples", () => {
      expect(calculateRollingVelocity([], 5)).toBeNull();
    });
  });

  describe("analyzeToolCallCadence", () => {
    it("extracts and averages tool call durations", () => {
      const items = [
        {
          id: "it1",
          type: "command_execution",
          input: "pnpm test",
          status: "completed",
          startedAt: "2026-10-10T12:00:00.000Z",
          completedAt: "2026-10-10T12:00:01.500Z", // 1500ms
        },
        {
          id: "it2",
          type: "file_change",
          fileName: "src/index.ts",
          status: "completed",
          startedAt: "2026-10-10T12:00:02.000Z",
          completedAt: "2026-10-10T12:00:02.500Z", // 500ms
        },
      ] as unknown as ReadonlyArray<OrchestrationV2TurnItem>;

      const cadence = analyzeToolCallCadence(items);
      expect(cadence.avgToolDurationMs).toBe(1000); // (1500 + 500) / 2
      expect(cadence.totalTools).toBe(2);
      expect(cadence.recentTools.length).toBe(2);
      expect(cadence.recentTools[0]?.label).toBe("src/index.ts"); // reversed (latest first)
    });
  });

  describe("deriveVelocitySummary", () => {
    it("shows a running Codex turn and includes reasoning once in output", () => {
      const turn = {
        id: "live",
        status: "running",
        startedAt: "2026-10-10T12:00:00Z",
        completedAt: null,
        tokenUsage: { usedTokens: 900, outputTokens: 40, updatedAt: "2026-10-10T12:00:02Z" },
        turnTokenUsage: {
          usageStatus: "partial",
          usageScope: "main_agent",
          hasSubagents: false,
          outputTokens: 100,
          reasoningTokens: 60,
        },
      } as unknown as OrchestrationV2ProviderTurn;
      const summary = deriveVelocitySummary([turn], []);
      expect(summary.outputTokens).toBe(100);
      expect(summary.reasoningTokens).toBe(60);
      expect(summary.instantaneousTps).toBe(50);
      expect(summary.isLive).toBe(true);
      expect(summary.totalTurnsTracked).toBe(0);
    });

    it("keeps missing provider telemetry distinct from measured zero", () => {
      const turn = {
        status: "running",
        startedAt: "2026-10-10T12:00:00Z",
        tokenUsage: { usedTokens: 200, updatedAt: "2026-10-10T12:00:02Z" },
      } as unknown as OrchestrationV2ProviderTurn;
      expect(deriveVelocitySummary([turn], []).outputTokens).toBeNull();
      expect(
        deriveVelocitySummary(
          [
            {
              ...turn,
              turnTokenUsage: {
                usageStatus: "partial",
                usageScope: "main_agent",
                hasSubagents: false,
                outputTokens: 0,
              },
            },
          ],
          [],
        ).outputTokens,
      ).toBe(0);
    });
    it("does not present one response's context usage as a live turn total", () => {
      const turn = {
        status: "running",
        startedAt: "2026-10-10T12:00:00Z",
        tokenUsage: {
          usedTokens: 200,
          outputTokens: 40,
          reasoningOutputTokens: 0,
          updatedAt: "2026-10-10T12:00:02Z",
        },
      } as unknown as OrchestrationV2ProviderTurn;
      const summary = deriveVelocitySummary([turn], []);
      expect(summary.outputTokens).toBeNull();
      expect(summary.instantaneousTps).toBeNull();
      expect(summary.reasoningTokens).toBeNull();
    });
    it("returns null-safe empty summary when no turns exist", () => {
      const summary = deriveVelocitySummary([], []);
      expect(summary.instantaneousTps).toBeNull();
      expect(summary.rolling5Tps).toBeNull();
      expect(summary.rolling10Tps).toBeNull();
      expect(summary.rolling20Tps).toBeNull();
      expect(summary.totalTurnsTracked).toBe(0);
    });
  });

  describe("formatting helpers", () => {
    it("formats TPS labels cleanly", () => {
      expect(formatTpsLabel(null)).toBe("--");
      expect(formatTpsLabel(64.2)).toBe("64.2 t/s");
      expect(formatTpsLabel(64.0)).toBe("64 t/s");
    });

    it("formats tool durations appropriately", () => {
      expect(formatToolDuration(null)).toBe("--");
      expect(formatToolDuration(250)).toBe("250ms");
      expect(formatToolDuration(1800)).toBe("1.8s");
    });
  });
});
