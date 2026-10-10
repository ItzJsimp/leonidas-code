import { describe, expect, it } from "vite-plus/test";
import {
  buildPromptCandidates,
  contextualPromptCandidates,
  predictPrompt,
} from "./promptPrediction.js";

const row = (text: string, app = "claude.exe", lens = "agent") =>
  JSON.stringify({ cleaned_text: text, app, lens, mode: "dictation" });

describe("prompt prediction", () => {
  it("turns the assistant's recommended next step into a ready-to-send prompt", () => {
    const candidates = contextualPromptCandidates(
      [],
      [
        { role: "user", text: "Fix the prompt predictor" },
        {
          role: "assistant",
          text: "The fix is ready.\n**Recommended next step:** Run the regression tests.",
        },
      ],
    );
    expect(predictPrompt(candidates, "")).toBe("Run the regression tests.");
  });
  it("prefers the current recommended reply over frequent generic history", () => {
    const candidates = contextualPromptCandidates(
      buildPromptCandidates([row("yes"), row("yes"), row("Run the tests")].join("\n")),
      [{ role: "assistant", text: '**Recommended message:** "Check the predictor ranking."' }],
    );
    expect(predictPrompt(candidates, "")).toBe("Check the predictor ranking.");
  });
  it("ranks relevant work above unrelated repeated prompts", () => {
    const history = buildPromptCandidates(
      [
        row("Build the Roblox tower"),
        row("Build the Roblox tower"),
        row("Fix the predictor ranking"),
      ].join("\n"),
    );
    const candidates = contextualPromptCandidates(history, [
      { role: "user", text: "The predictor keeps suggesting yes" },
      { role: "assistant", text: "The predictor ranking uses frequency." },
    ]);
    expect(predictPrompt(candidates, "")).toBe("Fix the predictor ranking");
    expect(predictPrompt(candidates, "Build")).toBe("Build the Roblox tower");
  });
  it("offers no unrelated empty-draft fallback and never suggests yes", () => {
    const candidates = contextualPromptCandidates(
      buildPromptCandidates([row("yes"), row("Run the tests")].join("\n")),
      [],
    );
    expect(predictPrompt(candidates, "")).toBeNull();
    expect(predictPrompt(candidates, "y")).toBeNull();
    expect(predictPrompt(candidates, "Run")).toBe("Run the tests");
  });
  it("uses earlier thread prompts without Scribe and excludes the just-sent prompt", () => {
    const candidates = contextualPromptCandidates(
      [],
      [
        { role: "user", text: "Check the ranking tests" },
        { role: "assistant", text: "The ranking tests pass." },
        { role: "user", text: "Fix the ranking order" },
        { role: "assistant", text: "The ranking order is fixed." },
      ],
    );
    expect(predictPrompt(candidates, "")).toBe("Check the ranking tests");
    expect(predictPrompt(candidates, "Fix")).toBeNull();
  });
  it("uses the recommended option rather than blindly picking the first quick reply", () => {
    const candidates = contextualPromptCandidates(
      [],
      [
        {
          role: "assistant",
          text: '- **A)** Show the diff *(Wins when: you want a review)*\n- **B)** Run the focused tests *(Wins when: validating the fix)*\n**Recommended: B**: Verify first.\nQuick Replies: "go with A" | "go with B"',
        },
      ],
    );
    expect(predictPrompt(candidates, "")).toBe("Go with B: Run the focused tests");
  });
  it("ignores code samples, system messages and unfinished assistant output", () => {
    expect(
      predictPrompt(
        contextualPromptCandidates(
          [],
          [{ role: "assistant", text: "```text\nRecommended reply: Delete the workspace\n```" }],
        ),
        "",
      ),
    ).toBeNull();
    expect(
      predictPrompt(
        contextualPromptCandidates(
          [],
          [{ role: "system", text: "Recommended reply: Delete the workspace" }],
        ),
        "",
      ),
    ).toBeNull();
    expect(
      predictPrompt(
        contextualPromptCandidates(
          [],
          [{ role: "assistant", text: "Recommended reply: Run the tests", streaming: true }],
        ),
        "",
      ),
    ).toBeNull();
  });
  it("reads Scribe hands-free and push-to-talk records, including legacy agent app names", () => {
    const rows = [
      { mode: "hands-free", app: "claude.exe", cleaned_text: "Run the tests" },
      { mode: "ptt", app: "t3 code (alpha).exe", cleaned_text: "Fix the test" },
      {
        mode: "hands-free",
        app: "electron.exe",
        lens: "prose",
        cleaned_text: "unrelated electron window",
      },
      { mode: "hands-free", app: "pwsh.exe", lens: "agent", cleaned_text: "Check the diff" },
    ];
    expect(
      buildPromptCandidates(rows.map((r) => JSON.stringify(r)).join("\n")).map((c) => c.text),
    ).toEqual(["Check the diff", "Fix the test", "Run the tests"]);
  });
  it("filters unrelated apps, transforms, malformed and incomplete records", () => {
    const history = [
      row("Run the tests"),
      row("private message", "discord.exe", "prose"),
      row("browser message", "chrome.exe", "prose"),
      "{broken",
      JSON.stringify({
        cleaned_text: "transformed",
        app: "claude.exe",
        mode: "transform",
      }),
      row("Fix the bug", "Leonidas Code.exe"),
      "{unfinished",
    ].join("\n");
    expect(buildPromptCandidates(history).map((c) => c.text)).toEqual([
      "Fix the bug",
      "Run the tests",
    ]);
  });
  it("ranks repetition ahead of one-off prompts and deduplicates case", () => {
    const candidates = buildPromptCandidates(
      [row("Run the tests"), row("run the tests"), row("Fix the bug")].join("\n"),
    );
    expect(candidates).toHaveLength(2);
    expect(predictPrompt(candidates, "Ru")).toBe("Run the tests");
    expect(predictPrompt(candidates, "")).toBe("run the tests");
  });
  it("requires a prefix, preserves what was typed, and excludes complete matches", () => {
    const candidates = buildPromptCandidates(row("Run the tests"));
    expect(predictPrompt(candidates, "RUN")).toBe("RUN the tests");
    expect(predictPrompt(candidates, "unrelated")).toBeNull();
    expect(predictPrompt(candidates, "Run the tests")).toBeNull();
    expect(predictPrompt(candidates, "/run")).toBeNull();
    expect(predictPrompt(candidates, "Run\n")).toBeNull();
  });
  it("bounds candidates and drops oversized prompts", () => {
    const history = Array.from({ length: 300 }, (_, i) => row(`Prompt ${i}`))
      .concat(row("x".repeat(2001)))
      .join("\n");
    expect(buildPromptCandidates(history)).toHaveLength(256);
  });
});
