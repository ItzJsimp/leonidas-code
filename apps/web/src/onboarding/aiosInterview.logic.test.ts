import { describe, expect, it } from "vitest";

import {
  INTERVIEW_QUESTIONS,
  answeredCount,
  buildAiosFiles,
  firstMissingRequired,
  planCreateOnly,
} from "./aiosInterview.logic";

describe("aiosInterview.logic", () => {
  it("asks eight questions", () => {
    expect(INTERVIEW_QUESTIONS).toHaveLength(8);
  });

  it("needs a name and work before it can finish", () => {
    expect(firstMissingRequired({})?.id).toBe("name");
    expect(firstMissingRequired({ name: "Sam", work: "  " })?.id).toBe("work");
    expect(firstMissingRequired({ name: "Sam", work: "Design" })).toBeNull();
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
