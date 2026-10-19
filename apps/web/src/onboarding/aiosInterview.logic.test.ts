import { describe, expect, it } from "vite-plus/test";

import {
  INTERVIEW_QUESTIONS,
  answerFromChoices,
  answeredCount,
  choicesFromAnswer,
  defaultAnswers,
  buildAiosFiles,
  firstMissingRequired,
  planCreateOnly,
} from "./aiosInterview.logic";

describe("aiosInterview.logic", () => {
  it("asks eight questions and types only two", () => {
    expect(INTERVIEW_QUESTIONS).toHaveLength(8);
    expect(INTERVIEW_QUESTIONS.filter((q) => q.kind === "text").map((q) => q.id)).toEqual([
      "name",
      "projects",
    ]);
  });

  it("needs only a name before it can finish", () => {
    expect(firstMissingRequired({})?.id).toBe("name");
    expect(firstMissingRequired({ name: "  " })?.id).toBe("name");
    expect(firstMissingRequired({ name: "Sam" })).toBeNull();
  });

  it("starts with safe defaults selected", () => {
    const answers = defaultAnswers();
    expect(answers.style).toBe("Short and direct");
    expect(answers.avoid).toContain("- Spend money");
  });

  it("round-trips chips through the answer text", () => {
    const question = INTERVIEW_QUESTIONS.find((q) => q.id === "tools")!;
    const text = answerFromChoices(["Spreadsheets", "Notes and docs"]);
    expect(text).toBe("- Spreadsheets\n- Notes and docs");
    expect(choicesFromAnswer(question, text)).toEqual(["Spreadsheets", "Notes and docs"]);
    expect(answerFromChoices(["Morning"])).toBe("Morning");
  });

  it("counts only non-blank answers", () => {
    expect(answeredCount({ name: "Sam", work: " ", goal: "Ship" })).toBe(2);
  });

  it("writes answers into CLAUDE.md and skips empty sections", () => {
    const files = buildAiosFiles({ name: "Sam", work: "I build apps", avoid: "Delete files" });
    const claude = files.find((f) => f.relativePath === "CLAUDE.md")?.contents ?? "";
    expect(claude).toContain("# Sam");
    expect(claude).toContain("## Who I am\n\nI build apps");
    expect(claude).toContain("## Never do this\n\nDelete files");
    expect(claude).not.toContain("## Main goal");
  });

  it("makes one README per project and removes duplicates", () => {
    const files = buildAiosFiles({
      name: "Sam",
      work: "x",
      projects: "- Cool App\nCool App!\nSite",
    });
    const paths = files.map((f) => f.relativePath);
    expect(paths).toContain("projects/cool-app/README.md");
    expect(paths).toContain("projects/site/README.md");
    expect(paths.filter((p) => p === "projects/cool-app/README.md")).toHaveLength(1);
  });

  it("never plans a file that already exists", () => {
    const files = buildAiosFiles({ name: "Sam", work: "x" });
    const plan = planCreateOnly(files, ["CLAUDE.md", "memory\\README.md"]);
    expect(plan.skipped).toEqual(["CLAUDE.md", "memory/README.md"]);
    expect(plan.toCreate.map((f) => f.relativePath)).not.toContain("CLAUDE.md");
    expect(plan.toCreate.map((f) => f.relativePath)).toContain("AGENTS.md");
  });
});
