import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import type * as ProcessRunner from "../processRunner.ts";
import { gitRunSummary, replyHeadOf, workedDraft } from "./TaskLedger.ts";

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

describe("gitRunSummary", () => {
  // A fake Git: `status` lists what the folder shows, `log` lists no commits.
  const fakeGit = (status: string): ProcessRunner.ProcessRunner["Service"] => ({
    run: (input) =>
      Effect.succeed({
        stdout: input.args?.[0] === "status" ? status : "",
        stderr: "",
        code: 0 as never,
        timedOut: false,
        stdoutTruncated: false,
        stderrTruncated: false,
        stdoutInvalidUtf8: false,
        stderrInvalidUtf8: false,
      }),
  });

  it.effect("counts only files changed after the run started, not files already dirty", () =>
    Effect.gen(function* () {
      const dir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "ledger-"));
      NodeFS.mkdirSync(NodePath.join(dir, "tasks"));
      NodeFS.mkdirSync(NodePath.join(dir, "events"));
      for (const file of ["old.md", "tasks/old-card.md", "new.md", "events/2026-10.jsonl"]) {
        NodeFS.writeFileSync(NodePath.join(dir, file), "x");
      }
      const before = new Date("2026-01-01T00:00:00Z");
      NodeFS.utimesSync(NodePath.join(dir, "old.md"), before, before);
      NodeFS.utimesSync(NodePath.join(dir, "tasks/old-card.md"), before, before);
      const since = new Date(Date.now() - 60_000).toISOString();

      const summary = yield* gitRunSummary(
        fakeGit("?? old.md\n?? tasks/old-card.md\n?? new.md\n?? events/2026-10.jsonl\n"),
        dir,
        since,
      );

      // The app's own feed file is not the agent's work.
      expect(summary.files).toEqual(["new.md"]);
      NodeFS.rmSync(dir, { recursive: true, force: true });
    }),
  );
});
