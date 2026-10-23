import type { FeedEventDraft, TaskBoardTask } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import type * as ProcessRunner from "../processRunner.ts";

const MAX_FILES = 50;
const MAX_COMMITS = 5;
const MAX_TITLE = 80;
const MAX_BODY = 500;
const REPLY_HEAD = 160;

export interface RunGitSummary {
  readonly files: ReadonlyArray<string>;
  readonly commits: ReadonlyArray<string>;
}

export interface WorkedInput {
  readonly task: Pick<TaskBoardTask, "id" | "title" | "assignee">;
  readonly threadId: string;
  readonly runId: string;
  readonly status: string;
  readonly chatTitle: string;
  readonly agent: string;
  readonly model: string;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly git: RunGitSummary;
  readonly replyHead: string | null;
}

const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

const time = (iso: string | null) =>
  iso === null ? "unknown" : iso.slice(0, 16).replace("T", " ");

/** One Task ledger entry (ADR-0090): what one chat did on one card in one run. */
export function workedDraft(input: WorkedInput): FeedEventDraft {
  const { git } = input;
  const lines = [
    `Run ${input.status}, ${time(input.startedAt)} to ${time(input.endedAt)} UTC.`,
    `Files changed: ${git.files.length}.`,
    ...(git.commits.length > 0
      ? [`Commits: ${git.commits.slice(0, MAX_COMMITS).join("; ")}.`]
      : []),
    ...(input.replyHead ? [`Reply: ${input.replyHead.replace(/\s+/g, " ").trim()}`] : []),
  ];
  return {
    level: input.status === "failed" ? "failed" : "info",
    type: "task.worked",
    title: clip(`${input.chatTitle} worked on ${input.task.title}`, MAX_TITLE),
    actor: {
      kind: "agent",
      name: input.agent,
      ...(input.task.assignee ? { member: input.task.assignee } : {}),
    },
    chat: input.chatTitle,
    model: input.model,
    body: clip(lines.join(" "), MAX_BODY),
    target: {
      thread: input.threadId,
      task: input.task.id,
      ...(git.files.length > 0 ? { files: git.files.slice(0, MAX_FILES) } : {}),
    },
    // A replay of the same run on the same card folds into one entry.
    dedupe: `task.worked:${input.runId}:${input.task.id}`,
  };
}

export const replyHeadOf = (text: string | undefined) =>
  text === undefined || text.trim() === "" ? null : clip(text.trim(), REPLY_HEAD);

/**
 * Files and commits the run left in its worktree: commits since the run started plus uncommitted
 * changes. Empty on any Git failure, so the ledger entry is never blocked by a missing repo.
 */
export const gitRunSummary = (
  runner: ProcessRunner.ProcessRunner["Service"],
  cwd: string,
  since: string | null,
): Effect.Effect<RunGitSummary> => {
  const git = (args: ReadonlyArray<string>) =>
    runner
      .run({ command: "git", args, cwd, timeout: "10 seconds", maxOutputBytes: 256 * 1024 })
      .pipe(
        Effect.map((out) => (out.code === 0 ? out.stdout : "")),
        Effect.orElseSucceed(() => ""),
      );
  const lines = (text: string) => text.split(/\r?\n/).filter((line) => line !== "");
  return Effect.gen(function* () {
    const sinceArgs = since === null ? [] : [`--since=${since}`];
    const logged =
      since === null
        ? []
        : lines(yield* git(["log", ...sinceArgs, "--pretty=format:@%h %s", "--name-only"]));
    const status = lines(yield* git(["status", "--porcelain"]));
    const commits = logged.filter((line) => line.startsWith("@")).map((line) => line.slice(1));
    const files = new Set([
      ...logged.filter((line) => !line.startsWith("@")),
      ...status.map((line) => line.slice(3)),
    ]);
    return { files: [...files], commits };
  });
};
