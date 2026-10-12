import { useEffect, useMemo, useRef, useState } from "react";
import type { EnvironmentId } from "@t3tools/contracts";
import {
  contextualPromptCandidates,
  predictPrompt,
  withModelPrediction,
  type PromptCandidate,
  type PromptPredictionMessage,
} from "@t3tools/shared/promptPrediction";
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";
import { connectionAtomRuntime } from "../../connection/runtime";
import { useAtomCommand } from "../../state/use-atom-command";
import { useAtomQueryRunner } from "../../state/use-atom-query-runner";
import { randomUUID } from "../../lib/utils";

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
const cancelPrediction = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:prompt-prediction-cancel",
  tag: WS_METHODS.projectsCancelPromptPrediction,
});

export function transcriptFor(messages: readonly PromptPredictionMessage[]) {
  return messages
    .filter(
      (message): message is PromptPredictionMessage & { role: "user" | "assistant" } =>
        message.role !== "system" && !message.streaming && message.text.trim().length > 0,
    )
    .slice(-6)
    .map((message) => ({
      role: message.role,
      text: message.role === "user" ? message.text.slice(0, 3_000) : message.text.slice(-3_000),
    }));
}

export function personalExamplesFor(
  history: readonly PromptCandidate[],
  local: readonly PromptCandidate[],
  draft: string,
) {
  const own = new Set(history.map((candidate) => candidate.text));
  const terms = new Set(
    (draft.toLowerCase().match(/[a-z0-9_]{3,}/g) ?? []).filter((word) => word.length > 3),
  );
  return local
    .filter(
      (candidate) =>
        own.has(candidate.text) &&
        !candidate.standard &&
        (terms.size === 0 ||
          [...terms].some((word) => candidate.text.toLowerCase().includes(word))),
    )
    .slice(0, 5)
    .map((candidate) => candidate.text.slice(0, 300));
}

export function usePromptPrediction(
  environmentId: EnvironmentId,
  cwd: string | null,
  messages: readonly PromptPredictionMessage[],
  running: boolean,
  options: {
    draft: string;
    focused: boolean;
    mode: "local" | "local-model" | "cloud";
    settingsIdentity?: string;
  },
) {
  const [result, setResult] = useState<{
    environmentId: EnvironmentId;
    cwd: string;
    candidates: readonly PromptCandidate[];
  } | null>(null);
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  const run = useAtomQueryRunner(query, { reportFailure: false, refresh: true });
  useEffect(() => {
    if (!cwd || !visible) return;
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
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
  }, [cwd, environmentId, run, visible]);

  const history =
    result?.environmentId === environmentId && result.cwd === cwd
      ? result.candidates
      : EMPTY_CANDIDATES;
  const draft = options.draft.slice(0, 2_000);
  const local = useMemo(
    () => contextualPromptCandidates(history, messages, draft),
    [history, messages, draft],
  );
  const transcriptKey = JSON.stringify(running ? [] : transcriptFor(messages));
  const transcript = useMemo(
    () => JSON.parse(transcriptKey) as ReturnType<typeof transcriptFor>,
    [transcriptKey],
  );
  const examplesKey = JSON.stringify(personalExamplesFor(history, local, draft));
  const examples = useMemo(() => JSON.parse(examplesKey) as string[], [examplesKey]);
  const key = JSON.stringify([
    environmentId,
    cwd,
    transcriptKey,
    draft,
    options.mode,
    options.settingsIdentity,
    examplesKey,
  ]);
  const sessionBase = useRef(randomUUID());
  const sequence = useRef(0);
  const attempted = useRef(new Set<string>());
  const lastCloudRequest = useRef(0);
  const predict = useAtomQueryRunner(predictQuery, { reportFailure: false, refresh: true });
  const cancel = useAtomCommand(cancelPrediction, { reportFailure: false, reportDefect: false });
  const [predicted, setPredicted] = useState<{ key: string; prompt: string | null } | null>(null);
  const eligible =
    Boolean(cwd) &&
    !running &&
    options.focused &&
    visible &&
    options.mode !== "local" &&
    transcript.at(-1)?.role === "assistant" &&
    !predictPrompt(local, draft);

  useEffect(() => {
    if (!eligible || !cwd || attempted.current.has(key)) return;
    let active = true;
    let requestSessionId: string | null = null;
    const cloudWait =
      options.mode === "cloud" ? Math.max(0, lastCloudRequest.current + 5_000 - Date.now()) : 0;
    const timer = window.setTimeout(
      async () => {
        if (!active) return;
        attempted.current.add(key);
        requestSessionId = `${sessionBase.current}:${++sequence.current}`;
        if (options.mode === "cloud") lastCloudRequest.current = Date.now();
        try {
          const value = await predict({
            environmentId,
            input: {
              cwd,
              messages: transcript,
              draft,
              personalExamples: examples,
              sessionId: requestSessionId,
            },
          });
          if (active)
            setPredicted({ key, prompt: value._tag === "Success" ? value.value.prompt : null });
        } catch {
          if (active) setPredicted({ key, prompt: null });
        }
      },
      Math.max(400, cloudWait),
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
      if (requestSessionId) void cancel({ environmentId, input: { sessionId: requestSessionId } });
    };
  }, [
    cancel,
    cwd,
    draft,
    eligible,
    environmentId,
    examples,
    key,
    options.mode,
    predict,
    transcript,
  ]);

  const modelPrompt = eligible && predicted?.key === key ? predicted.prompt : null;
  return cwd && !running ? withModelPrediction(local, modelPrompt) : EMPTY_CANDIDATES;
}
