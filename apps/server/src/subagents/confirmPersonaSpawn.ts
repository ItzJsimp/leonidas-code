/**
 * The spawn gate for a named subagent (ADR-0082): a free-tier model starts at
 * once; a confirm-tier model waits for the user's card unless this thread
 * already allowed it.
 */
import { OrchestratorMcpFailure, type ThreadId } from "@t3tools/contracts";
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
  const aios = yield* Effect.try({
    try: () => readAiosModelTiersNear(persona.specPath),
    catch: (error) =>
      new OrchestratorMcpFailure({
        code: "invalid_request",
        message: error instanceof Error ? error.message : String(error),
      }),
  });
  const tier = resolveSpawnTier({ model, appFreeModels, aios });
  if (tier.tier === "free") return;
  const approvals = yield* SpawnApprovals;
  const subagent = persona.spec.name;
  if (yield* approvals.isAllowedForThread({ threadId: parent.thread.id, subagent, model })) return;
  const outcome = yield* approvals.request({
    id: input.approvalId,
    threadId: parent.thread.id,
    threadTitle: parent.thread.title,
    subagent,
    model,
    account: input.account,
    reason: input.reason.trim().slice(0, 600),
    filesInScope: [...persona.spec.context],
    toolCount: persona.spec.tools.length,
    estimatedStartTokens: estimatePersonaStartTokens({
      systemPromptChars: persona.systemPrompt.length,
      tools: persona.spec.tools,
    }),
    tierSource: tier.source,
    goodFor: tier.goodFor,
    requestedAt: DateTime.formatIso(yield* DateTime.now),
  });
  switch (outcome.kind) {
    case "allow_once":
    case "allow_thread":
      return;
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
