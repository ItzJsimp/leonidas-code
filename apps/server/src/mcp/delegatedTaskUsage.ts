import type {
  OrchestrationV2ProviderTurn,
  OrchestrationV2Run,
  OrchestratorMcpDelegatedTaskUsage,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

type UsageRun = Pick<OrchestrationV2Run, "startedAt" | "completedAt">;
type UsageTurn = Pick<OrchestrationV2ProviderTurn, "turnTokenUsage">;

const addOptional = (total: number | null, value: number | undefined): number | null =>
  value === undefined ? total : (total ?? 0) + value;

/**
 * Cost of a delegated child thread, summed only from provider-reported turn
 * usage. A field no turn reported stays null; nothing is estimated.
 */
export const delegatedTaskUsage = (
  providerTurns: ReadonlyArray<UsageTurn>,
  runs: ReadonlyArray<UsageRun>,
  now: DateTime.Utc,
): OrchestratorMcpDelegatedTaskUsage => {
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let cachedInputTokens: number | null = null;
  let reasoningTokens: number | null = null;
  let reported = 0;
  let complete = 0;
  for (const turn of providerTurns) {
    const usage = turn.turnTokenUsage;
    if (usage === undefined || usage.usageStatus === "unavailable") continue;
    reported += 1;
    if (usage.usageStatus === "complete") complete += 1;
    inputTokens = addOptional(inputTokens, usage.inputTokens);
    outputTokens = addOptional(outputTokens, usage.outputTokens);
    cachedInputTokens = addOptional(cachedInputTokens, usage.cachedInputTokens);
    reasoningTokens = addOptional(reasoningTokens, usage.reasoningTokens);
  }
  let wallTimeMs: number | null = null;
  for (const run of runs) {
    if (run.startedAt == null) continue;
    const end = run.completedAt ?? now;
    wallTimeMs =
      (wallTimeMs ?? 0) +
      Math.max(0, DateTime.toEpochMillis(end) - DateTime.toEpochMillis(run.startedAt));
  }
  return {
    usageStatus:
      reported === 0 ? "unavailable" : complete === providerTurns.length ? "complete" : "partial",
    inputTokens,
    outputTokens,
    cachedInputTokens,
    reasoningTokens,
    providerTurnCount: providerTurns.length,
    runCount: runs.length,
    wallTimeMs,
  };
};
