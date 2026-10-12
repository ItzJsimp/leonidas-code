// @effect-diagnostics nodeBuiltinImport:off globalDate:off - temp AIOS folders are plain Node fixtures.
import { expect, it } from "@effect/vitest";
import type { Project } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as TestClock from "effect/testing/TestClock";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as ProcessRunner from "../processRunner.ts";
import * as TaskBoardService from "./TaskBoardService.ts";
import { ServerConfig } from "../config.ts";

const issue = {
  number: 12,
  title: "Build the board",
  url: "https://github.com/ItzJsimp/leonidas-code/issues/12",
  updatedAt: "2026-10-10T12:00:00Z",
  labels: [{ name: "feature" }],
  assignees: [{ login: "vMobxAi" }],
};

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

const boardProject = {
  id: "project-board",
  title: "Leonidas Code",
  workspaceRoot: "D:/leonidas-code",
  repositoryIdentity: {
    canonicalKey: "github.com/ItzJsimp/leonidas-code",
    locator: {
      source: "git-remote",
      remoteName: "origin",
      remoteUrl: "https://github.com/ItzJsimp/leonidas-code.git",
    },
    provider: "github",
    displayName: "ItzJsimp/leonidas-code",
    owner: "ItzJsimp",
    name: "leonidas-code",
  },
} as Project;

// Counts issue reads and records every write; branch lookups are answered so persist can complete.
const boardRunner = (
  onIssueRead: () => void,
  issueResponse = output(JSON.stringify([issue])),
  onWrite: (args: ReadonlyArray<string>) => void = () => {},
) =>
  ProcessRunner.ProcessRunner.of({
    run: (input) =>
      Effect.gen(function* () {
        if (input.args.some((arg) => arg.includes("matching-refs"))) return output("[]");
        if (input.args[1] === "repos/ItzJsimp/leonidas-code") {
          return output(JSON.stringify({ default_branch: "main" }));
        }
        if (
          input.args.some((arg) => arg.startsWith("repos/ItzJsimp/leonidas-code/git/ref/heads/"))
        ) {
          return output(JSON.stringify({ object: { sha: "abc123" } }));
        }
        if (input.args.includes("PUT") || input.args.includes("POST")) {
          onWrite(input.args);
          return output("{}");
        }
        onIssueRead();
        yield* Effect.yieldNow;
        return issueResponse;
      }),
  });

const boardLayer = (runner: ReturnType<typeof boardRunner>) =>
  TaskBoardService.layer.pipe(Layer.provide(Layer.succeed(ProcessRunner.ProcessRunner, runner)));

it.effect.each([
  [
    "reports disabled Issues explicitly",
    output("", 1, "the repository has disabled issues"),
    "issues_disabled",
  ],
  [
    "reports GitHub failures without exposing stderr",
    output("", 1, "sensitive provider response"),
    "request_failed",
  ],
  ["rejects malformed GitHub JSON", output("not json"), "invalid_response"],
  ["rejects malformed issue records", output(JSON.stringify([{ number: -1 }])), "invalid_response"],
] as const)("%s", ([_name, response, reason]) =>
  Effect.gen(function* () {
    const board = yield* TaskBoardService.TaskBoardService;
    const result = yield* Effect.result(board.list(boardProject));
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(result.failure.reason).toBe(reason);
      expect(result.failure.message).not.toContain("sensitive provider response");
    }
  }).pipe(Effect.provide(boardLayer(boardRunner(() => {}, response)))),
);

it.effect("shares one GitHub read between concurrent board loads", () => {
  let issueReads = 0;
  return Effect.gen(function* () {
    const board = yield* TaskBoardService.TaskBoardService;
    yield* Effect.all(
      [board.list(boardProject), board.list(boardProject), board.list(boardProject)],
      {
        concurrency: "unbounded",
      },
    );
    expect(issueReads).toBe(1);
  }).pipe(Effect.provide(boardLayer(boardRunner(() => issueReads++))));
});

it.effect("reuses a successful board read for five seconds", () => {
  let issueReads = 0;
  return Effect.gen(function* () {
    const board = yield* TaskBoardService.TaskBoardService;
    yield* board.list(boardProject);
    yield* board.list(boardProject);
    expect(issueReads).toBe(1);
    yield* TestClock.adjust("4 seconds");
    yield* board.list(boardProject);
    expect(issueReads).toBe(1);
    yield* TestClock.adjust("2 seconds");
    yield* board.list(boardProject);
    expect(issueReads).toBe(2);
  }).pipe(Effect.provide(boardLayer(boardRunner(() => issueReads++))));
});

it.effect("backs off repeated failed board reads: 10 s, then 20 s", () => {
  let issueReads = 0;
  const failure = output("", 1, "request_failed");
  return Effect.gen(function* () {
    const board = yield* TaskBoardService.TaskBoardService;
    expect((yield* Effect.result(board.list(boardProject)))._tag).toBe("Failure");
    expect(issueReads).toBe(1);
    yield* TestClock.adjust("9 seconds");
    expect((yield* Effect.result(board.list(boardProject)))._tag).toBe("Failure");
    expect(issueReads).toBe(1);
    yield* TestClock.adjust("1 second");
    expect((yield* Effect.result(board.list(boardProject)))._tag).toBe("Failure");
    expect(issueReads).toBe(2);
    yield* TestClock.adjust("19 seconds");
    yield* Effect.result(board.list(boardProject));
    expect(issueReads).toBe(2);
    yield* TestClock.adjust("1 second");
    yield* Effect.result(board.list(boardProject));
    expect(issueReads).toBe(3);
  }).pipe(Effect.provide(boardLayer(boardRunner(() => issueReads++, failure))));
});

it.effect("drops the cached board after a write so the next load reads GitHub", () => {
  let issueReads = 0;
  return Effect.gen(function* () {
    const board = yield* TaskBoardService.TaskBoardService;
    yield* board.list(boardProject);
    yield* board.create(boardProject, {
      projectId: boardProject.id,
      actor: "Jake",
      title: "Second task",
    });
    const beforeList = issueReads;
    yield* board.list(boardProject);
    expect(issueReads).toBe(beforeList + 1);
  }).pipe(Effect.provide(boardLayer(boardRunner(() => issueReads++))));
});

// A throwaway AIOS: tasks/ holds the cards and projects/leonidas-code is the Leonidas project folder.
const withAios = <A, E, R>(
  cards: Readonly<Record<string, string>>,
  use: (root: string, project: Project) => Effect.Effect<A, E, R>,
) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const root = NodeFS.realpathSync(
        NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "aios-board-")),
      );
      NodeFS.mkdirSync(NodePath.join(root, "tasks"), { recursive: true });
      NodeFS.mkdirSync(NodePath.join(root, "projects", "leonidas-code"), { recursive: true });
      for (const [name, contents] of Object.entries(cards)) {
        NodeFS.writeFileSync(NodePath.join(root, "tasks", name), contents);
      }
      const previous = process.env.LEONIDAS_AIOS_ROOT;
      process.env.LEONIDAS_AIOS_ROOT = root;
      return { root, previous };
    }),
    ({ root }) =>
      use(root, {
        ...boardProject,
        workspaceRoot: NodePath.join(root, "projects", "leonidas-code"),
      } as Project),
    ({ root, previous }) =>
      Effect.sync(() => {
        if (previous === undefined) delete process.env.LEONIDAS_AIOS_ROOT;
        else process.env.LEONIDAS_AIOS_ROOT = previous;
        NodeFS.rmSync(root, { recursive: true, force: true });
      }),
  );

const cardFile = (id: string, name: string, extra = "") =>
  `---\ntype: task\nid: ${id}\nname: "${name}"\nstatus: "Not started"\npriority: "High"\nproject: "leonidas-code"\n${extra}---\n# ${name}\n`;

const noGithub = boardRunner(() => {});

it.effect("publishes native tasks through the existing shared project board", () => {
  const writes: ReadonlyArray<string>[] = [];
  return withAios({}, (root, project) => {
    const stateDir = NodePath.join(root, "native-state");
    return Effect.gen(function* () {
      const board = yield* TaskBoardService.TaskBoardService;
      const task = yield* board.cardCreate(
        {
          title: "Native shared task",
          actor: "Jake",
          projectSlug: "leonidas-code",
          due: "2026-10-13",
        },
        [project],
      );
      yield* board.share(project, {
        projectId: project.id,
        taskIds: [task.id],
        shared: true,
        actor: "Jake",
      });
      const content = writes
        .find((args) => args.includes("PUT"))
        ?.find((arg) => arg.startsWith("content="));
      const published = JSON.parse(
        Buffer.from(content!.slice("content=".length), "base64").toString("utf8"),
      );
      expect(published.tasks).toHaveLength(1);
      expect(published.tasks[0]).toMatchObject({ id: task.id, shared: true, due: "2026-10-13" });
      expect(published.tasks[0]).not.toHaveProperty("sourceRoot");
      expect(
        (yield* board.workspace([project])).tasks.find((item) => item.id === task.id)?.shared,
      ).toBe(true);
    }).pipe(
      Effect.provide(
        boardLayer(
          boardRunner(
            () => {},
            output("[]"),
            (args) => writes.push(args),
          ),
        ).pipe(Layer.provide(Layer.succeed(ServerConfig, { stateDir } as ServerConfig["Service"]))),
      ),
    );
  });
});

it.effect("keeps imported cards editable while new tasks use native storage", () =>
  withAios({ "plan.md": cardFile("task-plan-the-day", "Plan the day") }, (root, project) => {
    const stateDir = NodePath.join(root, "native-state");
    return Effect.gen(function* () {
      const board = yield* TaskBoardService.TaskBoardService;
      const native = yield* board.cardCreate({ title: "Plan the day", actor: "Jake" }, [project]);
      expect(native.id).not.toBe("task-plan-the-day");
      const imported = yield* board.cardUpdate(
        { taskId: "task-plan-the-day", actor: "Jake", due: "2026-10-13" },
        [project],
      );
      expect(imported.due).toBe("2026-10-13");
      const workspace = yield* board.workspace([project]);
      expect(workspace.tasks).toHaveLength(2);
      expect(workspace.tasks.find((item) => item.id === native.id)?.sourceRoot).toBe(
        NodePath.join(stateDir, "task-board"),
      );
      expect(NodeFS.readdirSync(NodePath.join(root, "tasks"))).toEqual(["plan.md"]);
      NodeFS.writeFileSync(
        NodePath.join(root, "tasks", "copy.md"),
        cardFile(native.id, "Imported copy"),
      );
      const deduped = yield* board.workspace([project]);
      expect(deduped.tasks).toHaveLength(2);
      expect(deduped.tasks.find((item) => item.id === native.id)?.title).toBe("Plan the day");
    }).pipe(
      Effect.provide(
        boardLayer(noGithub).pipe(
          Layer.provide(Layer.succeed(ServerConfig, { stateDir } as ServerConfig["Service"])),
        ),
      ),
    );
  }),
);

it.effect("owns native tasks without an AIOS and persists dates, completion and reopening", () =>
  Effect.acquireUseRelease(
    Effect.sync(() => NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "leonidas tasks café-"))),
    (stateDir) =>
      Effect.gen(function* () {
        const board = yield* TaskBoardService.TaskBoardService;
        const created = yield* board.cardCreate(
          { title: "Plan the day", actor: "Jake", due: "2026-10-12", projectSlug: "personal-work" },
          [],
        );
        expect(created.due).toBe("2026-10-12");
        const listed = yield* board.workspace([]);
        expect(listed.tasks.map((item) => item.id)).toContain(created.id);
        expect(listed.aiosRoot).toBeNull();
        expect(listed.projects).toContainEqual(
          expect.objectContaining({ slug: "personal-work", projectId: null }),
        );
        const done = yield* board.cardUpdate(
          { taskId: created.id, actor: "Jake", status: "done", due: null },
          [],
        );
        expect(done.status).toBe("done");
        expect(done.due).toBeNull();
        const reopened = yield* board.cardUpdate(
          { taskId: created.id, actor: "Jake", status: "todo" },
          [],
        );
        expect(reopened.completedAt).toBeNull();
        expect(NodeFS.readdirSync(NodePath.join(stateDir, "task-board", "tasks"))).toHaveLength(1);
      }).pipe(
        Effect.provide(
          boardLayer(noGithub).pipe(
            Layer.provide(Layer.succeed(ServerConfig, { stateDir } as ServerConfig["Service"])),
          ),
        ),
      ),
    (stateDir) => Effect.sync(() => NodeFS.rmSync(stateDir, { recursive: true, force: true })),
  ),
);

it.effect("sections every AIOS card by project, read from disk without touching GitHub", () => {
  let githubCalls = 0;
  return withAios(
    {
      "one.md": cardFile("task-one", "First card"),
      "two.md": cardFile("task-two", "Second card").replace(
        'project: "leonidas-code"',
        'project: "simplygersi"',
      ),
    },
    (_root, project) =>
      Effect.gen(function* () {
        const board = yield* TaskBoardService.TaskBoardService;
        const workspace = yield* board.workspace([project]);
        expect(workspace.aiosConnected).toBe(true);
        expect(workspace.tasks.map((task) => task.id).sort()).toEqual(["task-one", "task-two"]);
        const section = workspace.projects.find((entry) => entry.slug === "leonidas-code");
        expect(section).toMatchObject({
          total: 1,
          open: 1,
          projectId: "project-board",
          repository: "ItzJsimp/leonidas-code",
        });
        expect(workspace.projects.some((entry) => entry.slug === "simplygersi")).toBe(true);
        expect(githubCalls).toBe(0);
      }),
  ).pipe(Effect.provide(boardLayer(boardRunner(() => githubCalls++))));
});

it.effect("claims a card in place, refuses a second claimant, and lets the holder release it", () =>
  withAios({ "one.md": cardFile("task-one", "First card") }, (root, project) =>
    Effect.gen(function* () {
      const board = yield* TaskBoardService.TaskBoardService;
      const claimed = yield* board.cardUpdate(
        { taskId: "task-one", actor: "Jake", claimedBy: "Jake" },
        [project],
      );
      expect(claimed.status).toBe("in_progress");
      expect(claimed.claimedBy).toBe("Jake");
      expect(NodeFS.readFileSync(NodePath.join(root, "tasks", "one.md"), "utf8")).toContain(
        "claimed_by",
      );

      const stolen = yield* Effect.result(
        board.cardUpdate({ taskId: "task-one", actor: "Mob", claimedBy: "Mob" }, [project]),
      );
      expect(stolen._tag).toBe("Failure");
      if (stolen._tag === "Failure")
        expect(stolen.failure).toMatchObject({ reason: "already_claimed" });

      const released = yield* board.cardUpdate(
        { taskId: "task-one", actor: "Jake", claimedBy: null },
        [project],
      );
      expect(released.claimedBy).toBeNull();
      expect(released.status).toBe("todo");
    }),
  ).pipe(Effect.provide(boardLayer(noGithub))),
);

it.effect("creates a card file linked to a project and reads it back", () =>
  withAios({}, (root, project) =>
    Effect.gen(function* () {
      const board = yield* TaskBoardService.TaskBoardService;
      const created = yield* board.cardCreate(
        {
          title: "Wire the dashboard",
          actor: "Jake",
          priority: "high",
          projectSlug: "leonidas-code",
        },
        [project],
      );
      expect(created).toMatchObject({
        title: "Wire the dashboard",
        status: "todo",
        priority: "high",
        projectSlug: "leonidas-code",
      });
      expect(NodeFS.existsSync(NodePath.join(root, "tasks", "wire-the-dashboard.md"))).toBe(true);
      const workspace = yield* board.workspace([project]);
      expect(workspace.tasks.map((task) => task.id)).toContain(created.id);
    }),
  ).pipe(Effect.provide(boardLayer(noGithub))),
);

it.effect("publishes open project cards to the shared board and marks them shared on disk", () => {
  const writes: Array<ReadonlyArray<string>> = [];
  return withAios(
    {
      "open.md": cardFile("task-open", "Open card"),
      "done.md": cardFile("task-done", "Done card").replace('"Not started"', '"Done"'),
    },
    (root, project) =>
      Effect.gen(function* () {
        const board = yield* TaskBoardService.TaskBoardService;
        yield* board.share(project, { projectId: project.id, shared: true, actor: "Jake" });
        const put = writes.find((args) => args.includes("PUT"));
        const content = put?.find((arg) => arg.startsWith("content="));
        const published = JSON.parse(
          Buffer.from(content!.slice("content=".length), "base64").toString("utf8"),
        );
        expect(published.tasks.map((task: { id: string }) => task.id)).toEqual(["task-open"]);
        expect(NodeFS.readFileSync(NodePath.join(root, "tasks", "open.md"), "utf8")).toMatch(
          /shared:\s*true/,
        );
        expect(NodeFS.readFileSync(NodePath.join(root, "tasks", "done.md"), "utf8")).not.toMatch(
          /shared:/,
        );
      }),
  ).pipe(
    Effect.provide(
      boardLayer(
        boardRunner(
          () => {},
          output("[]"),
          (args) => writes.push(args),
        ),
      ),
    ),
  );
});
