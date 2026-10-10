import { describe, expect, it } from "vite-plus/test";

import { buildPromptSuggestionPrompt } from "./textGenerationPrompts.ts";
import { sanitizePromptSuggestion } from "./textGenerationUtils.ts";

describe("sanitizePromptSuggestion", () => {
  it("flattens to one plain line and strips quotes and markdown", () => {
    expect(sanitizePromptSuggestion('"Run the **focused** tests\n  in `auth.ts`."')).toBe(
      "Run the focused tests in auth.ts.",
    );
  });
  it("rejects empty, tiny and acknowledgement replies", () => {
    expect(sanitizePromptSuggestion("")).toBeNull();
    expect(sanitizePromptSuggestion("ok")).toBeNull();
    expect(sanitizePromptSuggestion("Sounds good!")).toBeNull();
  });
  it("rejects placeholders instead of offering an unfinished message", () => {
    for (const prompt of [
      'I clicked the composer and got "..." as the suggestion. tab accepted it without sending.',
      "Check the result: …",
      "The suggestion was [insert result here].",
      "Check <placeholder> next.",
      "Check {{result}} next.",
      "The result is TBD.",
    ])
      expect(sanitizePromptSuggestion(prompt)).toBeNull();
  });
  it("does not offer invented completed actions or test outcomes", () => {
    for (const prompt of [
      "I clicked the composer and Tab accepted it without sending.",
      "I've run the tests and they all passed.",
      "Tab inserted it without sending, and Ctrl+Z removed it.",
      "All tests passed with no errors.",
      "It worked correctly on my machine.",
    ])
      expect(sanitizePromptSuggestion(prompt)).toBeNull();
  });
  it("keeps requests to verify unknown outcomes", () => {
    for (const prompt of [
      "Can you check whether Tab accepts the suggestion without sending?",
      "Run the focused tests and check why the earlier tests failed.",
      "Help me verify Undo in the composer.",
      "I want to test the predictor next.",
    ])
      expect(sanitizePromptSuggestion(prompt)).toBe(prompt);
  });
  it("caps long replies at a sentence boundary", () => {
    const long = `${"Check the retry path for the token refresh. ".repeat(10)}`;
    const result = sanitizePromptSuggestion(long)!;
    expect(result.length).toBeLessThanOrEqual(280);
    expect(result.endsWith(".")).toBe(true);
  });
});

describe("buildPromptSuggestionPrompt", () => {
  it("keeps the newest turns in full and clips older ones", () => {
    const messages = [
      { role: "user" as const, text: "a".repeat(2_000) },
      { role: "assistant" as const, text: "b".repeat(2_000) },
      { role: "user" as const, text: "c".repeat(2_000) },
      { role: "assistant" as const, text: "d".repeat(2_000) },
    ];
    const { prompt } = buildPromptSuggestionPrompt({ messages });
    expect(prompt).toContain("c".repeat(2_000));
    expect(prompt).toContain("d".repeat(2_000));
    expect(prompt).not.toContain("a".repeat(2_000));
    expect(prompt).toContain("[assistant]");
  });
});
