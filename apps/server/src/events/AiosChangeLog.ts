// @effect-diagnostics nodeBuiltinImport:off - maps checkpoint paths into the AIOS folder.
import type { FeedEventDraft, ThreadId } from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import * as Orchestrator from "../orchestration-v2/Orchestrator.ts";
import * as ProjectionStore from "../orchestration-v2/ProjectionStore.ts";
import * as ProjectService from "../project/ProjectService.ts";
import { forkParked } from "../serverActivation.ts";
import { TaskBoardService } from "../taskBoard/TaskBoardService.ts";
import { appendDraft } from "./eventsRpc.ts";

const MAX_FILES = 50;
const MAX_TITLE = 80;

/**
 * True when `cwd` is inside a Git repo nested in the AIOS, such as a code project under
 * `projects/`. Turns there change code, not the AIOS, so they write no `aios.changed` event.
 */
export function inNestedRepo(aiosRoot: string, cwd: string): boolean {
  const path = aiosRoot.includes("\\") ? NodePath.win32 : NodePath.posix;
  for (let dir = cwd; ; dir = path.dirname(dir)) {
    const relative = path.relative(aiosRoot, dir);
    if (relative === "" || relative.startsWith("..") || path.dirname(dir) === dir) return false;
    if (NodeFS.existsSync(path.join(dir, ".git"))) return true;
  }
}

/**
 * The `aios.changed` event for one finished agent turn: every changed file inside the AIOS, as
 * AIOS-relative paths. Null when the turn changed nothing there.
 */
export function aiosChangedDraft(input: {
  readonly aiosRoot: string;
  /** The folder the checkpoint paths are relative to. */
  readonly cwd: string;
  readonly threadId: string;
  readonly runId: string;
  readonly files: ReadonlyArray<string>;
}): FeedEventDraft | null {
  // The root decides the path style, so a Windows AIOS maps the same on every host.
  const path = input.aiosRoot.includes("\\") ? NodePath.win32 : NodePath.posix;
  const prefix = path.relative(input.aiosRoot, input.cwd).replaceAll("\\", "/");
  if (prefix.startsWith("..") || path.isAbsolute(prefix)) return null;
  const files = input.files
    .map((file) => [prefix, file.replaceAll("\\", "/")].filter((part) => part !== "").join("/"))
    // The app appends to its own feed during a turn: that is not the agent's work.
    .filter((file) => !file.startsWith("events/"));
  if (files.length === 0) return null;

  const folders = [...new Set(files.map((file) => file.split("/")[0]!))];
  const count = `${files.length} ${files.length === 1 ? "file" : "files"}`;
  let title = `Leonidas updated ${count} in ${joinNames(folders)}`;
  for (let shown = folders.length - 1; title.length > MAX_TITLE && shown > 0; shown--) {
    title = `Leonidas updated ${count} in ${folders.slice(0, shown).join(", ")} and more`;
  }
  return {
    level: "info",
    type: "aios.changed",
    title: title.slice(0, MAX_TITLE),
    actor: { kind: "agent", name: "Leonidas" },
    target: { files: files.slice(0, MAX_FILES), thread: input.threadId },
    actions: [{ label: "Open chat", kind: "open_thread", ref: input.threadId }],
    // Capture is at-least-once; a repeat folds into the same event.
    dedupe: `aios.changed:${input.runId}`,
  };
}

const joinNames = (names: ReadonlyArray<string>) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

/** Writes one `aios.changed` event after each agent turn that changed AIOS files. */
export const make = Effect.gen(function* () {
  const orchestrator = yield* Orchestrator.OrchestratorV2;
  const projections = yield* ProjectionStore.ProjectionStoreV2;
  const projectService = yield* ProjectService.ProjectService;
  const taskBoard = yield* TaskBoardService;
  const written = new Set<string>();

  const log = (checkpoint: {
    readonly threadId: ThreadId;
    readonly runId: string;
    readonly files: ReadonlyArray<{ readonly path: string }>;
  }) =>
    Effect.gen(function* () {
      if (written.has(checkpoint.runId) || checkpoint.files.length === 0) return;
      const shell = yield* projections.getThreadShell(checkpoint.threadId);
      if (!shell) return;
      const projects = (yield* projectService.snapshot).projects;
      const project = projects.find((item) => item.id === shell.projectId);
      const aiosRoot = yield* taskBoard.aiosRoot(projects);
      const cwd = shell.worktreePath ?? project?.workspaceRoot;
      if (aiosRoot === null || cwd === undefined || inNestedRepo(aiosRoot, cwd)) return;
      const draft = aiosChangedDraft({
        aiosRoot,
        cwd,
        threadId: checkpoint.threadId,
        runId: checkpoint.runId,
        files: checkpoint.files.map((file) => file.path),
      });
      if (draft === null) return;
      yield* appendDraft(aiosRoot, draft);
      written.add(checkpoint.runId);
      // shortcut: the repeat guard is in memory; after a restart the dedupe key folds a repeat.
      if (written.size > 500) written.delete(written.values().next().value!);
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.logWarning("aios.changed event skipped", { cause: Cause.pretty(cause) }),
      ),
    );

  const start = Effect.fn("AiosChangeLog.start")(function* () {
    yield* forkParked(
      Stream.runForEach(orchestrator.streamDomainEvents, (event) =>
        event.type === "checkpoint.captured" && event.payload.runId !== null
          ? log({
              threadId: event.payload.threadId,
              runId: event.payload.runId,
              files: event.payload.files,
            })
          : Effect.void,
      ),
    );
  });

  return { start };
});
