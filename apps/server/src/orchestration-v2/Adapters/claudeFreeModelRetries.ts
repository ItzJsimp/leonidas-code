import type { OrchestrationV2AppThread } from "@t3tools/contracts";

/**
 * API retries for a delegated child on a free model. The CLI's default backs
 * off for about three minutes on a rate limit before failing; a delegated task
 * has a subscription fallback that answers in seconds, so failing fast wins.
 */
const DELEGATED_FREE_MODEL_MAX_RETRIES = "2";

/**
 * The environment for one Claude turn: delegated children on free models
 * retry only briefly, unless the instance already sets its own retry count.
 */
export function claudeTurnEnvironment(
  environment: NodeJS.ProcessEnv,
  input: { readonly model: string; readonly appThread: Pick<OrchestrationV2AppThread, "lineage"> },
): NodeJS.ProcessEnv {
  const freeModel = input.model.endsWith(":free") || input.model === "openrouter/free";
  if (
    !freeModel ||
    input.appThread.lineage.relationshipToParent !== "subagent" ||
    environment.CLAUDE_CODE_MAX_RETRIES !== undefined
  )
    return environment;
  return { ...environment, CLAUDE_CODE_MAX_RETRIES: DELEGATED_FREE_MODEL_MAX_RETRIES };
}
