import * as Effect from "effect/Effect";
import type { PromptSuggestionMessage } from "@t3tools/provider-core/server/textGeneration";

import type * as ServerSettings from "../serverSettings.ts";
import type { TextGeneration } from "../textGeneration/TextGeneration.ts";

const MAX_CACHE = 64;
const TIMEOUT = "25 seconds";

export interface PromptSuggestionRequest {
  readonly cwd: string;
  readonly messages: ReadonlyArray<PromptSuggestionMessage>;
}

/** Cheap stable key over the part of the chat that determines the prediction. */
export function suggestionKey(request: PromptSuggestionRequest) {
  const tail = request.messages.slice(-12);
  return `${request.cwd}\n${tail.map((m) => `${m.role}:${m.text.length}:${m.text.slice(-200)}`).join("\n")}`;
}

/**
 * Model-backed next-prompt prediction. Failures and "no confident prediction" both resolve to
 * null so typing never waits on, or is blocked by, the text-generation provider.
 */
export function make(
  textGeneration: TextGeneration["Service"],
  serverSettings: ServerSettings.ServerSettingsService["Service"],
) {
  const cache = new Map<string, string | null>();
  const pending = new Map<string, Promise<string | null | undefined>>();
  const compute = (request: PromptSuggestionRequest) =>
    Effect.gen(function* () {
      const settings = yield* serverSettings.getSettings;
      const generate = textGeneration.generatePromptSuggestion;
      if (!generate) return null;
      const result = yield* generate({
        cwd: request.cwd,
        messages: request.messages,
        modelSelection: settings.textGenerationModelSelection,
      }).pipe(Effect.timeout(TIMEOUT));
      return result.prompt;
    }).pipe(Effect.catch(() => Effect.succeed(undefined)));
  return {
    predict: (request: PromptSuggestionRequest) =>
      Effect.promise(async (): Promise<{ prompt: string | null }> => {
        if (request.messages.length === 0) return { prompt: null };
        const key = suggestionKey(request);
        if (cache.has(key)) return { prompt: cache.get(key) ?? null };
        let flight = pending.get(key);
        if (!flight) {
          flight = Effect.runPromise(compute(request))
            .then((prompt) => {
              // Failures are not cached: a provider outage should not silence the next turn.
              if (prompt === undefined) return undefined;
              if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
              cache.set(key, prompt);
              return prompt;
            })
            .finally(() => pending.delete(key));
          pending.set(key, flight);
        }
        return { prompt: (await flight) ?? null };
      }),
  };
}
