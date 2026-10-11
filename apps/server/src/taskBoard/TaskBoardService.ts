// @effect-diagnostics nodeBuiltinImport:off
import {
  TaskBoardIssue,
  TaskBoardOperationError,
  TaskBoardProjectDatabase,
  TaskBoardReadError,
  type Project,
  type TaskBoardAgent,
  type TaskBoardClaimInput,
  type TaskBoardCompleteInput,
  type TaskBoardCreateInput,
  type TaskBoardHistoryEntry,
  type TaskBoardReleaseInput,
  type TaskBoardSnapshot,
  type TaskBoardSyncInput,
  type TaskBoardTask,
  type TaskBoardTaskPriority,
  type TaskBoardTaskStatus,
  type TaskBoardUpdateInput,
  repositoryGroupingKeyOf,
} from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as ProcessRunner from "../processRunner.ts";

const ISSUE_LIMIT = 200;
const DATABASE_VERSION = 1;
const databaseFile = (slug: string) => `.leonidas/task-board/${slug}.json`;
const decodeIssues = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Array(TaskBoardIssue)),
);
const decodeDatabaseJson = Schema.decodeUnknownSync(
  Schema.fromJsonString(TaskBoardProjectDatabase),
);
const encodeDatabaseJson = Schema.encodeSync(Schema.fromJsonString(TaskBoardProjectDatabase));
const decodeContentsResponse = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({
      content: Schema.String,
      sha: Schema.String,
    }),
  ),
);
const decodeBranchRefs = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Array(
      Schema.Struct({
        ref: Schema.String,
      }),
    ),
  ),
);
const decodeRepository = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({
      default_branch: Schema.String,
    }),
  ),
);
const decodeGitRef = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({
      object: Schema.Struct({ sha: Schema.String }),
    }),
  ),
);

type BoardProject = {
  readonly projectId: Project["id"];
  readonly name: string;
  readonly slug: string;
  readonly titleSlug: string;
  readonly workspaceRoot: string;
  readonly repository: string;
  readonly owner: string;
  readonly repo: string;
};
type Database = typeof TaskBoardProjectDatabase.Type;
type TaskBoardCreateOperation = Omit<TaskBoardCreateInput, "projectId">;
type TaskBoardClaimOperation = Omit<TaskBoardClaimInput, "projectId">;
type TaskBoardReleaseOperation = Omit<TaskBoardReleaseInput, "projectId">;
type TaskBoardCompleteOperation = Omit<TaskBoardCompleteInput, "projectId">;
type TaskBoardUpdateOperation = Omit<TaskBoardUpdateInput, "projectId">;
type TaskBoardSyncOperation = Omit<TaskBoardSyncInput, "projectId">;
type LoadedDatabase = { readonly data: Database; readonly sha: string | null };
type GhResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
  readonly timedOut: boolean;
};

function sameAgent(left: TaskBoardAgent | null, right: TaskBoardAgent | null): boolean {
  if (left === null || right === null) return left === right;
  const optionEntries = (options: TaskBoardAgent["options"]) => {
    if (options === undefined) return [];
    if (Array.isArray(options)) return options;
    return Object.entries(options).flatMap(([id, value]) =>
      typeof value === "string" || typeof value === "boolean" ? [{ id, value }] : [],
    );
  };
  const leftOptions = optionEntries(left.options);
  const rightOptions = optionEntries(right.options);
  return (
    left.providerInstanceId === right.providerInstanceId &&
    left.model === right.model &&
    left.threadId === right.threadId &&
    leftOptions.length === rightOptions.length &&
    leftOptions.every((option, index) => {
      const other = rightOptions[index];
      return other !== undefined && option.id === other.id && option.value === other.value;
    })
  );
}

function dateOnly(timestamp: number): string {
  return Option.match(DateTime.make(timestamp), {
    onNone: () => "",
    onSome: (dateTime) => DateTime.formatIso(dateTime).slice(0, 10),
  });
}

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
  const repositoryKey = repositoryGroupingKeyOf(identity);
  const repositoryParts = repositoryKey.split("/").filter(Boolean);
  const owner = repositoryParts.at(-2) ?? identity.owner;
  const repo = repositoryParts.at(-1) ?? identity.name;
  return {
    projectId: project.id,
    name: project.title,
    // Shared task state follows the checkout's own remote when it tracks an upstream.
    slug: slugify(repo),
    titleSlug: slugify(project.title),
    workspaceRoot: project.workspaceRoot,
    repository: `${owner}/${repo}`,
    owner,
    repo,
  };
}

function taskSummary(tasks: ReadonlyArray<TaskBoardTask>) {
  return {
    total: tasks.length,
    todo: tasks.filter((task) => task.status === "todo").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
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

function aiosRootFor(project: BoardProject): string | null {
  for (const value of [process.env.LEONIDAS_AIOS_ROOT, process.env.AIOS_ROOT]) {
    if (value && NodeFS.existsSync(value) && NodeFS.statSync(value).isDirectory())
      return NodePath.resolve(value);
  }
  const parent = NodePath.resolve(project.workspaceRoot, "..", "..");
  return NodeFS.existsSync(NodePath.join(parent, "tasks")) ? parent : null;
}

function parseFrontmatter(raw: string): Record<string, string> | null {
  if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) return null;
  const end = raw.indexOf("\n---", 4);
  if (end < 0) return null;
  const values: Record<string, string> = {};
  for (const line of raw.slice(4, end).split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match?.[1] || match[2] === undefined) continue;
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      // Inverse of cardContents' quoting: \n is a newline; any other escaped character stands for itself.
      value = value
        .slice(1, -1)
        .replace(/\\(.)/g, (_, char: string) => (char === "n" ? "\n" : char));
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function statusFromCard(value: string | undefined): TaskBoardTaskStatus {
  switch (value?.trim().toLowerCase()) {
    case "in progress":
    case "in_progress":
    case "active":
      return "in_progress";
    case "blocked":
      return "blocked";
    case "done":
    case "completed":
    case "finished":
      return "done";
    default:
      return "todo";
  }
}

function priorityFromCard(value: string | undefined): TaskBoardTaskPriority {
  switch (value?.trim().toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "low":
      return "low";
    default:
      return "medium";
  }
}

function projectSlugFromCard(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/^projects?[\\/]+/i, "").replace(/^project[-_]/i, "");
  return slugify(normalized.split(/[\\/]/)[0] ?? "");
}

function cardTask(
  fileName: string,
  raw: string,
  project: BoardProject,
  now: number,
): TaskBoardTask | null {
  const metadata = parseFrontmatter(raw);
  if (!metadata || (metadata.type && metadata.type !== "task")) return null;
  const declaredProject = projectSlugFromCard(
    metadata.project ?? metadata.repository ?? metadata.repo,
  );
  if (declaredProject !== project.slug && declaredProject !== project.titleSlug) return null;
  const marker = raw.indexOf("\n---", 4);
  const description = marker < 0 ? "" : raw.slice(marker + 4).trim();
  const sourceId = metadata.id || NodePath.basename(fileName, ".md");
  const linkedTaskId = metadata.task_board_id;
  const id =
    linkedTaskId && /^[A-Za-z0-9._-]{1,120}$/.test(linkedTaskId)
      ? linkedTaskId
      : `aios-${slugify(sourceId)}-${NodeCrypto.createHash("sha256").update(sourceId).digest("hex").slice(0, 8)}`;
  const status = statusFromCard(metadata.status);
  const accountable = metadata.accountable || metadata.owner || "Unassigned";
  const claimed = status === "in_progress";
  const touched = metadata.last_touched ? Date.parse(metadata.last_touched) : now;
  const completed = status === "done";
  const title =
    metadata.name || metadata.title || NodePath.basename(fileName, ".md").replace(/-/g, " ");
  const created = metadata.created ? Date.parse(metadata.created) : now;
  return {
    id,
    project: project.name,
    title,
    description,
    status,
    priority: priorityFromCard(metadata.priority),
    claimedBy: claimed ? metadata.claimed_by || accountable : null,
    claimedAt: claimed && Number.isFinite(touched) ? touched : null,
    claimedAgent: null,
    completedBy: completed ? accountable : null,
    completedAt: completed && Number.isFinite(touched) ? touched : null,
    completionSummary: null,
    createdAt: Number.isFinite(created) ? created : now,
    updatedAt: Number.isFinite(touched) ? touched : now,
    labels: [project.slug],
    source: "aios_card",
    sourceId,
    sourceFile: NodePath.basename(fileName),
    issueUrl: null,
    history: [
      {
        id: NodeCrypto.randomUUID(),
        taskId: id,
        action: "imported",
        actor: "AIOS card",
        timestamp: now,
        note: `Imported ${NodePath.basename(fileName)}`,
      },
    ],
  };
}

// Written into each card so a later sync can tell a person's edit from the board's own last write, without comparing clocks.
function cardFingerprint(
  task: Pick<TaskBoardTask, "status" | "priority" | "title" | "description">,
): string {
  return NodeCrypto.createHash("sha256")
    .update(JSON.stringify([task.status, task.priority, task.title, task.description]))
    .digest("hex")
    .slice(0, 16);
}

function cardContents(task: TaskBoardTask, project: BoardProject, previous = ""): string {
  const quote = (value: string) =>
    `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n")}"`;
  // A label the card already uses for the same state is kept as written, so a sync never rewrites it.
  const previousMeta = parseFrontmatter(previous) ?? {};
  const statusLabel =
    task.status === "in_progress"
      ? "In progress"
      : task.status === "done"
        ? "Done"
        : task.status === "blocked"
          ? "Blocked"
          : "Not started";
  const status =
    previousMeta.status && statusFromCard(previousMeta.status) === task.status
      ? previousMeta.status
      : statusLabel;
  const priorityLabel = task.priority[0]!.toUpperCase() + task.priority.slice(1);
  const priority =
    previousMeta.priority && priorityFromCard(previousMeta.priority) === task.priority
      ? previousMeta.priority
      : priorityLabel;
  const projectLabel =
    previousMeta.project && projectSlugFromCard(previousMeta.project) === project.slug
      ? previousMeta.project
      : project.slug;
  const accountable =
    previousMeta.accountable || task.claimedBy || task.completedBy || "Unassigned";
  const marker = previous.indexOf("\n---", 4);
  const previousHeader = marker < 0 ? "" : previous.slice(4, marker);
  const managedKeys = new Set([
    "type",
    "task_board_id",
    "id",
    "name",
    "title",
    "status",
    "owner",
    "accountable",
    "claimed_by",
    "priority",
    "created",
    "last_touched",
    "project",
    "board_fingerprint",
  ]);
  const preserved = previousHeader.split(/\r?\n/).filter((line) => {
    const key = /^([A-Za-z0-9_-]+):/.exec(line)?.[1];
    return key === undefined || !managedKeys.has(key);
  });
  const body =
    task.source === "aios_card"
      ? task.description
      : [`# ${task.title}`, "", task.description].join("\n");
  return [
    "---",
    ...preserved,
    "type: task",
    `task_board_id: ${quote(task.id)}`,
    `id: ${quote(task.sourceId ?? task.id)}`,
    `name: ${quote(task.title)}`,
    `status: ${quote(status)}`,
    `owner: ${quote(previousMeta.owner ?? "leonidas")}`,
    `accountable: ${quote(accountable)}`,
    `claimed_by: ${quote(task.claimedBy ?? "")}`,
    `priority: ${quote(priority)}`,
    `created: ${dateOnly(task.createdAt)}`,
    `last_touched: ${dateOnly(task.updatedAt)}`,
    `project: ${quote(projectLabel)}`,
    `board_fingerprint: ${quote(cardFingerprint(task))}`,
    "---",
    body,
  ].join("\n");
}

function safeTaskFilename(value: string | null): string | null {
  return value && /^[A-Za-z0-9._-]{1,180}\.md$/.test(value) ? value : null;
}

function writeProjectCards(
  root: string,
  project: BoardProject,
  tasks: ReadonlyArray<TaskBoardTask>,
): void {
  const tasksPath = NodePath.join(root, "tasks");
  const names = new Set(NodeFS.readdirSync(tasksPath).filter((name) => name.endsWith(".md")));
  const contents = new Map<string, string>();
  for (const name of names) {
    try {
      contents.set(name, NodeFS.readFileSync(NodePath.join(tasksPath, name), "utf8"));
    } catch {
      // An unreadable card must not prevent the other project tasks from syncing.
    }
  }

  for (const task of tasks) {
    const matchingManaged = [...contents].find(([, raw]) => {
      const metadata = parseFrontmatter(raw);
      return (
        metadata?.task_board_id === task.id &&
        projectSlugFromCard(metadata.project) === project.slug
      );
    })?.[0];
    const sourceName = safeTaskFilename(task.sourceFile);
    const sourceMetadata = sourceName ? parseFrontmatter(contents.get(sourceName) ?? "") : null;
    const matchingSource =
      sourceName &&
      sourceMetadata?.id === task.sourceId &&
      (sourceMetadata.task_board_id === undefined || sourceMetadata.task_board_id === task.id) &&
      projectSlugFromCard(sourceMetadata.project) === project.slug
        ? sourceName
        : undefined;
    let target = matchingSource ?? matchingManaged;
    if (!target) {
      const base = `task-board-${slugify(task.id)}`;
      const hash = NodeCrypto.createHash("sha256").update(task.id).digest("hex").slice(0, 8);
      target = `${base}.md`;
      if (names.has(target)) target = `${base}-${hash}.md`;
      let suffix = 2;
      while (names.has(target)) target = `${base}-${hash}-${suffix++}.md`;
    }
    const previous = contents.get(target) ?? "";
    const next = cardContents(task, project, previous);
    if (next !== previous) NodeFS.writeFileSync(NodePath.join(tasksPath, target), next, "utf8");
    names.add(target);
    contents.set(target, next);
  }
}

function databaseFromContents(raw: string): LoadedDatabase {
  const response = decodeContentsResponse(raw);
  const json = Buffer.from(response.content.replace(/\s/g, ""), "base64").toString("utf8");
  return { data: decodeDatabaseJson(json), sha: response.sha };
}

export class TaskBoardService extends Context.Service<
  TaskBoardService,
  {
    readonly list: (project: Project) => Effect.Effect<TaskBoardSnapshot, TaskBoardReadError>;
    readonly create: (
      project: Project,
      input: TaskBoardCreateOperation,
    ) => Effect.Effect<TaskBoardTask, TaskBoardReadError | TaskBoardOperationError>;
    readonly claim: (
      project: Project,
      input: TaskBoardClaimOperation,
    ) => Effect.Effect<TaskBoardTask, TaskBoardReadError | TaskBoardOperationError>;
    readonly release: (
      project: Project,
      input: TaskBoardReleaseOperation,
    ) => Effect.Effect<TaskBoardTask, TaskBoardReadError | TaskBoardOperationError>;
    readonly complete: (
      project: Project,
      input: TaskBoardCompleteOperation,
    ) => Effect.Effect<TaskBoardTask, TaskBoardReadError | TaskBoardOperationError>;
    readonly update: (
      project: Project,
      input: TaskBoardUpdateOperation,
    ) => Effect.Effect<TaskBoardTask, TaskBoardReadError | TaskBoardOperationError>;
    readonly sync: (
      project: Project,
      input: TaskBoardSyncOperation,
    ) => Effect.Effect<TaskBoardSnapshot, TaskBoardReadError | TaskBoardOperationError>;
  }
>()("t3/taskBoard/TaskBoardService") {}

const make = Effect.gen(function* () {
  const processes = yield* ProcessRunner.ProcessRunner;

  const runGh = (args: ReadonlyArray<string>, allowNotFound = false) =>
    processes
      .run({ command: "gh", args, timeout: "30 seconds", maxOutputBytes: 4 * 1024 * 1024 })
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
      String(ISSUE_LIMIT),
      "--json",
      "number,title,url,body,createdAt,updatedAt,state,labels,assignees",
    ]).pipe(
      Effect.catchTags({
        TaskBoardReadError: (error) =>
          error.reason === "issues_disabled" ? Effect.succeed(null) : Effect.fail(error),
      }),
      Effect.flatMap((result) =>
        result === null
          ? Effect.succeed([])
          : decodeIssues(result.stdout).pipe(
              Effect.mapError(
                (cause) => new TaskBoardReadError({ reason: "invalid_response", cause }),
              ),
            ),
      ),
    );

  const updateIssueState = (
    project: BoardProject,
    task: TaskBoardTask,
    state: "open" | "closed",
  ) => {
    if (task.source !== "github_issue" || !task.sourceId || !/^\d+$/.test(task.sourceId)) {
      return Effect.void;
    }
    return runGh([
      "api",
      "--method",
      "PATCH",
      `repos/${project.repository}/issues/${task.sourceId}`,
      "-f",
      `state=${state}`,
    ]).pipe(Effect.asVoid);
  };

  const branchName = (project: BoardProject) =>
    `task-board-${NodeCrypto.createHash("sha256").update(project.repository.toLowerCase()).digest("hex").slice(0, 20)}`;

  const findBranch = (project: BoardProject) =>
    runGh(
      ["api", `repos/${project.repository}/git/matching-refs/heads/${branchName(project)}`],
      true,
    ).pipe(
      Effect.flatMap((result) => {
        if (!result) return Effect.succeed(false);
        try {
          const refs = decodeBranchRefs(result.stdout);
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
        defaultBranch = decodeRepository(repository!.stdout).default_branch;
      } catch (cause) {
        return yield* new TaskBoardReadError({ reason: "invalid_response", cause });
      }
      const base = yield* runGh([
        "api",
        `repos/${project.repository}/git/ref/heads/${defaultBranch}`,
      ]);
      let sha: string;
      try {
        sha = decodeGitRef(base!.stdout).object.sha;
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
          timeout: "30 seconds",
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
      if (!(yield* findBranch(project))) {
        return {
          data: { version: DATABASE_VERSION, tasks: [] },
          sha: null,
        } satisfies LoadedDatabase;
      }
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
    expectedSha: string | null,
  ) =>
    Effect.gen(function* () {
      const path = databaseFile(project.slug);
      const json = encodeDatabaseJson({ version: DATABASE_VERSION, tasks });
      const content = Buffer.from(json, "utf8").toString("base64");
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
      if (expectedSha) args.push("--raw-field", `sha=${expectedSha}`);
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
      const taskId = `github-${issue.number}`;
      return {
        id: taskId,
        project: project.name,
        title: issue.title,
        description: issue.body ?? "",
        status: issue.state === "CLOSED" ? "done" : "todo",
        priority: priorityFromLabels(issue.labels),
        claimedBy: null,
        claimedAt: null,
        claimedAgent: null,
        completedBy: issue.state === "CLOSED" ? "GitHub" : null,
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
            id: `github-${issue.number}-imported`,
            taskId,
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
    const external = new Map(
      issuesAsTasks(project, issues).map((task) => [task.id, task] as const),
    );
    const all = new Map(external);
    for (const task of stored) {
      const issue = external.get(task.id);
      const issueIsClosed = issue?.status === "done";
      const issueWasClosedExternally = issue?.status === "todo" && task.completedBy === "GitHub";
      all.set(
        task.id,
        issue
          ? {
              ...task,
              project: project.name,
              title: issue.title,
              description: issue.description,
              labels: issue.labels,
              issueUrl: issue.issueUrl,
              status: issueIsClosed ? "done" : issueWasClosedExternally ? "todo" : task.status,
              claimedBy: issueIsClosed ? null : task.claimedBy,
              claimedAt: issueIsClosed ? null : task.claimedAt,
              claimedAgent: issueIsClosed ? null : task.claimedAgent,
              completedBy: issueIsClosed
                ? (task.completedBy ?? "GitHub")
                : issueWasClosedExternally
                  ? null
                  : task.completedBy,
              completedAt: issueIsClosed
                ? (task.completedAt ?? issue.completedAt)
                : issueWasClosedExternally
                  ? null
                  : task.completedAt,
              completionSummary: issueWasClosedExternally ? null : task.completionSummary,
            }
          : { ...task, project: project.name },
      );
    }
    return [...all.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  };

  const snapshot = (
    project: BoardProject,
    tasks: ReadonlyArray<TaskBoardTask>,
    issues: ReadonlyArray<TaskBoardIssue>,
  ) =>
    Effect.map(
      Clock.currentTimeMillis,
      (checkedAt) =>
        ({
          projectId: project.projectId,
          project: project.name,
          repository: project.repository,
          tasks,
          issues,
          checkedAt,
          limit: ISSUE_LIMIT,
          aiosConnected: aiosRootFor(project) !== null,
          summary: taskSummary(tasks),
        }) satisfies TaskBoardSnapshot,
    );

  const projectContext = (projectInput: Project) =>
    Effect.try({
      try: () => toBoardProject(projectInput),
      catch: (cause) =>
        Schema.is(TaskBoardReadError)(cause)
          ? cause
          : new TaskBoardReadError({ reason: "repository_not_supported", cause }),
    });

  const list = (projectInput: Project) =>
    Effect.gen(function* () {
      const project = yield* projectContext(projectInput);
      const [database, issues] = yield* Effect.all([loadDatabase(project), readIssues(project)]);
      return yield* snapshot(project, mergeTasks(project, database.data.tasks, issues), issues);
    });

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
        const current = mergeTasks(project, database.data.tasks, issues);
        const outcome = yield* Effect.try({
          try: () => apply(current),
          catch: (cause) =>
            Schema.is(TaskBoardOperationError)(cause)
              ? cause
              : new TaskBoardOperationError({
                  reason: "invalid_data",
                  message: "The task change could not be applied.",
                }),
        });
        if (outcome.tasks === current) return outcome.result;
        if (yield* writeDatabase(project, outcome.tasks, database.sha)) return outcome.result;
      }
      return yield* new TaskBoardReadError({
        reason: "request_failed",
        cause: "Concurrent task edits; retry the operation.",
      });
    });

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

  const create = (projectInput: Project, input: TaskBoardCreateOperation) =>
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
            ...(input.agent ? { agent: input.agent } : {}),
          },
        ],
      };
      return yield* persist(project, (tasks) => ({ tasks: [...tasks, task], result: task }));
    });

  const claim = (projectInput: Project, input: TaskBoardClaimOperation) =>
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
        if (existing.status === "done") {
          throw new TaskBoardOperationError({
            reason: "task_completed",
            message: "Reopen this task before claiming it.",
          });
        }
        if (existing.claimedBy) {
          const sameThread =
            input.agent?.threadId !== undefined &&
            existing.claimedAgent?.threadId === input.agent.threadId;
          if (existing.claimedBy === input.actor && (!input.agent || sameThread)) {
            const activeAgent = input.agent ?? existing.claimedAgent;
            if (sameAgent(existing.claimedAgent, activeAgent)) {
              return { tasks, result: existing };
            }
            const refreshed = record(
              { ...existing, claimedAgent: activeAgent },
              "claimed",
              input.actor,
              now,
              "Refreshed the active agent assignment",
              activeAgent ?? undefined,
            );
            return {
              tasks: tasks.map((task) => (task.id === existing.id ? refreshed : task)),
              result: refreshed,
            };
          }
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

  const assertClaimOwner = (existing: TaskBoardTask, actor: string, agent?: TaskBoardAgent) => {
    if (!existing.claimedBy) {
      throw new TaskBoardOperationError({
        reason: "not_claimed",
        message: "This task has no active claim.",
      });
    }
    if (
      existing.claimedBy !== actor ||
      (agent?.threadId && existing.claimedAgent?.threadId !== agent.threadId)
    ) {
      throw new TaskBoardOperationError({
        reason: "claim_conflict",
        message: `Only the current claimant can update this task.`,
      });
    }
  };

  const release = (projectInput: Project, input: TaskBoardReleaseOperation) =>
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
        assertClaimOwner(existing, input.actor, input.agent);
        const updated = record(
          {
            ...existing,
            status: "todo",
            claimedBy: null,
            claimedAt: null,
            claimedAgent: null,
          },
          "released",
          input.actor,
          now,
          "Released task back to the queue",
          input.agent ?? undefined,
        );
        return {
          tasks: tasks.map((task) => (task.id === existing.id ? updated : task)),
          result: updated,
        };
      });
    });

  const complete = (projectInput: Project, input: TaskBoardCompleteOperation) =>
    Effect.gen(function* () {
      const project = yield* projectContext(projectInput);
      const now = yield* Clock.currentTimeMillis;
      const task = yield* persist(project, (tasks) => {
        const existing = tasks.find((task) => task.id === input.taskId);
        if (!existing)
          throw new TaskBoardOperationError({
            reason: "task_not_found",
            message: "Task not found.",
          });
        if (existing.status === "done") {
          if (existing.completedBy === input.actor) return { tasks, result: existing };
          throw new TaskBoardOperationError({
            reason: "task_completed",
            message: "This task is already complete.",
          });
        }
        if (existing.claimedBy && existing.claimedBy !== input.actor) {
          throw new TaskBoardOperationError({
            reason: "claim_conflict",
            message: `Only ${existing.claimedBy} can complete this task.`,
          });
        }
        if (input.agent?.threadId && existing.claimedAgent?.threadId !== input.agent.threadId) {
          throw new TaskBoardOperationError({
            reason: "claim_conflict",
            message: "Only the claiming agent can complete this task.",
          });
        }
        const completed: TaskBoardTask = {
          ...existing,
          status: "done",
          claimedBy: null,
          claimedAt: null,
          claimedAgent: null,
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
          input.agent ?? existing.claimedAgent ?? undefined,
        );
        return {
          tasks: tasks.map((task) => (task.id === existing.id ? updated : task)),
          result: updated,
        };
      });
      yield* updateIssueState(project, task, "closed");
      return task;
    });

  const update = (projectInput: Project, input: TaskBoardUpdateOperation) =>
    Effect.gen(function* () {
      const project = yield* projectContext(projectInput);
      const now = yield* Clock.currentTimeMillis;
      const task = yield* persist(project, (tasks) => {
        const existing = tasks.find((task) => task.id === input.taskId);
        if (!existing)
          throw new TaskBoardOperationError({
            reason: "task_not_found",
            message: "Task not found.",
          });
        if (input.agent) assertClaimOwner(existing, input.actor, input.agent);
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
          input.agent ?? existing.claimedAgent ?? undefined,
        );
        return {
          tasks: tasks.map((task) => (task.id === existing.id ? recorded : task)),
          result: recorded,
        };
      });
      if (task.source === "github_issue" && input.status !== undefined) {
        yield* updateIssueState(project, task, input.status === "done" ? "closed" : "open");
      }
      return task;
    });

  // An AIOS card edit newer than the board's last change becomes the task's state, recorded like any other change.
  const adoptCardEdit = (
    stored: TaskBoardTask,
    card: TaskBoardTask,
    actor: string,
    timestamp: number,
  ): TaskBoardTask => {
    const completed = card.status === "done" && stored.status !== "done";
    const reopened = card.status !== "done" && stored.status === "done";
    const updated: TaskBoardTask = {
      ...stored,
      title: card.title,
      description: card.description,
      priority: card.priority,
      status: card.status,
      ...(card.status === "todo" || completed
        ? { claimedBy: null, claimedAt: null, claimedAgent: null }
        : {}),
      ...(completed ? { completedBy: actor, completedAt: timestamp } : {}),
      ...(reopened ? { completedBy: null, completedAt: null, completionSummary: null } : {}),
    };
    return record(
      updated,
      completed ? "completed" : "updated",
      actor,
      timestamp,
      "Edited in the AIOS card",
    );
  };

  const sync = (projectInput: Project, input: TaskBoardSyncOperation) =>
    Effect.gen(function* () {
      const project = yield* projectContext(projectInput);
      const root = aiosRootFor(project);
      if (!root) {
        return yield* new TaskBoardReadError({
          reason: "request_failed",
          cause:
            "Could not find this environment's AIOS tasks folder. Set LEONIDAS_AIOS_ROOT or AIOS_ROOT to its root.",
        });
      }
      const tasksPath = NodePath.join(root, "tasks");
      const files = yield* Effect.try({
        try: () => {
          NodeFS.mkdirSync(tasksPath, { recursive: true });
          return NodeFS.readdirSync(tasksPath, { withFileTypes: true }).filter(
            (entry) => entry.isFile() && entry.name.endsWith(".md"),
          );
        },
        catch: (cause) => new TaskBoardReadError({ reason: "request_failed", cause }),
      });
      const now = yield* Clock.currentTimeMillis;
      const imported = files.flatMap((file) => {
        try {
          const raw = NodeFS.readFileSync(NodePath.join(tasksPath, file.name), "utf8");
          const task = cardTask(file.name, raw, project, now);
          return task ? [{ task, recorded: parseFrontmatter(raw)?.board_fingerprint ?? null }] : [];
        } catch {
          return [];
        }
      });
      yield* persist(project, (tasks) => {
        let changed = false;
        const next = [...tasks];
        for (const { task, recorded } of imported) {
          const index = next.findIndex((entry) => entry.id === task.id);
          if (index < 0) {
            next.push({
              ...task,
              history: task.history.map((event) => ({
                ...event,
                actor: input.actor,
                ...(input.agent ? { agent: input.agent } : {}),
              })),
            });
            changed = true;
            continue;
          }
          // The card no longer matches what the board last wrote to it, so a person edited it.
          const stored = next[index]!;
          const edited =
            stored.source === "aios_card" &&
            recorded !== cardFingerprint(task) &&
            cardFingerprint(task) !== cardFingerprint(stored);
          if (!edited) continue;
          next[index] = adoptCardEdit(stored, task, input.actor, now);
          changed = true;
        }
        return { tasks: changed ? next : tasks, result: undefined };
      });
      const [database, issues] = yield* Effect.all([loadDatabase(project), readIssues(project)]);
      const tasks = mergeTasks(project, database.data.tasks, issues);
      yield* Effect.try({
        // GitHub issues stay in GitHub; only board and AIOS-card tasks get a card.
        try: () =>
          writeProjectCards(
            root,
            project,
            tasks.filter((task) => task.source !== "github_issue"),
          ),
        catch: (cause) => new TaskBoardReadError({ reason: "request_failed", cause }),
      });
      return yield* snapshot(project, tasks, issues);
    });

  return TaskBoardService.of({ list, create, claim, release, complete, update, sync });
});

export const layer = Layer.effect(TaskBoardService, make);
