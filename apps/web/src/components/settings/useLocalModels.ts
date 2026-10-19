import {
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import type { LocalModelsState } from "@t3tools/contracts";
import { useCallback } from "react";

import { toastManager } from "~/components/ui/toast";
import { usePrimaryEnvironmentId } from "~/state/environments";
import {
  localModelsCancelPull,
  localModelsDelete,
  localModelsLive,
  localModelsPull,
  localModelsRun,
  localModelsSpeedTest,
  localModelsStartOllama,
  localModelsStop,
} from "~/state/localModels";
import { useEnvironmentQuery } from "~/state/query";
import { useAtomCommand } from "~/state/use-atom-command";

function unwrap<A, E>(result: AtomCommandResult<A, E>): A {
  if (result._tag === "Failure") throw squashAtomCommandFailure(result);
  return result.value;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Live Models tab state and its five actions. The subscription lives only while the tab is open. */
export function useLocalModels() {
  const environmentId = usePrimaryEnvironmentId();
  const live = useEnvironmentQuery(
    environmentId === null ? null : localModelsLive({ environmentId, input: {} }),
  );
  const state: LocalModelsState | null = live.data;

  const runPull = useAtomCommand(localModelsPull, { reportFailure: false });
  const runCancel = useAtomCommand(localModelsCancelPull, { reportFailure: false });
  const runRun = useAtomCommand(localModelsRun, { reportFailure: false });
  const runStop = useAtomCommand(localModelsStop, { reportFailure: false });
  const runSpeed = useAtomCommand(localModelsSpeedTest, { reportFailure: false });
  const runStart = useAtomCommand(localModelsStartOllama, { reportFailure: false });
  const runDelete = useAtomCommand(localModelsDelete, { reportFailure: false });

  const attempt = useCallback(async (title: string, action: () => Promise<unknown>) => {
    try {
      await action();
      return true;
    } catch (error) {
      toastManager.add({ type: "error", title, description: errorText(error) });
      return false;
    }
  }, []);

  const model = useCallback(
    (title: string, run: typeof runRun) => (id: string) =>
      attempt(title, async () => {
        if (environmentId === null) return;
        unwrap(await run({ environmentId, input: { model: id } }));
      }),
    [attempt, environmentId],
  );

  const pull = useCallback(
    (id: string, confirmed: boolean) =>
      attempt("Could not start the download", async () => {
        if (environmentId === null) return;
        unwrap(await runPull({ environmentId, input: { model: id, confirmed } }));
      }),
    [attempt, environmentId, runPull],
  );

  const startOllama = useCallback(
    () =>
      attempt("Could not start Ollama", async () => {
        if (environmentId === null) return;
        unwrap(await runStart({ environmentId, input: {} }));
      }),
    [attempt, environmentId, runStart],
  );

  return {
    state,
    startOllama,
    environmentId,
    error: live.error,
    isPending: live.isPending && state === null,
    pull,
    cancelPull: model("Could not cancel the download", runCancel),
    run: model("Could not load the model", runRun),
    stop: model("Could not unload the model", runStop),
    speedTest: model("The speed test failed", runSpeed),
    remove: model("Could not delete the model", runDelete),
  };
}
