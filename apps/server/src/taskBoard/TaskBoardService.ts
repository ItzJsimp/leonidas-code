// @effect-diagnostics nodeBuiltinImport:off
import {
  TaskBoardIssue,
  TaskBoardOperationError,
  TaskBoardProjectDatabase,
  TaskBoardReadError,
  type TaskBoardAgent,
  type TaskBoardClaimInput,
  type TaskBoardCompleteInput,
  type TaskBoardCreateInput,
  type TaskBoardHistoryEntry,
  type TaskBoardCardCreateInput,
  type TaskBoardCardUpdateInput,
  type TaskBoardReleaseInput,
  type TaskBoardShareInput,
  type TaskBoardSnapshot,
  type TaskBoardTask,
  type TaskBoardTaskPriority,
  type TaskBoardTaskStatus,
  type TaskBoardUpdateInput,
  type TaskBoardWorkspaceSnapshot,
  type Project,
} from "@t3tools/contracts";
import * as Cache from "effect/Cache";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Option from "effect/Option";
import { ServerConfig } from "../config.ts";
import * as ProcessRunner from "../processRunner.ts";
import {
  applyCardPatch,
  createCardFile,
  discoverProjects,
  findAiosRoot,
  cardToTask,
  findCardFile,
  readAiosTasks,
  resolveMember,
  type AiosCardCache,
  type AiosCardPatch,
} from "./aiosCards.ts";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const LIMIT = 200;
const DATABASE_VERSION = 1;
// Clients poll the board every 10 s. A successful read is shared for 5 s, so
// concurrent pollers of one project cost one gh round. Failures back off
// (10 s, 20 s, ... capped at 2 min) so a broken repo does not spawn gh on every poll.
const LIST_TTL_MS = 5_000;
const FAILURE_BACKOFF_MIN_MS = 10_000;
const FAILURE_BACKOFF_MAX_MS = 30_000;
const databaseFile = (slug: string) => `.leonidas/task-board/${slug}.json`;
const decodeIssues = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Array(TaskBoardIssue)),
);
const decodeDatabase = Schema.decodeUnknownSync(TaskBoardProjectDatabase);

type BoardProject = {
  readonly projectId: Project["id"];
  readonly name: string;
  readonly slug: string;
  readonly workspaceRoot: string;
  readonly repository: string;
  readonly owner: string;
  readonly repo: string;
};

// Structural equality so a freshly built BoardProject hits the same cache entry.
class BoardProjectKey extends Data.Class<BoardProject> {}

type Database = typeof TaskBoardProjectDatabase.Type;
type LoadedDatabase = { readonly data: Database; readonly sha: string | null };
type GhResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
  readonly timedOut: boolean;
};

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "project"
  );
}

function toBoardProject(project: Project): BoardProject {
  const identity = project.repositoryIdentity;
  if (!identity || identity.provider !== "github" || !identity.owner || !identity.name) {
    throw new TaskBoardReadError({ reason: "repository_not_supported", cause: project.id });
  }
  return {
    projectId: project.id,
    name: project.title,
    slug: slugify(project.title),
    workspaceRoot: project.workspaceRoot,
    repository: `${identity.owner}/${identity.name}`,
    owner: identity.owner,
    repo: identity.name,
  };
}

function summary(tasks: ReadonlyArray<TaskBoardTask>) {
  return {
    total: tasks.length,
    todo: tasks.filter((task) => task.status === "todo").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    review: tasks.filter((task) => task.status === "review").length,
    blocked: tasks.filter((task) => task.status === "blocked").length,
    done: tasks.filter((task) => task.status === "done").length,
  };
}

function priorityFromLabels(
  labels: ReadonlyArray<{ readonly name: string }>,
): TaskBoardTaskPriority {
  const names = labels.map((label) => label.name.toLowerCase());
  if (names.some((name) => name.includes("critical"))) return "critical";
  if (names.some((name) => name.includes("high"))) return "high";
  if (names.some((name) => name.includes("low"))) return "low";
  return "medium";
}

const OPEN_STATUSES: ReadonlyArray<TaskBoardTaskStatus> = [
  "todo",
  "in_progress",
  "review",
  "blocked",
];
const isOpen = (task: TaskBoardTask) => OPEN_STATUSES.includes(task.status);

function githubRepository(project: Project): string | null {
  const identity = project.repositoryIdentity;
  return identity && identity.provider === "github" && identity.owner && identity.name
    ? `${identity.owner}/${identity.name}`
    : null;
}

/** The slug cards use for a Leonidas project: its folder under `projects/`, else its slugified title. */
function aiosSlugFor(project: Project): string {
  const root = project.workspaceRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  const inProjects = NodePath.posix.basename(NodePath.posix.dirname(root)) === "projects";
  return inProjects ? NodePath.posix.basename(root).toLowerCase() : slugify(project.title);
}

function aiosRootFor(projects: ReadonlyArray<{ readonly workspaceRoot: string }>): string | null {
  return findAiosRoot([
    process.env.LEONIDAS_AIOS_ROOT,
    process.env.AIOS_ROOT,
    ...projects.map((project) => project.workspaceRoot),
  ]);
}

function titleCase(slug: string): string {
  return slug
    .split(/[-_\s/]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const agentLabel = (agent: TaskBoardAgent | undefined): string | undefined => {
  const label = [agent?.providerInstanceId, agent?.model].filter(Boolean).join("/");
  return label || undefined;
};

const storageError = (message: string) =>
  new TaskBoardOperationError({ reason: "storage_error", message });

/** Writes next to the card, then renames over it, so a reader never sees half a card. */
function writeCardAtomically(file: string, contents: string): void {
  const real = NodeFS.realpathSync(file);
  const temp = NodePath.join(
    NodePath.dirname(real),
    `.${NodePath.basename(real)}.${NodeCrypto.randomUUID()}.tmp`,
  );
  try {
    NodeFS.writeFileSync(temp, contents, "utf8");
    NodeFS.renameSync(temp, real);
  } catch (error) {
    NodeFS.rmSync(temp, { force: true });
    throw error;
  }
}

/** Sections are the AIOS project folders, every slug a card names, and every Leonidas project. */
function buildWorkspace(input: {
  readonly root: string | null;
  readonly member: string;
  readonly checkedAt: number;
  readonly projects: ReadonlyArray<Project>;
  readonly discovered: ReadonlyArray<{ readonly slug: string; readonly name: string }>;
  readonly tasks: ReadonlyArray<TaskBoardTask>;
}): TaskBoardWorkspaceSnapshot {
  const sections = new Map<string, { slug: string; name: string; project: Project | null }>();
  for (const found of input.discovered) {
    const slug = found.slug.toLowerCase();
    sections.set(slug, { slug, name: found.name, project: null });
  }
  const counts = new Map<string, { total: number; open: number }>();
  for (const task of input.tasks) {
    const slug = task.projectSlug?.toLowerCase();
    if (!slug) continue;
    if (!sections.has(slug)) sections.set(slug, { slug, name: titleCase(slug), project: null });
    const count = counts.get(slug) ?? { total: 0, open: 0 };
    count.total++;
    if (isOpen(task)) count.open++;
    counts.set(slug, count);
  }
  for (const project of input.projects) {
    const slug = aiosSlugFor(project);
    const section = sections.get(slug);
    if (!section) sections.set(slug, { slug, name: project.title, project });
    else if (
      !section.project ||
      (!githubRepository(section.project) && githubRepository(project))
    ) {
      section.project = project;
    }
  }
  const projects = [...sections.values()]
    .flatMap((section) => {
      const count = counts.get(section.slug) ?? { total: 0, open: 0 };
      if (count.total === 0 && !section.project) return [];
      return [
        {
          slug: section.slug,
          name: section.name,
          projectId: section.project?.id ?? null,
          repository: section.project ? githubRepository(section.project) : null,
          total: count.total,
          open: count.open,
        },
      ];
    })
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
  const tasks = [...input.tasks].sort(
    (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
  );
  return {
    member: input.member,
    aiosRoot: input.root,
    aiosConnected: input.root !== null,
    checkedAt: input.checkedAt,
    projects,
    tasks,
  };
}

/** A claim held by someone else may only be taken over or released by that person. */
function claimConflict(
  card: TaskBoardTask,
  input: { readonly claimedBy?: string | null | undefined; readonly actor: string },
): TaskBoardOperationError | null {
  const holder = card.claimedBy;
  if (!holder || input.claimedBy === undefined || sameName(holder, input.actor)) return null;
  if (input.claimedBy === null) {
    return new TaskBoardOperationError({
      reason: "claim_conflict",
      message: `Only ${holder} can release this claim.`,
    });
  }
  if (!sameName(holder, input.claimedBy)) {
    return new TaskBoardOperationError({
      reason: "already_claimed",
      message: `This task is currently claimed by ${holder}.`,
    });
  }
  return null;
}

function cardPatchFor(input: TaskBoardCardUpdateInput, card: TaskBoardTask): AiosCardPatch {
  // Claiming a card nobody started moves it to In progress; releasing an in-progress card returns it to the queue.
  const status =
    input.status ??
    (typeof input.claimedBy === "string" && card.status === "todo"
      ? "in_progress"
      : input.claimedBy === null && card.status === "in_progress"
        ? "todo"
        : undefined);
  return {
    actor: input.actor,
    status,
    priority: input.priority,
    title: input.title,
    due: input.due,
    projectSlug: input.projectSlug,
    claimedBy: input.claimedBy,
    note: input.note,
    agentLabel: agentLabel(input.agent),
    threadId: input.agent?.threadId,
  };
}

function databaseFromContents(raw: string): LoadedDatabase {
  const response = JSON.parse(raw) as { readonly content?: string; readonly sha?: string };
  if (!response.content) return { data: { version: DATABASE_VERSION, tasks: [] }, sha: null };
  const parsed = JSON.parse(
    Buffer.from(response.content.replace(/\s/g, ""), "base64").toString("utf8"),
  );
  return { data: decodeDatabase(parsed), sha: response.sha ?? null };
}

export class TaskBoardService extends Context.Service<
  TaskBoardService,
  {
    readonly list: (project: Project) => Effect.Effect<TaskBoardSnapshot, TaskBoardReadError>;
    readonly create: (
      project: Project,
      input: TaskBoardCreateInput,
    ) => Effect.Effect<TaskBoardTask, TaskBoardReadError | TaskBoardOperationError>;
    readonly claim: (
      project: Project,
      input: TaskBoardClaimInput,
    ) => Effect.Effect<TaskBoardTask, TaskBoardReadError | TaskBoardOperationError>;
    readonly release: (
      project: Project,
      input: TaskBoardReleaseInput,
    ) => Effect.Effect<TaskBoardTask, TaskBoardReadError | TaskBoardOperationError>;
    readonly complete: (
      project: Project,
      input: TaskBoardCompleteInput,
    ) => Effect.Effect<TaskBoardTask, TaskBoardReadError | TaskBoardOperationError>;
    readonly update: (
      project: Project,
      input: TaskBoardUpdateInput,
    ) => Effect.Effect<TaskBoardTask, TaskBoardReadError | TaskBoardOperationError>;
    /** Every AIOS task card, sectioned by project, read from disk with no GitHub round trip. */
    readonly workspace: (
      projects: ReadonlyArray<Project>,
    ) => Effect.Effect<TaskBoardWorkspaceSnapshot, TaskBoardReadError>;
    /** Patches one AIOS card in place; falls back to the project's shared board when the card is not local. */
    readonly cardUpdate: (
      input: TaskBoardCardUpdateInput,
      projects: ReadonlyArray<Project>,
    ) => Effect.Effect<TaskBoardTask, TaskBoardReadError | TaskBoardOperationError>;
    readonly cardCreate: (
      input: TaskBoardCardCreateInput,
      projects: ReadonlyArray<Project>,
    ) => Effect.Effect<TaskBoardTask, TaskBoardReadError | TaskBoardOperationError>;
    /** Publishes (or withdraws) AIOS cards on the project's shared board. */
    readonly share: (
      project: Project,
      input: TaskBoardShareInput,
    ) => Effect.Effect<TaskBoardSnapshot, TaskBoardReadError | TaskBoardOperationError>;
  }
>()("t3/taskBoard/TaskBoardService") {}

const make = Effect.gen(function* () {
  const processes = yield* ProcessRunner.ProcessRunner;
  const config = yield* Effect.serviceOption(ServerConfig);
  const nativeRoot = Option.isSome(config)
    ? NodePath.join(config.value.stateDir, "task-board")
    : null;
  const rootsFor = (projects: ReadonlyArray<Project>) => [
    ...new Set([nativeRoot, aiosRootFor(projects)].filter((root): root is string => root !== null)),
  ];

  const runGh = (args: ReadonlyArray<string>, allowNotFound = false) =>
    processes
      .run({ command: "gh", args, timeout: "20 seconds", maxOutputBytes: 4 * 1024 * 1024 })
      .pipe(
        Effect.mapError((cause) => new TaskBoardReadError({ reason: "unavailable", cause })),
        Effect.flatMap((result) => {
          if (result.code === 0 && !result.timedOut) return Effect.succeed(result);
          if (allowNotFound && /HTTP 404|Not Found/i.test(result.stderr))
            return Effect.succeed(null);
          if (/disabled issues/i.test(result.stderr)) {
            return Effect.fail(
              new TaskBoardReadError({ reason: "issues_disabled", cause: result }),
            );
          }
          return Effect.fail(new TaskBoardReadError({ reason: "request_failed", cause: result }));
        }),
      );

  const readIssues = (project: BoardProject) =>
    runGh([
      "issue",
      "list",
      "--repo",
      project.repository,
      "--state",
      "all",
      "--limit",
      String(LIMIT),
      "--json",
      "number,title,url,body,createdAt,updatedAt,state,labels,assignees",
    ]).pipe(
      Effect.flatMap((result) =>
        decodeIssues(result!.stdout).pipe(
          Effect.mapError((cause) => new TaskBoardReadError({ reason: "invalid_response", cause })),
        ),
      ),
    );

  const branchName = (project: BoardProject) =>
    `task-board-${NodeCrypto.createHash("sha256").update(`${project.repository.toLowerCase()}/${project.slug}`).digest("hex").slice(0, 20)}`;

  const findBranch = (project: BoardProject) =>
    runGh(
      ["api", `repos/${project.repository}/git/matching-refs/heads/${branchName(project)}`],
      true,
    ).pipe(
      Effect.flatMap((result) => {
        if (!result) return Effect.succeed(false);
        try {
          const refs = JSON.parse(result.stdout) as Array<{ readonly ref: string }>;
          return Effect.succeed(
            refs.some((ref) => ref.ref === `refs/heads/${branchName(project)}`),
          );
        } catch (cause) {
          return Effect.fail(new TaskBoardReadError({ reason: "invalid_response", cause }));
        }
      }),
    );

  const ensureBranch = (project: BoardProject) =>
    Effect.gen(function* () {
      if (yield* findBranch(project)) return;
      const repository = yield* runGh(["api", `repos/${project.repository}`]);
      let defaultBranch: string;
      try {
        defaultBranch = (JSON.parse(repository!.stdout) as { default_branch: string })
          .default_branch;
      } catch (cause) {
        return yield* new TaskBoardReadError({ reason: "invalid_response", cause });
      }
      const base = yield* runGh([
        "api",
        `repos/${project.repository}/git/ref/heads/${defaultBranch}`,
      ]);
      let sha: string;
      try {
        sha = (JSON.parse(base!.stdout) as { object: { sha: string } }).object.sha;
      } catch (cause) {
        return yield* new TaskBoardReadError({ reason: "invalid_response", cause });
      }
      const created = yield* processes
        .run({
          command: "gh",
          args: [
            "api",
            "--method",
            "POST",
            `repos/${project.repository}/git/refs`,
            "--raw-field",
            `ref=refs/heads/${branchName(project)}`,
            "--raw-field",
            `sha=${sha}`,
          ],
          timeout: "20 seconds",
          maxOutputBytes: 64 * 1024,
        })
        .pipe(Effect.mapError((cause) => new TaskBoardReadError({ reason: "unavailable", cause })));
      if (
        created.code !== 0 &&
        !/already exists|Reference already exists|HTTP 422/i.test(created.stderr)
      ) {
        return yield* new TaskBoardReadError({
          reason: /HTTP 403|Resource not accessible|write access/i.test(created.stderr)
            ? "write_access_required"
            : "request_failed",
          cause: created,
        });
      }
      if (created.code !== 0 && !(yield* findBranch(project))) {
        return yield* new TaskBoardReadError({ reason: "request_failed", cause: created });
      }
    });

  const loadDatabase = (project: BoardProject) =>
    Effect.gen(function* () {
      const exists = yield* findBranch(project);
      if (!exists)
        return {
          data: { version: DATABASE_VERSION, tasks: [] },
          sha: null,
        } satisfies LoadedDatabase;
      const response = yield* runGh(
        [
          "api",
          `repos/${project.repository}/contents/${databaseFile(project.slug)}`,
          "-f",
          `ref=${branchName(project)}`,
        ],
        true,
      );
      if (!response)
        return {
          data: { version: DATABASE_VERSION, tasks: [] },
          sha: null,
        } satisfies LoadedDatabase;
      try {
        return databaseFromContents(response.stdout);
      } catch (cause) {
        return yield* new TaskBoardReadError({ reason: "invalid_response", cause });
      }
    });

  const writeDatabase = (
    project: BoardProject,
    tasks: ReadonlyArray<TaskBoardTask>,
    sha: string | null,
  ) =>
    Effect.gen(function* () {
      const path = databaseFile(project.slug);
      const content = Buffer.from(
        JSON.stringify({ version: DATABASE_VERSION, tasks }, null, 2),
      ).toString("base64");
      const args = [
        "api",
        "--method",
        "PUT",
        `repos/${project.repository}/contents/${path}`,
        "--raw-field",
        "message=Update shared task board",
        "--raw-field",
        `branch=${branchName(project)}`,
        "--raw-field",
        `content=${content}`,
      ];
      if (sha) args.push("--raw-field", `sha=${sha}`);
      const result = yield* processes
        .run({ command: "gh", args, timeout: "30 seconds", maxOutputBytes: 64 * 1024 })
        .pipe(Effect.mapError((cause) => new TaskBoardReadError({ reason: "unavailable", cause })));
      if (result.code === 0 && !result.timedOut) return true;
      if (/HTTP 409|sha.*(does not match|must be provided)|already exists/i.test(result.stderr))
        return false;
      return yield* new TaskBoardReadError({
        reason: /HTTP 403|Resource not accessible|write access/i.test(result.stderr)
          ? "write_access_required"
          : "request_failed",
        cause: result,
      });
    });

  const issuesAsTasks = (
    project: BoardProject,
    issues: ReadonlyArray<TaskBoardIssue>,
  ): ReadonlyArray<TaskBoardTask> =>
    issues.map((issue) => {
      const created = issue.createdAt ? Date.parse(issue.createdAt) : Date.parse(issue.updatedAt);
      return {
        id: `github-${issue.number}`,
        project: project.name,
        title: issue.title,
        description: issue.body ?? "",
        status: issue.state === "CLOSED" ? "done" : "todo",
        priority: priorityFromLabels(issue.labels),
        claimedBy: null,
        claimedAt: null,
        claimedAgent: null,
        completedBy: null,
        completedAt: issue.state === "CLOSED" ? Date.parse(issue.updatedAt) : null,
        completionSummary: null,
        createdAt: Number.isFinite(created) ? created : 0,
        updatedAt: Date.parse(issue.updatedAt) || 0,
        labels: issue.labels.map((label) => label.name),
        source: "github_issue",
        sourceId: String(issue.number),
        sourceFile: null,
        issueUrl: issue.url,
        history: [
          {
            id: `github-${issue.number}-created`,
            taskId: `github-${issue.number}`,
            action: "imported",
            actor: "GitHub issue",
            timestamp: Number.isFinite(created) ? created : 0,
            note: "Imported from the project's issue tracker",
          },
        ],
      };
    });

  const mergeTasks = (
    project: BoardProject,
    stored: ReadonlyArray<TaskBoardTask>,
    issues: ReadonlyArray<TaskBoardIssue>,
  ) => {
    const all = new Map(issuesAsTasks(project, issues).map((task) => [task.id, task] as const));
    for (const task of stored) all.set(task.id, { ...task, project: project.name });
    // Everything on the project's shared board is visible to collaborators.
    return [...all.values()]
      .map((task) => ({ ...task, shared: true }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  };

  const snapshot = (
    project: BoardProject,
    tasks: ReadonlyArray<TaskBoardTask>,
    issues: ReadonlyArray<TaskBoardIssue>,
  ) => {
    const aiosRoot = aiosRootFor([project]);
    return Effect.map(
      Clock.currentTimeMillis,
      (checkedAt) =>
        ({
          projectId: project.projectId,
          project: project.name,
          repository: project.repository,
          tasks,
          issues,
          checkedAt,
          limit: LIMIT,
          aiosConnected: aiosRoot !== null,
          summary: summary(tasks),
        }) satisfies TaskBoardSnapshot,
    );
  };

  const readBoard = (project: BoardProject) =>
    Effect.gen(function* () {
      const [database, issues] = yield* Effect.all([loadDatabase(project), readIssues(project)]);
      return yield* snapshot(project, mergeTasks(project, database.data.tasks, issues), issues);
    });

  // timeToLive reads the failure streak synchronously, so the streaks live in a plain Map.
  const failureStreaks = new Map<string, number>();
  const boardCache = yield* Cache.makeWith(readBoard, {
    capacity: 64,
    timeToLive: (exit, project) => {
      if (Exit.isSuccess(exit)) {
        failureStreaks.delete(project.projectId);
        return Duration.millis(LIST_TTL_MS);
      }
      const streak = (failureStreaks.get(project.projectId) ?? 0) + 1;
      failureStreaks.set(project.projectId, streak);
      return Duration.millis(
        Math.min(FAILURE_BACKOFF_MIN_MS * 2 ** (streak - 1), FAILURE_BACKOFF_MAX_MS),
      );
    },
  });

  const list = (projectInput: Project) =>
    projectContext(projectInput).pipe(
      Effect.flatMap((project) => Cache.get(boardCache, new BoardProjectKey(project))),
    );

  const persist = <A>(
    project: BoardProject,
    apply: (tasks: ReadonlyArray<TaskBoardTask>) => {
      readonly tasks: ReadonlyArray<TaskBoardTask>;
      readonly result: A;
    },
  ) =>
    Effect.gen(function* () {
      yield* ensureBranch(project);
      for (let attempt = 0; attempt < 6; attempt++) {
        const [database, issues] = yield* Effect.all([loadDatabase(project), readIssues(project)]);
        const existingTasks = mergeTasks(project, database.data.tasks, issues);
        const outcome = yield* Effect.try({
          try: () => apply(existingTasks),
          catch: (cause) =>
            cause instanceof TaskBoardOperationError
              ? cause
              : new TaskBoardOperationError({ reason: "invalid_data", message: String(cause) }),
        });
        if (outcome.tasks === existingTasks) return outcome.result;
        if (yield* writeDatabase(project, outcome.tasks, database.sha)) return outcome.result;
      }
      return yield* new TaskBoardReadError({
        reason: "request_failed",
        cause: "Concurrent task edits; retry the operation.",
      });
    }).pipe(Effect.ensuring(Cache.invalidate(boardCache, new BoardProjectKey(project))));

  const record = (
    task: TaskBoardTask,
    action: TaskBoardHistoryEntry["action"],
    actor: string,
    timestamp: number,
    note: string | null,
    agent?: TaskBoardAgent,
  ): TaskBoardTask => ({
    ...task,
    updatedAt: timestamp,
    history: [
      ...task.history,
      {
        id: NodeCrypto.randomUUID(),
        taskId: task.id,
        action,
        actor,
        timestamp,
        note,
        ...(agent ? { agent } : {}),
      },
    ],
  });

  const projectContext = (projectInput: Project) =>
    Effect.try({
      try: () => toBoardProject(projectInput),
      catch: (cause) =>
        cause instanceof TaskBoardReadError
          ? cause
          : new TaskBoardReadError({ reason: "repository_not_supported", cause }),
    });

  const create = (projectInput: Project, input: TaskBoardCreateInput) =>
    Effect.gen(function* () {
      const project = yield* projectContext(projectInput);
      const now = yield* Clock.currentTimeMillis;
      const id = `task-${NodeCrypto.randomUUID()}`;
      const task: TaskBoardTask = {
        id,
        project: project.name,
        title: input.title,
        description: input.description ?? "",
        status: "todo",
        priority: input.priority ?? "medium",
        claimedBy: null,
        claimedAt: null,
        claimedAgent: null,
        completedBy: null,
        completedAt: null,
        completionSummary: null,
        createdAt: now,
        updatedAt: now,
        labels: input.labels ?? [project.slug],
        source: "board",
        sourceId: null,
        sourceFile: null,
        issueUrl: null,
        history: [
          {
            id: NodeCrypto.randomUUID(),
            taskId: id,
            action: "created",
            actor: input.actor,
            timestamp: now,
            note: null,
          },
        ],
      };
      return yield* persist(project, (tasks) => ({ tasks: [...tasks, task], result: task }));
    });

  const claim = (projectInput: Project, input: TaskBoardClaimInput) =>
    Effect.gen(function* () {
      const project = yield* projectContext(projectInput);
      const now = yield* Clock.currentTimeMillis;
      return yield* persist(project, (tasks) => {
        const existing = tasks.find((task) => task.id === input.taskId);
        if (!existing)
          throw new TaskBoardOperationError({
            reason: "task_not_found",
            message: "Task not found.",
          });
        if (existing.status === "done")
          throw new TaskBoardOperationError({
            reason: "task_completed",
            message: "Reopen this task before claiming it.",
          });
        if (existing.claimedBy) {
          if (existing.claimedBy === input.actor) return { tasks, result: existing };
          throw new TaskBoardOperationError({
            reason: "already_claimed",
            message: `This task is currently claimed by ${existing.claimedBy}.`,
          });
        }
        const updated = record(
          {
            ...existing,
            status: "in_progress",
            claimedBy: input.actor,
            claimedAt: now,
            claimedAgent: input.agent ?? null,
          },
          "claimed",
          input.actor,
          now,
          "Claimed task",
          input.agent,
        );
        return {
          tasks: tasks.map((task) => (task.id === existing.id ? updated : task)),
          result: updated,
        };
      });
    });

  const release = (projectInput: Project, input: TaskBoardReleaseInput) =>
    Effect.gen(function* () {
      const project = yield* projectContext(projectInput);
      const now = yield* Clock.currentTimeMillis;
      return yield* persist(project, (tasks) => {
        const existing = tasks.find((task) => task.id === input.taskId);
        if (!existing)
          throw new TaskBoardOperationError({
            reason: "task_not_found",
            message: "Task not found.",
          });
        if (!existing.claimedBy)
          throw new TaskBoardOperationError({
            reason: "not_claimed",
            message: "This task has no active claim.",
          });
        if (existing.claimedBy !== input.actor)
          throw new TaskBoardOperationError({
            reason: "claim_conflict",
            message: `Only ${existing.claimedBy} can release this claim.`,
          });
        const updated = record(
          { ...existing, status: "todo", claimedBy: null, claimedAt: null, claimedAgent: null },
          "released",
          input.actor,
          now,
          "Released task back to the queue",
        );
        return {
          tasks: tasks.map((task) => (task.id === existing.id ? updated : task)),
          result: updated,
        };
      });
    });

  const complete = (projectInput: Project, input: TaskBoardCompleteInput) =>
    Effect.gen(function* () {
      const project = yield* projectContext(projectInput);
      const now = yield* Clock.currentTimeMillis;
      return yield* persist(project, (tasks) => {
        const existing = tasks.find((task) => task.id === input.taskId);
        if (!existing)
          throw new TaskBoardOperationError({
            reason: "task_not_found",
            message: "Task not found.",
          });
        if (existing.claimedBy && existing.claimedBy !== input.actor)
          throw new TaskBoardOperationError({
            reason: "claim_conflict",
            message: `Only ${existing.claimedBy} can complete this task.`,
          });
        const completed: TaskBoardTask = {
          ...existing,
          status: "done",
          completedBy: input.actor,
          completedAt: now,
          completionSummary: input.summary ?? null,
        };
        const updated = record(
          completed,
          "completed",
          input.actor,
          now,
          input.summary ?? null,
          existing.claimedAgent ?? undefined,
        );
        return {
          tasks: tasks.map((task) => (task.id === existing.id ? updated : task)),
          result: updated,
        };
      });
    });

  const update = (projectInput: Project, input: TaskBoardUpdateInput) =>
    Effect.gen(function* () {
      const project = yield* projectContext(projectInput);
      const now = yield* Clock.currentTimeMillis;
      return yield* persist(project, (tasks) => {
        const existing = tasks.find((task) => task.id === input.taskId);
        if (!existing)
          throw new TaskBoardOperationError({
            reason: "task_not_found",
            message: "Task not found.",
          });
        const reopened =
          existing.status === "done" && input.status !== undefined && input.status !== "done";
        const status = input.status ?? existing.status;
        const updated: TaskBoardTask = {
          ...existing,
          title: input.title ?? existing.title,
          description: input.description ?? existing.description,
          status,
          priority: input.priority ?? existing.priority,
          labels: input.labels ?? existing.labels,
          ...(reopened ? { completedBy: null, completedAt: null, completionSummary: null } : {}),
        };
        const action =
          status === "blocked"
            ? "blocked"
            : reopened
              ? "reopened"
              : input.note
                ? "progress"
                : "updated";
        const recorded = record(
          updated,
          action,
          input.actor,
          now,
          input.note ?? null,
          existing.claimedAgent ?? undefined,
        );
        return {
          tasks: tasks.map((task) => (task.id === existing.id ? recorded : task)),
          result: recorded,
        };
      });
    });

  const cardCache: AiosCardCache = new Map();

  const rootOrFail = (projects: ReadonlyArray<Project>) => {
    const root = nativeRoot ?? aiosRootFor(projects);
    return root === null
      ? Effect.fail(
          new TaskBoardReadError({ reason: "aios_not_found", cause: "No AIOS tasks folder" }),
        )
      : Effect.succeed(root);
  };

  const readCards = (root: string, now: number) =>
    Effect.try({
      try: () =>
        readAiosTasks(root, { now, cache: cardCache }).map((task) => ({
          ...task,
          sourceRoot: root,
        })),
      catch: (cause) => new TaskBoardReadError({ reason: "request_failed", cause }),
    });

  const readLocalCards = (projects: ReadonlyArray<Project>, now: number) =>
    Effect.forEach(rootsFor(projects), (root) => readCards(root, now)).pipe(
      // Native storage wins when an imported copy has the same id.
      Effect.map((collections) => [
        ...new Map(
          collections
            .flat()
            .toReversed()
            .map((task) => [task.id, task]),
        ).values(),
      ]),
    );

  const workspace = (projects: ReadonlyArray<Project>) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const root = aiosRootFor(projects);
      const tasks = yield* readLocalCards(projects, now);
      return buildWorkspace({
        root,
        member: resolveMember(),
        checkedAt: now,
        projects,
        discovered: root ? discoverProjects(root) : [],
        tasks,
      });
    });

  const cardWriteFailure = (cause: unknown) =>
    cause instanceof TaskBoardOperationError
      ? cause
      : new TaskBoardOperationError({
          reason:
            cause instanceof Error && cause.message === "invalid_card"
              ? "invalid_card"
              : "storage_error",
          message: cause instanceof Error ? cause.message : String(cause),
        });

  /** Keeps the collaborators' copy of a published card in step with the local card. */
  const mirrorShared = (projects: ReadonlyArray<Project>, card: TaskBoardTask) => {
    const slug = card.projectSlug?.toLowerCase();
    const project = slug
      ? projects.find((candidate) => aiosSlugFor(candidate) === slug && githubRepository(candidate))
      : undefined;
    if (!project || card.shared !== true) return Effect.void;
    return projectContext(project).pipe(
      Effect.flatMap((boardProject) =>
        persist(boardProject, (tasks) => {
          if (!tasks.some((task) => task.id === card.id)) return { tasks, result: undefined };
          const mirrored: TaskBoardTask = {
            ...card,
            sourceRoot: undefined,
            project: boardProject.name,
            shared: true,
          };
          return {
            tasks: tasks.map((task) => (task.id === card.id ? mirrored : task)),
            result: undefined,
          };
        }),
      ),
      Effect.ignore,
    );
  };

  const boardCardUpdate = (projectInput: Project, input: TaskBoardCardUpdateInput) =>
    Effect.gen(function* () {
      const project = yield* projectContext(projectInput);
      const now = yield* Clock.currentTimeMillis;
      return yield* persist(project, (tasks) => {
        const existing = tasks.find((task) => task.id === input.taskId);
        if (!existing)
          throw new TaskBoardOperationError({
            reason: "task_not_found",
            message: "Task not found.",
          });
        const conflict = claimConflict(existing, input);
        if (conflict) throw conflict;
        const status = cardPatchFor(input, existing).status ?? existing.status;
        const claimed = typeof input.claimedBy === "string";
        const released = input.claimedBy === null;
        const reopened = existing.status === "done" && status !== "done";
        const completing = status === "done" && existing.status !== "done";
        const updated: TaskBoardTask = {
          ...existing,
          title: input.title ?? existing.title,
          due: input.due === undefined ? existing.due : input.due,
          status,
          priority: input.priority ?? existing.priority,
          claimedBy: claimed ? input.claimedBy! : released ? null : existing.claimedBy,
          claimedAt: claimed ? now : released ? null : existing.claimedAt,
          claimedAgent: claimed ? (input.agent ?? null) : released ? null : existing.claimedAgent,
          ...(completing
            ? { completedBy: input.actor, completedAt: now, completionSummary: input.note ?? null }
            : reopened
              ? { completedBy: null, completedAt: null, completionSummary: null }
              : {}),
        };
        const action = claimed
          ? "claimed"
          : released
            ? "released"
            : completing
              ? "completed"
              : status === "blocked"
                ? "blocked"
                : reopened
                  ? "reopened"
                  : input.note
                    ? "progress"
                    : "updated";
        const recorded = record(updated, action, input.actor, now, input.note ?? null, input.agent);
        return {
          tasks: tasks.map((task) => (task.id === existing.id ? recorded : task)),
          result: recorded,
        };
      });
    });

  const cardUpdate = (input: TaskBoardCardUpdateInput, projects: ReadonlyArray<Project>) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const card = (yield* readLocalCards(projects, now)).find(
        (candidate) => candidate.id === input.taskId,
      );
      const root = card?.sourceRoot;
      if (!root || !card) {
        const project = input.projectId
          ? projects.find((candidate) => candidate.id === input.projectId)
          : undefined;
        if (!project) {
          return yield* new TaskBoardOperationError({
            reason: "task_not_found",
            message: "Task not found.",
          });
        }
        return yield* boardCardUpdate(project, input);
      }
      const conflict = claimConflict(card, input);
      if (conflict) return yield* conflict;
      const updated = yield* Effect.try({
        try: () => {
          const file = card.sourceFile ? findCardFile(root, card.sourceFile) : null;
          if (!file) {
            throw new TaskBoardOperationError({
              reason: "task_not_found",
              message: "The task card file is missing.",
            });
          }
          writeCardAtomically(
            file,
            applyCardPatch(NodeFS.readFileSync(file, "utf8"), cardPatchFor(input, card), now),
          );
          const updated = readAiosTasks(root, { now, cache: cardCache }).find(
            (candidate) => candidate.id === card.id,
          );
          return updated ? { ...updated, sourceRoot: root } : undefined;
        },
        catch: cardWriteFailure,
      });
      if (!updated) {
        return yield* new TaskBoardOperationError({
          reason: "task_not_found",
          message: "Task not found after the update.",
        });
      }
      yield* mirrorShared(projects, updated);
      return updated;
    });

  const cardCreate = (input: TaskBoardCardCreateInput, projects: ReadonlyArray<Project>) =>
    Effect.gen(function* () {
      const root = yield* rootOrFail(projects);
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () => {
          const created = createCardFile(
            root,
            {
              ...input,
              ...(root === nativeRoot ? { id: `task-${NodeCrypto.randomUUID()}` } : {}),
            },
            now,
          );
          const task = cardToTask({
            fileName: created.fileName,
            raw: created.raw,
            mtimeMs: now,
            now,
          });
          if (!task) {
            throw new TaskBoardOperationError({
              reason: "invalid_card",
              message: "The new card could not be read back.",
            });
          }
          return { ...task, sourceRoot: root };
        },
        catch: cardWriteFailure,
      });
    });

  const share = (projectInput: Project, input: TaskBoardShareInput) =>
    Effect.gen(function* () {
      const project = yield* projectContext(projectInput);
      const now = yield* Clock.currentTimeMillis;
      const slug = aiosSlugFor(projectInput);
      const wanted = input.taskIds ? new Set(input.taskIds) : null;
      const cards = (yield* readLocalCards([projectInput], now)).filter(
        (card) =>
          card.projectSlug?.toLowerCase() === slug &&
          (wanted ? wanted.has(card.id) : input.shared ? isOpen(card) : card.shared === true),
      );
      if (cards.length > 0) {
        yield* persist(project, (tasks) => {
          const ids = new Set(cards.map((card) => card.id));
          const rest = tasks.filter((task) => !ids.has(task.id));
          const published = input.shared
            ? cards.map((card): TaskBoardTask => ({
                ...card,
                sourceRoot: undefined,
                project: project.name,
                shared: true,
                sharedBy: input.actor,
              }))
            : [];
          return { tasks: [...rest, ...published], result: undefined };
        });
        yield* Effect.try({
          try: () => {
            for (const card of cards) {
              const file =
                card.sourceFile && card.sourceRoot
                  ? findCardFile(card.sourceRoot, card.sourceFile)
                  : null;
              if (!file) continue;
              const raw = NodeFS.readFileSync(file, "utf8");
              const next = applyCardPatch(
                raw,
                {
                  actor: input.actor,
                  shared: input.shared,
                  sharedBy: input.shared ? input.actor : null,
                },
                now,
              );
              if (next !== raw) writeCardAtomically(file, next);
            }
          },
          catch: cardWriteFailure,
        });
      }
      return yield* list(projectInput);
    });

  return TaskBoardService.of({
    list,
    create,
    claim,
    release,
    complete,
    update,
    workspace,
    cardUpdate,
    cardCreate,
    share,
  });
});

export const layer = Layer.effect(TaskBoardService, make);
