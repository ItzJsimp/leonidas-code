// @effect-diagnostics nodeBuiltinImport:off preferSchemaOverJson:off globalTimersInEffect:off
import { createHash } from "node:crypto";
import * as Effect from "effect/Effect";
import type { PromptSuggestionMessage } from "@t3tools/provider-core/server/textGeneration";
import type * as ServerSettings from "../serverSettings.ts";
import type { TextGeneration } from "../textGeneration/TextGeneration.ts";

export interface PromptSuggestionRequest {
  readonly cwd: string;
  readonly messages: ReadonlyArray<PromptSuggestionMessage>;
  readonly draft?: string;
  readonly personalExamples?: readonly string[];
  readonly sessionId?: string;
}

function bounded(request: PromptSuggestionRequest) {
  return {
    cwd: request.cwd,
    messages: request.messages
      .slice(-6)
      .map((message) => ({ role: message.role, text: message.text.slice(0, 3_000) })),
    draft: request.draft?.slice(0, 2_000) ?? "",
    personalExamples:
      request.personalExamples?.slice(0, 5).map((example) => example.slice(0, 300)) ?? [],
  };
}

function suggestionKey(request: PromptSuggestionRequest, mode = "local", model = "") {
  return createHash("sha256")
    .update(JSON.stringify([2, mode, model, bounded(request)]))
    .digest("hex");
}

function validate(prompt: string | null, draft: string): string | null {
  if (!prompt?.startsWith(draft)) return null;
  const suffix = prompt.slice(draft.length);
  if (!suffix || suffix.length > 280 || /[\r\n]|\.{3}|\u2026|\b(?:TBD|TODO)\b/i.test(suffix))
    return null;
  if ([...suffix.matchAll(/[.!?](?:\s|$)/g)].length > 2) return null;
  // The draft belongs to the user; inspect only the generated suffix.
  if (
    /\b(?:i(?:'ve| have)\s+(?:ran|tested|verified|checked|clicked|pressed|confirmed)|tests?\s+(?:passed|failed))\b/i.test(
      suffix,
    )
  )
    return null;
  return prompt;
}

export function make(
  textGeneration: TextGeneration["Service"],
  serverSettings: ServerSettings.ServerSettingsService["Service"],
  options: { fetch?: typeof fetch; now?: () => number } = {},
) {
  const fetcher = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const cache = new Map<string, string>();
  const sessions = new Map<string, AbortController>();
  const lastCloud = new Map<string, number>();
  let cloudActive = false;
  let cooldownUntil = 0;
  let windowStart = now();
  let cloudCount = 0;
  const cancelSession = (id: string) => {
    sessions.get(id)?.abort();
    sessions.delete(id);
  };

  return {
    cancel: (sessionId: string) => Effect.sync(() => cancelSession(sessionId)),
    predict: (raw: PromptSuggestionRequest) =>
      Effect.tryPromise({
        try: async (callerSignal) => {
          const request = bounded(raw);
          const settings = await Effect.runPromise(serverSettings.getSettings, {
            signal: callerSignal,
          });
          const mode = settings.promptPredictionMode ?? "local";
          const modelSelection =
            settings.promptPredictionModelSelection ?? settings.textGenerationModelSelection;
          const model =
            mode === "local-model"
              ? settings.promptPredictionLocalModel
              : JSON.stringify(modelSelection);
          const key = suggestionKey(raw, mode, model);
          if (raw.sessionId) cancelSession(raw.sessionId);
          if (!request.messages.length) return { prompt: null };
          const cached = cache.get(key);
          if (cached !== undefined) return { prompt: cached };
          if (mode === "local") {
            const match = request.personalExamples.find(
              (example) =>
                example.startsWith(request.draft) && example.length > request.draft.length,
            );
            return { prompt: match ? validate(match, request.draft) : null };
          }
          if (mode === "local-model" && !settings.promptPredictionLocalModel)
            return { prompt: null };
          if (mode === "cloud") {
            const time = now();
            if (time - windowStart >= 3_600_000) {
              windowStart = time;
              cloudCount = 0;
            }
            const limit = Math.min(
              120,
              Math.max(0, settings.promptPredictionCloudRequestLimit ?? 30),
            );
            if (
              cloudActive ||
              time < cooldownUntil ||
              cloudCount >= limit ||
              (raw.sessionId && time - (lastCloud.get(raw.sessionId) ?? -Infinity) < 5_000)
            )
              return { prompt: null };
            cloudActive = true;
            cloudCount++;
            if (raw.sessionId) {
              if (lastCloud.size >= 64) lastCloud.delete(lastCloud.keys().next().value!);
              lastCloud.set(raw.sessionId, time);
            }
          }
          const controller = new AbortController();
          const abort = () => controller.abort();
          callerSignal.addEventListener("abort", abort, { once: true });
          const timeout = setTimeout(abort, mode === "cloud" ? 5_000 : 3_000);
          if (raw.sessionId) {
            if (sessions.size >= 64) cancelSession(sessions.keys().next().value!);
            sessions.set(raw.sessionId, controller);
          }
          let failed = false;
          try {
            let prompt: string | null;
            if (mode === "local-model") {
              const response = await fetcher("http://127.0.0.1:11434/api/generate", {
                method: "POST",
                headers: { "content-type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                  model: settings.promptPredictionLocalModel,
                  stream: false,
                  think: false,
                  keep_alive: "5m",
                  options: { num_predict: 96 },
                  format: {
                    type: "object",
                    properties: { prompt: { type: "string" } },
                    required: ["prompt"],
                  },
                  prompt: JSON.stringify({
                    messages: request.messages,
                    draft: request.draft,
                    examples: request.personalExamples,
                    instruction:
                      "Continue the exact draft as a user request, at most two sentences and 280 added characters. Never invent completed actions. Return JSON {prompt:string}.",
                  }),
                }),
              });
              if (!response.ok) return { prompt: null };
              const output = (await response.json()) as { response?: string };
              prompt = JSON.parse(output.response ?? "null")?.prompt ?? null;
            } else {
              const generate = textGeneration.generatePromptSuggestion;
              if (!generate) return { prompt: null };
              const result = await Effect.runPromise(
                generate({
                  cwd: request.cwd,
                  messages: request.messages,
                  draft: request.draft,
                  personalExamples: request.personalExamples,
                  modelSelection,
                }),
                { signal: controller.signal },
              );
              prompt = result.prompt;
            }
            const accepted = validate(prompt, request.draft);
            if (accepted && !controller.signal.aborted) {
              if (cache.size >= 64) cache.delete(cache.keys().next().value!);
              cache.set(key, accepted);
            }
            return { prompt: controller.signal.aborted ? null : accepted };
          } catch {
            failed = !controller.signal.aborted;
            return { prompt: null };
          } finally {
            clearTimeout(timeout);
            callerSignal.removeEventListener("abort", abort);
            if (raw.sessionId && sessions.get(raw.sessionId) === controller)
              sessions.delete(raw.sessionId);
            if (mode === "cloud") {
              cloudActive = false;
              if (failed) cooldownUntil = now() + 30_000;
            }
          }
        },
        catch: () => "Prompt prediction unavailable" as const,
      }).pipe(Effect.orElseSucceed(() => ({ prompt: null }))),
  };
}
