import { describe, expect, it } from "vite-plus/test";
import { buildPromptCandidates, predictPrompt } from "./promptPrediction";

const row = (text: string, app = "claude.exe", lens = "agent") =>
  JSON.stringify({ cleaned_text: text, app, lens, mode: "dictation" });

describe("prompt prediction", () => {
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
