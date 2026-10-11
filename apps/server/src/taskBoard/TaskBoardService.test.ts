// @effect-diagnostics nodeBuiltinImport:off
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeOS from "node:os";
import { Project as ProjectSchema, ProjectId, type TaskBoardAgent } from "@t3tools/contracts";
import * as ProcessRunner from "../processRunner.ts";
import * as TaskBoardService from "./TaskBoardService.ts";

type FakeDatabase = { version: 1; tasks: Array<Record<string, unknown>> };

const output = (stdout: string, code = 0, stderr = ""): ProcessRunner.ProcessRunOutput => ({
  stdout,
  stderr,
  code: code as ProcessRunner.ProcessRunOutput["code"],
  timedOut: false,
  stdoutTruncated: false,
  stderrTruncated: false,
  stdoutInvalidUtf8: false,
  stderrInvalidUtf8: false,
});

const project = Schema.decodeUnknownSync(ProjectSchema)({
  id: ProjectId.make("project-leonidas-code"),
  title: "Leonidas Code",
  workspaceRoot: "D:/Leonidas AIOS/projects/leonidas-code",
  repositoryIdentity: {
    canonicalKey: "github.com/pingdotgg/t3code",
    locator: {
      source: "git-remote",
      remoteName: "upstream",
      remoteUrl: "https://github.com/pingdotgg/t3code.git",
    },
    provider: "github",
    owner: "pingdotgg",
    name: "t3code",
    origin: {
      canonicalKey: "github.com/ItzJsimp/leonidas-code",
      displayName: "ItzJsimp/leonidas-code",
    },
  },
  defaultModelSelection: null,
  scripts: [],
  createdAt: "2026-10-11T00:00:00.000Z",
  updatedAt: "2026-10-11T00:00:00.000Z",
  deletedAt: null,
});

class FakeGithub {
  database: FakeDatabase | null = null;
  sha = "sha-0";
  issues = output("[]");
  private writeVersion = 0;
  private nextWriteConflict: ((current: FakeDatabase) => FakeDatabase) | undefined;

  readonly runner = ProcessRunner.ProcessRunner.of({
    run: (input) => Effect.sync(() => this.invoke(input.args)),
  });

  conflictNextWrite(change: (database: FakeDatabase) => FakeDatabase) {
    this.nextWriteConflict = change;
  }

  private invoke(args: ReadonlyArray<string>): ProcessRunner.ProcessRunOutput {
    if (args[0] === "issue" && args[1] === "list") return this.issues;

    const endpoint = args.find((arg) => arg.startsWith("repos/ItzJsimp/leonidas-code/")) ?? "";
    if (endpoint.includes("matching-refs/heads/")) {
      const branch = endpoint.split("matching-refs/heads/")[1];
      return output(JSON.stringify([{ ref: `refs/heads/${branch}` }]));
    }

    if (
      args[1] === "--method" &&
      args[2] === "PUT" &&
      endpoint.includes("contents/.leonidas/task-board/")
    ) {
      if (this.nextWriteConflict) {
        const change = this.nextWriteConflict;
        this.nextWriteConflict = undefined;
        if (this.database) this.database = change(this.database);
        this.writeVersion++;
        this.sha = `sha-${this.writeVersion}`;
        return output("", 1, "HTTP 409 sha does not match");
      }

      const expected = args.find((arg) => arg.startsWith("sha="))?.slice(4) ?? null;
      if (
        (expected !== null && expected !== this.sha) ||
        (expected === null && this.database !== null)
      ) {
        return output("", 1, "HTTP 409 sha does not match");
      }
      const content = args.find((arg) => arg.startsWith("content="))?.slice("content=".length);
      if (!content) return output("", 1, "Missing content");
      this.database = JSON.parse(Buffer.from(content, "base64").toString("utf8")) as FakeDatabase;
      this.writeVersion++;
      this.sha = `sha-${this.writeVersion}`;
      return output("{}");
    }

    if (endpoint.includes("contents/.leonidas/task-board/")) {
      if (!this.database) return output("", 1, "HTTP 404 Not Found");
      return output(
        JSON.stringify({
          content: Buffer.from(JSON.stringify(this.database)).toString("base64"),
          sha: this.sha,
        }),
      );
    }

    throw new Error(`Unexpected gh call: ${args.join(" ")}`);
  }
}

const layerFor = (github: FakeGithub) =>
  TaskBoardService.layer.pipe(
    Layer.provide(Layer.succeed(ProcessRunner.ProcessRunner, github.runner)),
  );

const agent = (threadId: string, model = "gemini-3.8-flash-medium"): TaskBoardAgent => ({
  providerInstanceId: "antigravity_gemini",
  model,
  options: [{ id: "thinkingLevel", value: "medium" }],
  threadId,
});

it.effect("uses the project's own fork as the shared task-board identity", () => {
  const github = new FakeGithub();
  return Effect.gen(function* () {
    const board = yield* TaskBoardService.TaskBoardService;
    const snapshot = yield* board.list(project);
    expect(snapshot.repository).toBe("ItzJsimp/leonidas-code");
  }).pipe(Effect.provide(layerFor(github)));
});

it.effect("persists shared claims and a durable agent work history", () => {
  const github = new FakeGithub();
  return Effect.gen(function* () {
    const board = yield* TaskBoardService.TaskBoardService;
    const created = yield* board.create(project, {
      title: "Add shared claims",
      description: "Prevent Jake and Mob from duplicating work.",
      priority: "high",
      actor: "Jake",
    });
    const claimed = yield* board.claim(project, {
      taskId: created.id,
      actor: "Jake",
      agent: agent("thread-jake"),
    });
    const blocked = yield* board.update(project, {
      taskId: created.id,
      actor: "Jake",
      agent: agent("thread-jake"),
      status: "blocked",
      note: "Waiting for the shared database API.",
    });
    expect(claimed.claimedAgent).toMatchObject({
      providerInstanceId: "antigravity_gemini",
      model: "gemini-3.8-flash-medium",
      threadId: "thread-jake",
    });
    expect(blocked.history.at(-1)).toMatchObject({
      action: "blocked",
      actor: "Jake",
      note: "Waiting for the shared database API.",
      agent: { model: "gemini-3.8-flash-medium", threadId: "thread-jake" },
    });

    const conflict = yield* Effect.result(
      board.claim(project, {
        taskId: created.id,
        actor: "Mob",
        agent: agent("thread-mob", "claude-sonnet"),
      }),
    );
    expect(conflict._tag).toBe("Failure");
    if (conflict._tag === "Failure") expect(conflict.failure.reason).toBe("already_claimed");

    const released = yield* board.release(project, {
      taskId: created.id,
      actor: "Jake",
      agent: agent("thread-jake"),
    });
    expect(released.status).toBe("todo");
    const claimedByMob = yield* board.claim(project, {
      taskId: created.id,
      actor: "Mob",
      agent: agent("thread-mob", "claude-sonnet"),
    });
    const completed = yield* board.complete(project, {
      taskId: created.id,
      actor: "Mob",
      agent: agent("thread-mob", "claude-sonnet"),
      summary: "Shared claims are now serialized and logged.",
    });
    const persisted = yield* board.list(project);
    expect(persisted.repository).toBe("ItzJsimp/leonidas-code");
    expect(claimedByMob.claimedBy).toBe("Mob");
    expect(completed.completedBy).toBe("Mob");
    expect(completed.completionSummary).toBe("Shared claims are now serialized and logged.");
    expect(completed.history.map((event) => event.action)).toEqual([
      "created",
      "claimed",
      "blocked",
      "released",
      "claimed",
      "completed",
    ]);
    expect(completed.history.at(-1)?.agent).toMatchObject({
      providerInstanceId: "antigravity_gemini",
      model: "claude-sonnet",
      threadId: "thread-mob",
    });
    expect(persisted.tasks).toContainEqual(completed);
  }).pipe(Effect.provide(layerFor(github)));
});

it.effect("retries a compare-and-swap conflict without overwriting the other agent's claim", () => {
  const github = new FakeGithub();
  return Effect.gen(function* () {
    const board = yield* TaskBoardService.TaskBoardService;
    const created = yield* board.create(project, { title: "Concurrent claim", actor: "Jake" });
    github.conflictNextWrite((database) => ({
      ...database,
      tasks: database.tasks.map((task) =>
        task.id === created.id
          ? {
              ...task,
              status: "in_progress",
              claimedBy: "Mob",
              claimedAt: 1_791_696_000_000,
              claimedAgent: agent("mob-thread", "claude-sonnet"),
            }
          : task,
      ),
    }));

    const result = yield* Effect.result(
      board.claim(project, {
        taskId: created.id,
        actor: "Jake",
        agent: agent("jake-thread"),
      }),
    );
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") expect(result.failure.reason).toBe("already_claimed");

    const persisted = yield* board.list(project);
    expect(persisted.tasks[0]).toMatchObject({
      id: created.id,
      claimedBy: "Mob",
      claimedAgent: { model: "claude-sonnet", threadId: "mob-thread" },
    });
  }).pipe(Effect.provide(layerFor(github)));
});

it.effect(
  "imports only matching AIOS cards and writes shared changes back to that environment",
  () => {
    const github = new FakeGithub();
    const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "task-board-sync-"));
    const tasksPath = NodePath.join(root, "tasks");
    NodeFS.mkdirSync(tasksPath);
    NodeFS.writeFileSync(
      NodePath.join(tasksPath, "leonidas.md"),
      [
        "---",
        "type: task",
        "id: 0012",
        'name: "Build shared task claims"',
        "status: Not started",
        "accountable: Leonidas",
        "priority: High",
        "project: leonidas-code",
        "---",
        "Acceptance criteria stay in the shared project task.",
      ].join("\n"),
    );
    NodeFS.writeFileSync(
      NodePath.join(tasksPath, "other-project.md"),
      [
        "---",
        "type: task",
        "name: Other work",
        "project: clean-the-goo",
        "---",
        "Wrong board.",
      ].join("\n"),
    );
    const previousRoot = process.env.LEONIDAS_AIOS_ROOT;
    process.env.LEONIDAS_AIOS_ROOT = root;

    return Effect.gen(function* () {
      try {
        const board = yield* TaskBoardService.TaskBoardService;
        const snapshot = yield* board.sync(project, { actor: "Jake" });
        expect(snapshot.tasks).toHaveLength(1);
        expect(snapshot.tasks[0]).toMatchObject({
          title: "Build shared task claims",
          source: "aios_card",
          sourceFile: "leonidas.md",
          priority: "high",
          history: [{ actor: "Jake", action: "imported" }],
        });
        const task = snapshot.tasks[0]!;
        yield* board.claim(project, {
          taskId: task.id,
          actor: "Jake",
          agent: agent("jake-thread"),
        });
        yield* board.sync(project, { actor: "Jake" });
        const linkedCard = NodeFS.readFileSync(NodePath.join(tasksPath, "leonidas.md"), "utf8");
        expect(linkedCard).toContain(`task_board_id: "${task.id}"`);
        expect(linkedCard).toContain('status: "In progress"');
        expect(linkedCard).toContain('accountable: "Leonidas"');
        expect(NodeFS.readFileSync(NodePath.join(tasksPath, "other-project.md"), "utf8")).toContain(
          "Other work",
        );

        // A status edit made in the card since the board last wrote it is adopted on the next sync.
        NodeFS.writeFileSync(
          NodePath.join(tasksPath, "leonidas.md"),
          linkedCard.replace('status: "In progress"', 'status: "Done"'),
        );
        const adopted = yield* board.sync(project, { actor: "Jake" });
        expect(adopted.tasks[0]).toMatchObject({
          status: "done",
          completedBy: "Jake",
          claimedBy: null,
        });
        expect(adopted.tasks[0]?.history.at(-1)).toMatchObject({
          action: "completed",
          actor: "Jake",
          note: "Edited in the AIOS card",
        });
      } finally {
        if (previousRoot === undefined) delete process.env.LEONIDAS_AIOS_ROOT;
        else process.env.LEONIDAS_AIOS_ROOT = previousRoot;
        NodeFS.rmSync(root, { recursive: true, force: true });
      }
    }).pipe(Effect.provide(layerFor(github)));
  },
);

it.effect(
  "keeps the shared project task database available when GitHub Issues are disabled",
  () => {
    const github = new FakeGithub();
    github.issues = output("", 1, "the repository has disabled issues");
    return Effect.gen(function* () {
      const board = yield* TaskBoardService.TaskBoardService;
      const snapshot = yield* board.list(project);
      expect(snapshot.repository).toBe("ItzJsimp/leonidas-code");
      expect(snapshot.tasks).toEqual([]);
      expect(snapshot.issues).toEqual([]);
    }).pipe(Effect.provide(layerFor(github)));
  },
);

it.effect("keeps GitHub issues out of the AIOS tasks folder", () => {
  const github = new FakeGithub();
  github.issues = output(
    JSON.stringify([
      {
        number: 7,
        title: "Issue stays in GitHub",
        url: "https://github.com/ItzJsimp/leonidas-code/issues/7",
        updatedAt: "2026-10-11T00:00:00Z",
        labels: [],
        assignees: [],
        state: "OPEN",
        body: "",
      },
    ]),
  );
  const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "task-board-issues-"));
  const tasksPath = NodePath.join(root, "tasks");
  NodeFS.mkdirSync(tasksPath);
  const previousRoot = process.env.LEONIDAS_AIOS_ROOT;
  process.env.LEONIDAS_AIOS_ROOT = root;

  return Effect.gen(function* () {
    try {
      const board = yield* TaskBoardService.TaskBoardService;
      const snapshot = yield* board.sync(project, { actor: "Jake" });
      expect(snapshot.tasks).toEqual([
        expect.objectContaining({ source: "github_issue", sourceId: "7" }),
      ]);
      expect(NodeFS.readdirSync(tasksPath)).toEqual([]);
    } finally {
      if (previousRoot === undefined) delete process.env.LEONIDAS_AIOS_ROOT;
      else process.env.LEONIDAS_AIOS_ROOT = previousRoot;
      NodeFS.rmSync(root, { recursive: true, force: true });
    }
  }).pipe(Effect.provide(layerFor(github)));
});
