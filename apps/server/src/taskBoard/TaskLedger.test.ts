import { describe, expect, it } from "@effect/vitest";

import { replyHeadOf, workedDraft } from "./TaskLedger.ts";

const input = {
  task: { id: "task-1", title: "Persist task identity", assignee: "ItzJsimp" },
  threadId: "thread-1",
  runId: "run-1",
  status: "completed",
  chatTitle: "Fix the login bug",
  agent: "claudeAgent",
  model: "claude-sonnet-5-5",
  startedAt: "2026-10-21T23:00:00Z",
  endedAt: "2026-10-21T23:30:00Z",
  git: { files: ["a.ts", "b.ts"], commits: ["abc1234 feat: x"] },
  replyHead: "Done.",
};

describe("workedDraft", () => {
  it("names chat, agent, model, user, files, commits and reply, keyed by run and card", () => {
    const draft = workedDraft(input);
    expect(draft).toMatchObject({
      type: "task.worked",
      level: "info",
      chat: "Fix the login bug",
      model: "claude-sonnet-5-5",
      actor: { kind: "agent", name: "claudeAgent", member: "ItzJsimp" },
      target: { thread: "thread-1", task: "task-1", files: ["a.ts", "b.ts"] },
      dedupe: "task.worked:run-1:task-1",
    });
    expect(draft.body).toContain("Commits: abc1234 feat: x.");
    expect(draft.body).toContain("Reply: Done.");
  });

  it("marks a failed run as failed and keeps long titles within 80 characters", () => {
    const draft = workedDraft({ ...input, status: "failed", chatTitle: "x".repeat(200) });
    expect(draft.level).toBe("failed");
    expect(draft.title.length).toBeLessThanOrEqual(80);
  });

  it("clips the reply head and drops empty replies", () => {
    expect(replyHeadOf("y".repeat(500))!.length).toBe(160);
    expect(replyHeadOf("  ")).toBeNull();
  });
});
