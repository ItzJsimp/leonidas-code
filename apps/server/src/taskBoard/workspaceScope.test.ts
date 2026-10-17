// @effect-diagnostics nodeBuiltinImport:off - temp AIOS folders are plain Node fixtures.
import { expect, it } from "@effect/vitest";
import type { Project } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { ServerConfig } from "../config.ts";
import * as ProcessRunner from "../processRunner.ts";
import * as TaskBoardService from "./TaskBoardService.ts";
import { discoverProjects } from "./aiosCards.ts";

// Two AIOS roots side by side, like "D:\Leonidas AIOS" and "D:\SimplyGersi AIOS" (ADR-0080).
const card = (id: string, project: string) =>
  `---\ntype: task\nid: ${id}\nname: "${id}"\nstatus: "Not started"\nproject: "${project}"\n---\n# ${id}\n`;

const makeAios = (temp: string, name: string, id: string | null, type: string) => {
  const root = NodePath.join(temp, name);
  NodeFS.mkdirSync(NodePath.join(root, "tasks"), { recursive: true });
  NodeFS.mkdirSync(NodePath.join(root, "projects", "app"), { recursive: true });
  NodeFS.writeFileSync(NodePath.join(root, "tasks", `${name}.md`), card(`task-${name}`, "app"));
  if (id) {
    NodeFS.writeFileSync(
      NodePath.join(root, "workspace.json"),
      JSON.stringify({ id, name, type, schemaVersion: 1 }),
    );
  }
  return root;
};

const project = (id: string, title: string, workspaceRoot: string) =>
  ({ id, title, workspaceRoot }) as unknown as Project;

const noProcesses = ProcessRunner.ProcessRunner.of({
  run: () => Effect.die("The workspace tests never call a process."),
});

const withWorkspaces = <A, E>(
  use: (fixture: {
    personal: string;
    business: string;
    bare: string;
    projects: ReadonlyArray<Project>;
  }) => Effect.Effect<A, E, TaskBoardService.TaskBoardService>,
) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const temp = NodeFS.realpathSync(
        NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "workspace scope-")),
      );
      const personal = makeAios(temp, "personal", "leonidas", "personal");
      const business = makeAios(temp, "business", "simplygersi", "business");
      const bare = makeAios(temp, "bare", null, "personal");
      const previous = process.env.LEONIDAS_AIOS_ROOT;
      process.env.LEONIDAS_AIOS_ROOT = personal;
      return { temp, personal, business, bare, previous };
    }),
    ({ temp, personal, business, bare }) =>
      use({
        personal,
        business,
        bare,
        projects: [
          project("p-personal", "Personal app", NodePath.join(personal, "projects", "app")),
          // Gersi's setup adds the AIOS root itself as a project.
          project("p-business", "SimplyGersi AIOS", business),
          project("p-bare", "Bare", bare),
        ],
      }).pipe(
        Effect.provide(
          TaskBoardService.layer.pipe(
            Layer.provide(Layer.succeed(ProcessRunner.ProcessRunner, noProcesses)),
            Layer.provide(
              Layer.succeed(ServerConfig, {
                stateDir: NodePath.join(temp, "native-state"),
              } as ServerConfig["Service"]),
            ),
          ),
        ),
      ),
    ({ temp, previous }) =>
      Effect.sync(() => {
        if (previous === undefined) delete process.env.LEONIDAS_AIOS_ROOT;
        else process.env.LEONIDAS_AIOS_ROOT = previous;
        NodeFS.rmSync(temp, { recursive: true, force: true });
      }),
  );

it.effect("reads only the requested workspace's cards, native cards included", () =>
  withWorkspaces(({ personal, business, projects }) =>
    Effect.gen(function* () {
      const board = yield* TaskBoardService.TaskBoardService;
      // A native card for a personal project, and a new card made inside the business workspace.
      const native = yield* board.cardCreate(
        { title: "Personal native", actor: "Jake", projectId: projects[0]!.id },
        projects,
      );
      const made = yield* board.cardCreate(
        { title: "Business card", actor: "Gersi", workspaceId: "simplygersi" },
        projects,
      );
      expect(made.sourceRoot).toBe(business);

      const businessBoard = yield* board.workspace(projects, "simplygersi");
      expect(
        businessBoard.projects.flatMap((section) => (section.projectId ? [section.projectId] : [])),
      ).toEqual(["p-business"]);
      const businessIds = (yield* board.workspace(projects, "simplygersi")).tasks.map(
        (task) => task.id,
      );
      expect(businessIds.toSorted()).toEqual([made.id, "task-business"].toSorted());

      const personalIds = (yield* board.workspace(projects, "leonidas")).tasks.map(
        (task) => task.id,
      );
      expect(personalIds.toSorted()).toEqual([native.id, "task-personal"].toSorted());
      // No id means the default workspace, so old clients see what they saw before.
      expect((yield* board.workspace(projects)).tasks.map((task) => task.id).toSorted()).toEqual(
        personalIds.toSorted(),
      );

      const home = yield* board.home(projects, "simplygersi");
      expect(home.root).toBe(business);
      expect(yield* board.aiosRoot(projects, "simplygersi")).toBe(business);
      expect(yield* board.aiosRoot(projects, "leonidas")).toBe(personal);
    }),
  ),
);

it.effect("returns nothing for an unknown workspace id and never falls back", () =>
  withWorkspaces(({ projects }) =>
    Effect.gen(function* () {
      const board = yield* TaskBoardService.TaskBoardService;
      yield* board.cardCreate({ title: "Personal native", actor: "Jake" }, projects);
      expect((yield* board.workspace(projects, "not-a-workspace")).tasks).toEqual([]);
      expect((yield* board.home(projects, "not-a-workspace")).root).toBeNull();
      const write = yield* Effect.exit(
        board.cardCreate(
          { title: "Lost", actor: "Jake", workspaceId: "not-a-workspace" },
          projects,
        ),
      );
      expect(Exit.isFailure(write)).toBe(true);
    }),
  ),
);

it.effect("refuses to update a card that lives in another workspace", () =>
  withWorkspaces(({ business, projects }) =>
    Effect.gen(function* () {
      const board = yield* TaskBoardService.TaskBoardService;
      const update = yield* Effect.exit(
        board.cardUpdate(
          { taskId: "task-business", actor: "Jake", note: "cross", workspaceId: "leonidas" },
          projects,
        ),
      );
      expect(Exit.isFailure(update)).toBe(true);
      expect(
        NodeFS.readFileSync(NodePath.join(business, "tasks", "business.md"), "utf8"),
      ).not.toContain("cross");
    }),
  ),
);

it.effect("lists every AIOS with its file state and writes the setup file once", () =>
  withWorkspaces(({ personal, business, bare, projects }) =>
    Effect.gen(function* () {
      const board = yield* TaskBoardService.TaskBoardService;
      const { workspaces } = yield* board.workspaces(projects);
      expect(
        workspaces.map(({ root, status, id, isDefault, projectIds }) => ({
          root,
          status,
          id,
          isDefault,
          projectIds,
        })),
      ).toEqual([
        {
          root: personal,
          status: "ready",
          id: "leonidas",
          isDefault: true,
          projectIds: ["p-personal"],
        },
        {
          root: business,
          status: "ready",
          id: "simplygersi",
          isDefault: false,
          projectIds: ["p-business"],
        },
        { root: bare, status: "missing", id: null, isDefault: false, projectIds: ["p-bare"] },
      ]);

      const taken = yield* Effect.exit(
        board.workspaceInit(
          { root: bare, id: "leonidas", name: "Bare", type: "personal" },
          projects,
        ),
      );
      expect(Exit.isFailure(taken)).toBe(true);
      const ready = yield* board.workspaceInit(
        { root: bare, id: "bare", name: "Bare", type: "personal" },
        projects,
      );
      expect(ready.status).toBe("ready");
      const again = yield* Effect.exit(
        board.workspaceInit({ root: bare, id: "bare2", name: "Bare", type: "personal" }, projects),
      );
      expect(Exit.isFailure(again)).toBe(true);
    }),
  ),
);

it.effect("files an inbox capture as a task inside the workspace it came from", () =>
  withWorkspaces(({ personal, business, projects }) =>
    Effect.gen(function* () {
      const board = yield* TaskBoardService.TaskBoardService;
      const filed = yield* board.inboxDrop(
        { text: "call Abbe about the invoice", actor: "Gersi", workspaceId: "simplygersi" },
        projects,
      );
      expect(filed.kind).toBe("task");
      expect(NodeFS.readdirSync(NodePath.join(business, "tasks"))).toHaveLength(2);
      expect(NodeFS.readdirSync(NodePath.join(personal, "tasks"))).toEqual(["personal.md"]);
      const ids = (yield* board.workspace(projects, "leonidas")).tasks.map((task) => task.id);
      expect(ids).toEqual(["task-personal"]);
    }),
  ),
);

it.effect("does not fall back to another workspace's shared board on a scoped update", () =>
  withWorkspaces(({ projects }) =>
    Effect.gen(function* () {
      const board = yield* TaskBoardService.TaskBoardService;
      const error = yield* Effect.flip(
        board.cardUpdate(
          {
            taskId: "task-on-a-shared-board",
            actor: "Jake",
            note: "cross",
            workspaceId: "leonidas",
            projectId: projects[1]!.id,
          },
          projects,
        ),
      );
      expect(error).toMatchObject({ _tag: "TaskBoardOperationError", reason: "task_not_found" });
    }),
  ),
);

it.effect("keeps every native card visible to callers that send no workspace id", () =>
  withWorkspaces(({ projects }) =>
    Effect.gen(function* () {
      const board = yield* TaskBoardService.TaskBoardService;
      // An agent run in a SimplyGersi thread files a native card with no id (TaskAutoLog).
      const run = yield* board.cardCreate(
        { title: "Agent run", actor: "Leonidas", projectId: projects[1]!.id },
        projects,
      );
      const ids = (target?: string) =>
        board.workspace(projects, target).pipe(Effect.map((s) => s.tasks.map((task) => task.id)));
      expect(yield* ids()).toContain(run.id);
      expect(yield* ids("simplygersi")).toContain(run.id);
      expect(yield* ids("leonidas")).not.toContain(run.id);
    }),
  ),
);

it.effect("does not read a brief or project linked in from another workspace", () =>
  withWorkspaces(({ personal, business, projects }) =>
    Effect.gen(function* () {
      const board = yield* TaskBoardService.TaskBoardService;
      const briefs = NodePath.join(business, "logs", "briefings");
      NodeFS.mkdirSync(briefs, { recursive: true });
      NodeFS.writeFileSync(
        NodePath.join(briefs, "2026-10-17-briefing.md"),
        "# Brief\n\n## Priorities Seeded\n- [ ] Business secret\n",
      );
      NodeFS.mkdirSync(NodePath.join(personal, "logs"), { recursive: true });
      NodeFS.symlinkSync(briefs, NodePath.join(personal, "logs", "briefings"), "junction");
      NodeFS.symlinkSync(
        NodePath.join(business, "projects", "app"),
        NodePath.join(personal, "projects", "linked"),
        "junction",
      );
      expect((yield* board.home(projects, "simplygersi")).brief).not.toBeNull();
      expect((yield* board.home(projects, "leonidas")).brief).toBeNull();
      expect(discoverProjects(personal).map((project) => project.slug)).toEqual(["app"]);
    }),
  ),
);
