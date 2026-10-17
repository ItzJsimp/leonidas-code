import { describe, expect, it } from "vite-plus/test";
import type { OrchestrationV2TurnItem } from "@t3tools/contracts";
import { deriveSkillUses } from "./skillUsage.ts";

// The projection supplies these envelope fields; these tests exercise persisted payloads.
const item = (ordinal: number, fields: Record<string, unknown>) =>
  ({ ordinal, runId: "run-1", status: "completed", ...fields }) as OrchestrationV2TurnItem;
const read = (ordinal: number, name: string, fields: Record<string, unknown> = {}) =>
  item(ordinal, {
    type: "dynamic_tool",
    toolName: "Read",
    input: { file_path: `.agents/skills/${name}/SKILL.md` },
    ...fields,
  });
const say = (ordinal: number, text: string, fields: Record<string, unknown> = {}) =>
  item(ordinal, { type: "assistant_message", text, ...fields });

describe("recorded skill use", () => {
  it("keeps manual and automatic use across runs and compaction, once per skill", () => {
    const uses = deriveSkillUses([
      item(1, { type: "user_message", text: "/design-build Create a screen" }),
      read(2, "design-build"),
      item(3, { type: "compaction", text: "Summary" }),
      read(4, "design-build", { runId: "run-2" }),
      say(5, "Using design-build: Build the new settings screen.", { runId: "run-2" }),
    ]);
    expect(uses).toEqual([
      {
        name: "design-build",
        origins: ["user", "agent"],
        path: ".agents/skills/design-build/SKILL.md",
        reason: "Build the new settings screen.",
      },
    ]);
  });

  it("recognizes currency skill tokens, namespaced names and structured chips", () => {
    expect(
      deriveSkillUses([
        item(1, {
          type: "user_message",
          text: "$vendor:research Investigate",
          context: { records: [{ kind: "skill", name: "tdd" }] },
        }),
        item(2, { type: "dynamic_tool", toolName: "Skill", input: { skill: "vendor:research" } }),
        read(3, "tdd"),
      ]).map(({ name, origins }) => ({ name, origins })),
    ).toEqual([
      { name: "vendor:research", origins: ["user"] },
      { name: "tdd", origins: ["user"] },
    ]);
  });

  it("does not count failed reads, edits, references, or announcements alone", () => {
    expect(
      deriveSkillUses([
        read(1, "a", { status: "failed" }),
        read(2, "b", { status: "running" }),
        read(3, "c", { toolName: "Edit" }),
        item(4, { type: "command_execution", input: "cat .agents/skills/d/SKILL.md", exitCode: 1 }),
        say(5, "Using missing: Not actually loaded."),
        read(6, "e", { input: { file_path: ".agents/skills/e/references/guide.md" } }),
        item(7, { type: "file_search", results: [{ fileName: ".agents/skills/f/SKILL.md" }] }),
      ]),
    ).toEqual([]);
  });

  it("records quoted Windows shell reads and provider file tools", () => {
    const path = "C:\\Work Space\\.agents\\skills\\design-build\\SKILL.md";
    expect(
      deriveSkillUses([
        item(1, { type: "command_execution", input: `Get-Content '${path}'` }),
        item(2, {
          type: "dynamic_tool",
          toolName: "functions.exec_command",
          input: { cmd: "cat .agents/skills/tdd/SKILL.md" },
        }),
        item(3, {
          type: "dynamic_tool",
          toolName: "mcp__files__read_file",
          input: { path: ".agents/skills/research/SKILL.md" },
        }),
      ]).map(({ name, path }) => ({ name, path })),
    ).toEqual([
      { name: "design-build", path },
      { name: "tdd", path: ".agents/skills/tdd/SKILL.md" },
      { name: "research", path: ".agents/skills/research/SKILL.md" },
    ]);
  });

  it("attaches reasons before or after a load without using another run's announcement", () => {
    expect(
      deriveSkillUses([
        say(1, "Using tdd: Verify the changed behavior."),
        read(2, "tdd"),
        say(3, "Using tdd: Unrelated declaration.", { runId: "other" }),
        say(4, "Using `research`: Check the primary sources."),
        read(5, "research"),
      ]).map(({ reason }) => reason),
    ).toEqual(["Verify the changed behavior.", "Check the primary sources."]);
  });

  it("resets manual intent after steering and orders by the persisted ordinal", () => {
    expect(
      deriveSkillUses([
        read(4, "research"),
        read(2, "tdd"),
        item(1, { type: "user_message", text: "$tdd Test this" }),
        item(3, { type: "user_message", text: "Research instead", inputIntent: "steer" }),
      ]).map(({ name, origins }) => ({ name, origins })),
    ).toEqual([
      { name: "tdd", origins: ["user"] },
      { name: "research", origins: ["agent"] },
    ]);
  });
});
