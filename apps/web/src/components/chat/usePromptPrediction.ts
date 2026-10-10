import { useEffect, useMemo, useState } from "react";
import type { EnvironmentId } from "@t3tools/contracts";
import {
  contextualPromptCandidates,
  withModelPrediction,
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

const predictQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:prompt-prediction-model",
  tag: WS_METHODS.projectsPredictPrompt,
  staleTimeMs: 0,
  idleTtlMs: 60_000,
});

const PREDICT_DEBOUNCE_MS = 600;

/** Finished user and assistant turns only; the request is the whole chat state, not a draft. */
function transcriptFor(messages: readonly PromptPredictionMessage[]) {
  return messages
    .filter(
      (message): message is PromptPredictionMessage & { role: "user" | "assistant" } =>
        message.role !== "system" && !message.streaming && message.text.trim().length > 0,
    )
    .slice(-12)
    .map((message) => ({ role: message.role, text: message.text.slice(-6_000) }));
}

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
  const predict = useAtomQueryRunner(predictQuery, { reportFailure: false, refresh: true });
  const [predicted, setPredicted] = useState<{ key: string; prompt: string | null } | null>(null);
  const transcript = useMemo(() => transcriptFor(messages), [messages]);
  const transcriptKey = useMemo(
    () => `${environmentId}|${cwd}|${JSON.stringify(transcript)}`,
    [environmentId, cwd, transcript],
  );
  useEffect(() => {
    // Predict once per settled chat state: the last finished message must be the assistant's.
    if (!cwd || running || transcript.at(-1)?.role !== "assistant") return;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const value = await predict({ environmentId, input: { cwd, messages: transcript } });
        if (active && value._tag === "Success")
          setPredicted({ key: transcriptKey, prompt: value.value.prompt });
      } catch {
        // Prediction is optional; the recommendation and prefix completion still work.
      }
    }, PREDICT_DEBOUNCE_MS);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [cwd, environmentId, predict, running, transcript, transcriptKey]);
  const modelPrompt = predicted?.key === transcriptKey ? predicted.prompt : null;
  const history =
    result?.environmentId === environmentId && result.cwd === cwd
      ? result.candidates
      : EMPTY_CANDIDATES;
  return useMemo(
    () =>
      cwd && !running
        ? withModelPrediction(contextualPromptCandidates(history, messages), modelPrompt)
        : EMPTY_CANDIDATES,
    [cwd, running, history, messages, modelPrompt],
  );
}
