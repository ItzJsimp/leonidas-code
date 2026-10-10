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
