import type { EnvironmentId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import { AtomRegistry } from "effect/reactivity";
import { appAtomRegistry } from "../../rpc/atomRegistry";
import { serverEnvironment } from "../../state/server";
import { selectHandoffPrompt } from "./turnHandoff";

/** Read on click, so an idle reminder does not poll saved prompts. */
export async function readHandoffPrompt(environmentId: EnvironmentId) {
  const result = await Effect.runPromise(
    AtomRegistry.getResult(
      appAtomRegistry,
      serverEnvironment.savedItems({ environmentId, input: { kind: "prompt", projectId: null } }),
      { suspendOnWaiting: true },
    ).pipe(Effect.timeout("10 seconds")),
  );
  return selectHandoffPrompt(result.items);
}
