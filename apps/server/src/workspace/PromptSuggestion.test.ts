import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { vi } from "vite-plus/test";

import * as PromptSuggestion from "./PromptSuggestion.ts";

const messages = [
  { role: "user" as const, text: "Fix the login bug" },
  { role: "assistant" as const, text: "Fixed the token refresh in auth.ts." },
];
const settings = {
  getSettings: Effect.succeed({
    textGenerationModelSelection: { instanceId: "codex", model: "m" },
  }),
} as never;

describe("PromptSuggestion", () => {
  it.effect("predicts once per chat state and serves repeats from cache", () =>
    Effect.gen(function* () {
      const generatePromptSuggestion = vi.fn(() =>
        Effect.succeed({ prompt: "Add a regression test for the token refresh." }),
      );
      const service = PromptSuggestion.make({ generatePromptSuggestion } as never, settings);
      const first = yield* service.predict({ cwd: "/p", messages });
      const second = yield* service.predict({ cwd: "/p", messages });
      expect(first.prompt).toBe("Add a regression test for the token refresh.");
      expect(second).toEqual(first);
      expect(generatePromptSuggestion).toHaveBeenCalledTimes(1);
    }),
  );
  it.effect("returns null on provider failure and retries next time", () =>
    Effect.gen(function* () {
      let calls = 0;
      const generatePromptSuggestion = vi.fn(() => {
        calls++;
        return calls === 1
          ? Effect.fail("quota" as const)
          : Effect.succeed({ prompt: "Run the focused tests." });
      });
      const service = PromptSuggestion.make({ generatePromptSuggestion } as never, settings);
      expect((yield* service.predict({ cwd: "/p", messages })).prompt).toBeNull();
      expect((yield* service.predict({ cwd: "/p", messages })).prompt).toBe(
        "Run the focused tests.",
      );
    }),
  );
  it.effect("skips the model for an empty chat", () =>
    Effect.gen(function* () {
      const generatePromptSuggestion = vi.fn();
      const service = PromptSuggestion.make({ generatePromptSuggestion } as never, settings);
      expect((yield* service.predict({ cwd: "/p", messages: [] })).prompt).toBeNull();
      expect(generatePromptSuggestion).not.toHaveBeenCalled();
    }),
  );
});
