import { describe, expect, it } from "vite-plus/test";
import {
  analyzeToolCallCadence,
  calculateRollingVelocity,
  calculateTurnVelocity,
  deriveVelocitySummary,
  extractTurnOutputTokens,
  formatCacheHitRate,
  formatRollingLabel,
  formatToolDuration,
  formatToolWait,
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

    it("ignores response-level tokenUsage when turnTokenUsage is not available", () => {
      const turn = {
        tokenUsage: {
          usedTokens: 164,
          outputTokens: 50,
          updatedAt: new Date().toISOString(),
        },
      } as unknown as OrchestrationV2ProviderTurn;

      expect(extractTurnOutputTokens(turn)).toBe(0);
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

    it("returns null until the window is full instead of repeating a smaller window", () => {
      expect(calculateRollingVelocity(samples, 10)).toBeNull();
      expect(calculateRollingVelocity(samples, 20)).toBeNull();
      expect(calculateRollingVelocity(samples, 6)).toBe(62.9);
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
      expect(summary.averageTurnTps).toBe(50);
      expect(summary.isLive).toBe(true);
      expect(summary.totalTurnsTracked).toBe(0);
    });

    it("builds an input ledger from the latest turn that reported input", () => {
      const done = {
        id: "done",
        status: "completed",
        startedAt: "2026-10-10T12:00:00Z",
        completedAt: "2026-10-10T12:00:04Z",
        turnTokenUsage: {
          usageStatus: "complete",
          usageScope: "main_agent",
          hasSubagents: false,
          inputTokens: 20_000,
          cachedInputTokens: 15_000,
          cacheCreationTokens: 3_000,
          outputTokens: 400,
          reasoningTokens: 100,
        },
      } as unknown as OrchestrationV2ProviderTurn;
      const live = {
        id: "live",
        status: "running",
        startedAt: "2026-10-10T12:00:05Z",
        completedAt: null,
        turnTokenUsage: { usageStatus: "partial", usageScope: "main_agent", hasSubagents: false },
      } as unknown as OrchestrationV2ProviderTurn;
      expect(deriveVelocitySummary([done, live], []).ledger).toMatchObject({
        cacheReadTokens: 15_000,
        cacheWriteTokens: 3_000,
        freshInputTokens: 2_000,
        cacheHitRate: 0.75,
        thinkingTokens: 100,
      });
    });

    it("has no ledger until a turn reports input", () => {
      expect(deriveVelocitySummary([], []).ledger).toBeNull();
      const turn = {
        id: "t",
        status: "completed",
        turnTokenUsage: {
          usageStatus: "partial",
          usageScope: "main_agent",
          hasSubagents: false,
          outputTokens: 5,
        },
      } as unknown as OrchestrationV2ProviderTurn;
      expect(deriveVelocitySummary([turn], []).ledger).toBeNull();
    });

    it("averages reported turn totals over the whole turn, including tool waits", () => {
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
      expect(deriveVelocitySummary([turn], []).averageTurnTps).toBe(50);
      const laterReport = {
        ...turn,
        tokenUsage: { ...turn.tokenUsage!, outputTokens: 100, updatedAt: "2026-10-10T12:00:10Z" },
        turnTokenUsage: { ...turn.turnTokenUsage!, outputTokens: 200, reasoningTokens: 80 },
      };
      const summary = deriveVelocitySummary([laterReport], []);
      expect(summary.outputTokens).toBe(200);
      expect(summary.averageTurnTps).toBe(20);
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
    it("keeps the latest reported count and throughput on the same terminal turn", () => {
      const completed = {
        id: "completed",
        status: "completed",
        startedAt: "2026-10-10T12:00:00Z",
        completedAt: "2026-10-10T12:00:02Z",
        turnTokenUsage: {
          usageStatus: "complete",
          usageScope: "main_agent",
          hasSubagents: false,
          outputTokens: 100,
        },
      } as unknown as OrchestrationV2ProviderTurn;
      const interrupted = {
        ...completed,
        id: "interrupted",
        status: "interrupted",
        startedAt: "2026-10-10T12:00:03Z",
        completedAt: "2026-10-10T12:00:06Z",
        turnTokenUsage: { ...completed.turnTokenUsage!, usageStatus: "partial", outputTokens: 30 },
      } as unknown as OrchestrationV2ProviderTurn;
      const summary = deriveVelocitySummary([completed, interrupted], []);
      expect(summary.outputTokens).toBe(30);
      expect(summary.averageTurnTps).toBe(10);
      expect(summary.rolling5Tps).toBeNull();
      expect(summary.totalTurnsTracked).toBe(1);
    });
    it("keeps the headline pace and rolling pace on the same turn totals", () => {
      const turns = Array.from({ length: 5 }, (_, i) => ({
        id: `t${i}`,
        status: "completed",
        startedAt: `2026-10-10T12:0${i}:00Z`,
        completedAt: `2026-10-10T12:0${i}:02Z`,
        turnTokenUsage: {
          usageStatus: "complete",
          usageScope: "main_agent",
          hasSubagents: false,
          outputTokens: 280,
        },
        tokenUsage: { usedTokens: 900, outputTokens: 25, updatedAt: `2026-10-10T12:0${i}:02Z` },
      })) as unknown as OrchestrationV2ProviderTurn[];
      const summary = deriveVelocitySummary(turns, []);
      expect(summary.averageTurnTps).toBe(140);
      expect(summary.rolling5Tps).toBe(140);
      expect(summary.rolling10Tps).toBeNull();
      expect(summary.rolling20Tps).toBeNull();
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
      expect(summary.averageTurnTps).toBeNull();
      expect(summary.reasoningTokens).toBeNull();
    });
    describe("model stream timing", () => {
      const turn = {
        id: "t",
        status: "completed",
        startedAt: "2026-10-10T12:00:00Z",
        completedAt: "2026-10-10T12:00:10Z",
        turnTokenUsage: {
          usageStatus: "complete",
          usageScope: "main_agent",
          hasSubagents: false,
          outputTokens: 500,
        },
      } as unknown as OrchestrationV2ProviderTurn;
      const item = (
        type: string,
        providerTurnId: string,
        startedAt: string,
        completedAt: string | null,
        status = "completed",
      ) =>
        ({
          id: `${type}-${startedAt}`,
          type,
          providerTurnId,
          startedAt,
          completedAt,
          status,
          input: "pnpm test",
          toolName: "Bash",
        }) as unknown as OrchestrationV2TurnItem;

      it("separates model-stream pace from whole-turn pace by removing merged tool waits", () => {
        const summary = deriveVelocitySummary(
          [turn],
          [
            item("reasoning", "t", "2026-10-10T12:00:01Z", "2026-10-10T12:00:02Z"),
            item("command_execution", "t", "2026-10-10T12:00:02Z", "2026-10-10T12:00:06Z"),
            // Overlaps the first tool call, so only 12:00:06 to 12:00:07 adds wait.
            item("dynamic_tool", "t", "2026-10-10T12:00:04Z", "2026-10-10T12:00:07Z"),
            // Another turn's tool call never counts against this turn.
            item("command_execution", "other", "2026-10-10T12:00:07Z", "2026-10-10T12:00:09Z"),
          ],
        );
        expect(summary.averageTurnTps).toBe(50);
        expect(summary.turnDurationMs).toBe(10_000);
        expect(summary.toolWaitMs).toBe(5_000);
        expect(summary.modelStreamTps).toBe(100);
        expect(summary.firstOutputMs).toBe(1_000);
      });

      it("counts a still-running tool call up to the latest provider report", () => {
        const live = {
          ...turn,
          status: "running",
          completedAt: null,
          tokenUsage: { usedTokens: 900, updatedAt: "2026-10-10T12:00:10Z" },
        } as unknown as OrchestrationV2ProviderTurn;
        const summary = deriveVelocitySummary(
          [live],
          [item("command_execution", "t", "2026-10-10T12:00:06Z", null, "running")],
        );
        expect(summary.toolWaitMs).toBe(4_000);
        expect(summary.modelStreamTps).toBeCloseTo(83.3, 1);
      });

      it("reports no model-stream pace when tools account for the whole turn", () => {
        const summary = deriveVelocitySummary(
          [turn],
          [item("command_execution", "t", "2026-10-10T12:00:00Z", "2026-10-10T12:00:10Z")],
        );
        expect(summary.toolWaitMs).toBe(10_000);
        expect(summary.modelStreamTps).toBeNull();
      });

      it("matches whole-turn pace when the turn used no tools", () => {
        const summary = deriveVelocitySummary([turn], []);
        expect(summary.toolWaitMs).toBe(0);
        expect(summary.modelStreamTps).toBe(50);
        expect(summary.firstOutputMs).toBeNull();
      });
    });
    it("returns null-safe empty summary when no turns exist", () => {
      const summary = deriveVelocitySummary([], []);
      expect(summary.averageTurnTps).toBeNull();
      expect(summary.rolling5Tps).toBeNull();
      expect(summary.rolling10Tps).toBeNull();
      expect(summary.rolling20Tps).toBeNull();
      expect(summary.totalTurnsTracked).toBe(0);
    });
  });

  describe("formatting helpers", () => {
    it("explains a rolling window that is not full yet", () => {
      expect(formatRollingLabel(null, 10, 3)).toBe("Needs 10 turns (3 so far)");
      expect(formatRollingLabel(null, 5, 12)).toBe("Needs 5 turns (5 so far)");
      expect(formatRollingLabel(42.5, 5, 5)).toBe("42.5 t/s");
    });
    it("formats TPS labels cleanly", () => {
      expect(formatTpsLabel(null)).toBe("--");
      expect(formatTpsLabel(64.2)).toBe("64.2 t/s");
      expect(formatTpsLabel(64.0)).toBe("64 t/s");
    });

    it("states tool wait as time and share of the turn", () => {
      expect(formatToolWait({ toolWaitMs: 12_400, turnDurationMs: 40_000 })).toBe(
        "12.4s (31% of turn)",
      );
      expect(formatToolWait({ toolWaitMs: null, turnDurationMs: 40_000 })).toBe("--");
      expect(formatToolWait({ toolWaitMs: 0, turnDurationMs: 0 })).toBe("--");
    });

    it("formats tool durations appropriately", () => {
      expect(formatToolDuration(null)).toBe("--");
      expect(formatToolDuration(250)).toBe("250ms");
      expect(formatCacheHitRate(0.754)).toBe("75%");
      expect(formatCacheHitRate(null)).toBe("--");
      expect(formatToolDuration(1800)).toBe("1.8s");
    });
  });
});
