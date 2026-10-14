import type {
  TaskBoardTaskPriority,
  TaskBoardTaskStatus,
  TaskBoardWorkspaceProject,
} from "@t3tools/contracts";

import type { TaskView, TriageSuggestion } from "./taskBoard.logic";

/** Everything the Tasks views need to render and act on tasks, supplied by `TasksPage`. */
export type TaskContext = {
  readonly member: string;
  readonly now: number;
  readonly aiosRoot: string | null;
  readonly projects: ReadonlyArray<TaskBoardWorkspaceProject>;
};

/** Mutations the views can trigger. Every call is fire-and-forget; the page reports failures and refreshes. */
export type TaskActions = {
  readonly canEdit: boolean;
  readonly setStatus: (task: TaskView, status: TaskBoardTaskStatus) => void;
  readonly setPriority: (task: TaskView, priority: TaskBoardTaskPriority) => void;
  readonly setDue: (task: TaskView, due: string | null) => void;
  readonly setMilestone: (task: TaskView, milestone: string | null) => void;
  /** Claims the task for the current member and moves it to in progress. */
  readonly claim: (task: TaskView) => void;
  readonly release: (task: TaskView) => void;
  /** `null` unlinks the task from its project. */
  readonly linkProject: (task: TaskView, slug: string | null) => void;
  /** Publishes the task to (or withdraws it from) its project's shared board. */
  readonly setShared: (task: TaskView, shared: boolean) => void;
  /** Starts a new agent thread for the task, claims it and opens the thread. */
  readonly sendToAgent: (task: TaskView) => void;
  /** Starts one agent thread for several small tasks of the same project and claims them all. */
  readonly sendBatchToAgent: (tasks: ReadonlyArray<TaskView>) => void;
  /** Writes suggested effort and labels onto each card; returns how many cards changed. */
  readonly organize: (
    changes: ReadonlyArray<{ task: TaskView; suggestion: TriageSuggestion }>,
  ) => void;
  readonly addNote: (task: TaskView, note: string) => void;
  /** True while a mutation for this task is in flight. */
  readonly isBusy: (taskId: string) => boolean;
  /** Whether the task's project has a GitHub repository to share through. */
  readonly canShare: (task: TaskView) => boolean;
  /** Whether the task is linked to a project this environment can start an agent in. */
  readonly canSendToAgent: (task: TaskView) => boolean;
};
