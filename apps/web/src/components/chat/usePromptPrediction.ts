import { useEffect, useMemo, useState } from "react";
import type { EnvironmentId } from "@t3tools/contracts";
import {
  contextualPromptCandidates,
  type PromptCandidate,
  type PromptPredictionMessage,
} from "@t3tools/shared/promptPrediction";
import { createEnvironmentRpcQueryAtomFamily } from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";
import { connectionAtomRuntime } from "../../connection/runtime";
import { useAtomQueryRunner } from "../../state/use-atom-query-runner";

const EMPTY_CANDIDATES: readonly PromptCandidate[] = [];

const query = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:prompt-prediction",
  tag: WS_METHODS.projectsPromptCandidates,
  staleTimeMs: 30_000,
  idleTtlMs: 60_000,
});

export function usePromptPrediction(
  environmentId: EnvironmentId,
  cwd: string | null,
  messages: readonly PromptPredictionMessage[],
  running: boolean,
) {
  const [result, setResult] = useState<{
    environmentId: EnvironmentId;
    cwd: string;
    candidates: readonly PromptCandidate[];
  } | null>(null);
  const run = useAtomQueryRunner(query, { reportFailure: false, refresh: true });
  useEffect(() => {
    if (!cwd) return;
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const value = await run({ environmentId, input: { cwd } });
        if (active)
          setResult({
            environmentId,
            cwd,
            candidates: value._tag === "Success" ? value.value : [],
          });
      } catch {
        if (active) setResult({ environmentId, cwd, candidates: [] });
      } finally {
        pending = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [cwd, environmentId, run]);
  const history =
    result?.environmentId === environmentId && result.cwd === cwd
      ? result.candidates
      : EMPTY_CANDIDATES;
  return useMemo(
    () => (cwd && !running ? contextualPromptCandidates(history, messages) : EMPTY_CANDIDATES),
    [cwd, running, history, messages],
  );
}
