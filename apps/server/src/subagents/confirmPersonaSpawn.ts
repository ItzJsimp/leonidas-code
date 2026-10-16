/**
 * The spawn gate for a named subagent (ADR-0082): a free-tier model starts at
 * once; a confirm-tier model waits for the user's card unless this thread
 * already allowed it.
 */
import {
  DEFAULT_SUBAGENT_TIER_GOOD_FOR,
  OrchestratorMcpFailure,
  type ThreadId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { SpawnApprovals } from "./SpawnApprovals.ts";
import {
  estimatePersonaStartTokens,
  readAiosModelTiersNear,
  resolveSpawnTier,
} from "./spawnTiers.ts";
import type { LoadedSubagentPersona } from "./subagentPersona.ts";

const denied = (message: string) =>
  new OrchestratorMcpFailure({ code: "capability_denied", message });

/** Free-tier spawns pass; confirm-tier spawns wait for the user's card (ADR-0082). */
export const confirmPersonaSpawn = Effect.fn("confirmPersonaSpawn")(function* (input: {
  readonly persona: LoadedSubagentPersona;
  readonly parent: { readonly thread: { readonly id: ThreadId; readonly title: string } };
  readonly model: string;
  readonly account: string;
  readonly reason: string;
  readonly appFreeModels: ReadonlyArray<string>;
  readonly approvalId: string;
}) {
  const { persona, parent, model, appFreeModels } = input;
  const approvals = yield* SpawnApprovals;
  const estimatedStartTokens = estimatePersonaStartTokens({
    systemPromptChars: persona.systemPrompt.length,
    tools: persona.spec.tools,
  });
  const started = approvals.recordSpawn(estimatedStartTokens);
  const aios = yield* Effect.try({
    try: () => readAiosModelTiersNear(persona.specPath),
    catch: (error) =>
      new OrchestratorMcpFailure({
        code: "invalid_request",
        message: error instanceof Error ? error.message : String(error),
      }),
  });
  const mapped = resolveSpawnTier({ model, appFreeModels, aios });
  // A spec may raise its own tier to confirm, never lower it.
  const tier =
    persona.spec.tier === "confirm" && mapped.tier === "free"
      ? {
          tier: "confirm" as const,
          source: "subagent" as const,
          goodFor: DEFAULT_SUBAGENT_TIER_GOOD_FOR.confirm,
        }
      : mapped;
  if (tier.tier === "free") return yield* started;
  const subagent = persona.spec.name;
  if (yield* approvals.isAllowedForThread({ threadId: parent.thread.id, subagent, model })) {
    return yield* started;
  }
  const outcome = yield* approvals.request({
    id: input.approvalId,
    threadId: parent.thread.id,
    threadTitle: parent.thread.title,
    subagent,
    model,
    account: input.account,
    reason: input.reason.trim().slice(0, 600),
    filesInScope: persona.spec.context.map((entry) => entry.path),
    toolCount: persona.spec.tools.length,
    estimatedStartTokens,
    tierSource: tier.source,
    goodFor: tier.goodFor,
    requestedAt: DateTime.formatIso(yield* DateTime.now),
  });
  switch (outcome.kind) {
    case "allow_once":
    case "allow_thread":
      return yield* started;
    case "deny":
      return yield* denied(
        `The user denied the ${subagent} spawn on ${model}. Do not retry it; continue without this subagent or ask the user.`,
      );
    case "redirect":
      return yield* denied(
        `The user stopped the ${subagent} spawn on ${model} and redirected you: ${outcome.text}`,
      );
    case "timed_out":
      return yield* denied(
        `Nobody answered the ${subagent} spawn card on ${model} in 15 minutes, so it did not start.`,
      );
  }
});
