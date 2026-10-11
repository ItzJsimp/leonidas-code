import type { OrchestrationV2ProviderTurn, OrchestrationV2TurnItem } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

export interface ToolStepSummary {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly durationMs: number;
  readonly status: string;
}

export interface VelocitySummary {
  readonly outputTokens: number | null;
  readonly reasoningTokens: number | null;
  readonly isLive: boolean;
  readonly instantaneousTps: number | null;
  readonly rolling5Tps: number | null;
  readonly rolling10Tps: number | null;
  readonly rolling20Tps: number | null;
  readonly avgToolDurationMs: number | null;
  readonly recentToolSteps: ReadonlyArray<ToolStepSummary>;
  readonly tpsHistory: ReadonlyArray<number>;
  readonly totalTurnsTracked: number;
  readonly totalToolCallsTracked: number;
}

export interface TurnSpeedSample {
  readonly turnId: string;
  readonly durationMs: number;
  readonly outputTokens: number;
  readonly tps: number;
  readonly timestamp: number;
}

function parseTimestamp(timestamp: unknown): number | null {
  if (!timestamp) return null;
  if (typeof timestamp === "string") {
    const ms = Date.parse(timestamp);
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof timestamp === "object" && timestamp !== null) {
    try {
      return DateTime.toEpochMillis(timestamp as DateTime.Utc);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Extracts output token count from a turn's reported usages.
 */
export function extractTurnOutputTokens(
  turn: OrchestrationV2ProviderTurn | null | undefined,
): number {
  if (!turn) return 0;
  if (turn.turnTokenUsage && typeof turn.turnTokenUsage.outputTokens === "number") {
    return turn.turnTokenUsage.outputTokens;
  }
  if (turn.tokenUsage && typeof turn.tokenUsage.outputTokens === "number") {
    return turn.tokenUsage.outputTokens;
  }
  return 0;
}

/**
 * Calculates tokens per second for a single turn.
 * Duration must be positive (>= 50ms) to avoid divide-by-zero or flash artifacts.
 */
export function calculateTurnVelocity(
  turn: OrchestrationV2ProviderTurn | null | undefined,
): number | null {
  if (!turn || !turn.startedAt || !turn.completedAt) return null;

  const startMs = parseTimestamp(turn.startedAt);
  const endMs = parseTimestamp(turn.completedAt);
  if (startMs === null || endMs === null) return null;

  const durationMs = endMs - startMs;
  if (durationMs < 50) return null;

  const outputTokens = extractTurnOutputTokens(turn);
  if (outputTokens <= 0) return null;

  const tps = (outputTokens / durationMs) * 1000;
  return Number.isFinite(tps) ? Math.round(tps * 10) / 10 : null;
}

/**
 * Calculates weighted rolling tokens per second over the last N valid turns.
 * Weighted by total tokens / total duration to avoid bias from 1-token turns.
 * Hermes compatible (no ES2023 array mutation methods).
 */
export function calculateRollingVelocity(
  samples: ReadonlyArray<TurnSpeedSample>,
  windowSize: number,
): number | null {
  if (samples.length === 0 || windowSize <= 0) return null;

  // Take the most recent `windowSize` samples
  const startIndex = Math.max(0, samples.length - windowSize);
  const slice = samples.slice(startIndex);

  let totalTokens = 0;
  let totalDurationMs = 0;

  for (let i = 0; i < slice.length; i++) {
    const s = slice[i]!;
    totalTokens += s.outputTokens;
    totalDurationMs += s.durationMs;
  }

  if (totalDurationMs < 100 || totalTokens <= 0) return null;
  const tps = (totalTokens / totalDurationMs) * 1000;
  return Number.isFinite(tps) ? Math.round(tps * 10) / 10 : null;
}

/**
 * Checks if a turn item represents an active tool call or system action.
 */
export function isToolCallItem(item: OrchestrationV2TurnItem): boolean {
  return (
    item.type === "command_execution" ||
    item.type === "file_change" ||
    item.type === "dynamic_tool" ||
    item.type === "file_search" ||
    item.type === "web_search"
  );
}

/**
 * Formats a clean human-readable title for a tool call item.
 */
export function formatToolItemLabel(item: OrchestrationV2TurnItem): string {
  if (item.title) return item.title;
  switch (item.type) {
    case "command_execution":
      return item.input.slice(0, 32);
    case "file_change":
      return item.fileName;
    case "file_search":
      return item.pattern ? `grep ${item.pattern}` : "file search";
    case "web_search":
      return "web search";
    default:
      return item.type;
  }
}

/**
 * Analyzes recent turn items to extract tool execution latency.
 */
export function analyzeToolCallCadence(
  items: ReadonlyArray<OrchestrationV2TurnItem> | undefined,
  maxItems = 10,
): {
  readonly avgToolDurationMs: number | null;
  readonly recentTools: ReadonlyArray<ToolStepSummary>;
  readonly totalTools: number;
} {
  if (!items || items.length === 0) {
    return { avgToolDurationMs: null, recentTools: [], totalTools: 0 };
  }

  const toolSummaries: ToolStepSummary[] = [];
  let totalDuration = 0;
  let validDurationCount = 0;

  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    if (!isToolCallItem(it)) continue;

    let durationMs = 0;
    if (it.startedAt && it.completedAt) {
      const s = parseTimestamp(it.startedAt);
      const e = parseTimestamp(it.completedAt);
      if (s !== null && e !== null && e >= s) {
        durationMs = e - s;
        totalDuration += durationMs;
        validDurationCount++;
      }
    }

    toolSummaries.push({
      id: it.id,
      type: it.type,
      label: formatToolItemLabel(it),
      durationMs,
      status: it.status,
    });
  }

  const avgToolDurationMs =
    validDurationCount > 0 ? Math.round(totalDuration / validDurationCount) : null;

  // Last N items (most recent first)
  const recentSlice = toolSummaries.slice(-maxItems);
  const recentReversed = [...recentSlice].reverse();

  return {
    avgToolDurationMs,
    recentTools: recentReversed,
    totalTools: toolSummaries.length,
  };
}

/**
 * Builds the complete multi-window VelocitySummary from live provider turns & turn items.
 */
export function deriveVelocitySummary(
  turns: ReadonlyArray<OrchestrationV2ProviderTurn> | undefined,
  turnItems: ReadonlyArray<OrchestrationV2TurnItem> | undefined,
): VelocitySummary {
  if (!turns || turns.length === 0) {
    const { avgToolDurationMs, recentTools, totalTools } = analyzeToolCallCadence(turnItems);
    return {
      outputTokens: null,
      reasoningTokens: null,
      isLive: false,
      instantaneousTps: null,
      rolling5Tps: null,
      rolling10Tps: null,
      rolling20Tps: null,
      avgToolDurationMs,
      recentToolSteps: recentTools,
      tpsHistory: [],
      totalTurnsTracked: 0,
      totalToolCallsTracked: totalTools,
    };
  }

  const samples: TurnSpeedSample[] = [];

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]!;
    if (turn.status === "completed" && turn.startedAt && turn.completedAt) {
      const startMs = parseTimestamp(turn.startedAt);
      const endMs = parseTimestamp(turn.completedAt);

      if (startMs !== null && endMs !== null) {
        const durationMs = endMs - startMs;
        const outputTokens = extractTurnOutputTokens(turn);

        if (durationMs >= 50 && outputTokens > 0) {
          const tps = Math.round((outputTokens / durationMs) * 1000 * 10) / 10;
          samples.push({
            turnId: turn.id,
            durationMs,
            outputTokens,
            tps,
            timestamp: endMs,
          });
        }
      }
    }
  }

  const latestSample = samples.length > 0 ? samples[samples.length - 1] : null;
  const latestTurn = turns[turns.length - 1];
  const isLive = latestTurn?.status === "running";
  const measuredTurn = isLive
    ? latestTurn
    : turns.findLast(
        (turn) =>
          turn.turnTokenUsage?.outputTokens !== undefined ||
          turn.tokenUsage?.outputTokens !== undefined,
      );
  const hasOutput =
    measuredTurn?.turnTokenUsage?.outputTokens !== undefined ||
    measuredTurn?.tokenUsage?.outputTokens !== undefined;
  const outputTokens = hasOutput ? extractTurnOutputTokens(measuredTurn) : null;
  const reasoningTokens =
    measuredTurn?.turnTokenUsage?.reasoningTokens ??
    measuredTurn?.tokenUsage?.reasoningOutputTokens ??
    null;
  const reportMs = parseTimestamp(measuredTurn?.tokenUsage?.updatedAt);
  const startMs = parseTimestamp(measuredTurn?.startedAt);
  const liveDurationMs = reportMs !== null && startMs !== null ? reportMs - startMs : 0;
  // Provider counts arrive in batches. This is turn-average pace, including tool waits,
  // not an invented measurement of the model's private thinking speed.
  const instantaneousTps = isLive
    ? outputTokens !== null && liveDurationMs >= 50
      ? Math.round((outputTokens / liveDurationMs) * 1000 * 10) / 10
      : null
    : latestSample
      ? latestSample.tps
      : null;

  const rolling5Tps = calculateRollingVelocity(samples, 5);
  const rolling10Tps = calculateRollingVelocity(samples, 10);
  const rolling20Tps = calculateRollingVelocity(samples, 20);

  const tpsHistory = samples.slice(-20).map((s) => s.tps);

  const { avgToolDurationMs, recentTools, totalTools } = analyzeToolCallCadence(turnItems);

  return {
    outputTokens,
    reasoningTokens,
    isLive,
    instantaneousTps,
    rolling5Tps,
    rolling10Tps,
    rolling20Tps,
    avgToolDurationMs,
    recentToolSteps: recentTools,
    tpsHistory,
    totalTurnsTracked: samples.length,
    totalToolCallsTracked: totalTools,
  };
}

export function formatTpsLabel(tps: number | null): string {
  if (tps === null || !Number.isFinite(tps)) return "--";
  return `${tps.toFixed(1).replace(/\.0$/, "")} t/s`;
}

export function formatToolDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "--";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
