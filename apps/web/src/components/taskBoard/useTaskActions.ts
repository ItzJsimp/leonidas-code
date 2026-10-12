import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import {
  DEFAULT_SERVER_SETTINGS,
  type EnvironmentId,
  type ProjectId,
  type TaskBoardCardUpdateInput,
  type TaskBoardWorkspaceProject,
} from "@t3tools/contracts";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useAtomValue } from "@effect/atom-react";

import { newMessageId, newThreadId } from "~/lib/utils";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { readProjects, useProjects } from "~/state/entities";
import { environmentServerConfigsAtom } from "~/state/server";
import { taskBoardCardUpdate, taskBoardShare } from "~/state/taskBoard";
import { threadEnvironment } from "~/state/threads";
import { useAtomCommand } from "~/state/use-atom-command";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";
import { buildThreadRouteParams } from "~/threadRoutes";
import { DEFAULT_INTERACTION_MODE } from "~/types";
import { toastManager } from "~/components/ui/toast";

import { buildTaskPrompt, type TaskView } from "./taskBoard.logic";
import type { TaskActions } from "./taskBoard.types";
import { claimPatch, failureText, pickLaunchProject } from "./useTaskActions.logic";

type CardPatch = Omit<TaskBoardCardUpdateInput, "taskId" | "projectId" | "actor">;

export type UseTaskActionsInput = {
  readonly environmentId: EnvironmentId | null;
  /** The signed-in member that every change is recorded against. */
  readonly member: string;
  readonly aiosRoot: string | null;
  readonly projects: ReadonlyArray<TaskBoardWorkspaceProject>;
  /** The project section selected on the page; the fallback project for sending to an agent. */
  readonly selectedSlug: string | null;
  /** Re-reads the task queries; called after every command settles. */
  readonly refresh: () => void;
};

export type UseTaskActionsResult = {
  readonly actions: TaskActions;
  /** Publishes every open card linked to the project to its shared board. */
  readonly shareSection: (projectId: ProjectId) => void;
  readonly isSharingSection: boolean;
};

/**
 * Implements the mutations the Tasks views trigger. Every call is fire and forget: failures
 * surface as a toast and the queries refresh once the command settles, so the views never hold
 * optimistic state.
 */
export function useTaskActions(input: UseTaskActionsInput): UseTaskActionsResult {
  const { environmentId, projects: sections } = input;
  const navigate = useNavigate();
  const environmentProjects = useProjects();
  const runCardUpdate = useAtomCommand(taskBoardCardUpdate, { reportFailure: false });
  const canEdit = useAtomValue(taskBoardCardUpdate.permissionAtom(environmentId));
  const runShare = useAtomCommand(taskBoardShare, { reportFailure: false });
  const startThreadTurn = useOrchestrationCommand(threadEnvironment.startTurn, {
    reportFailure: false,
  });
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const [isSharingSection, setSharingSection] = useState(false);

  const hasLaunchProject = useMemo(
    () => environmentProjects.some((project) => project.environmentId === environmentId),
    [environmentId, environmentProjects],
  );

  // Handlers read the latest props through this ref so their identity never changes.
  const latest = useRef({ input, runCardUpdate, runShare, startThreadTurn, navigate });
  latest.current = { input, runCardUpdate, runShare, startThreadTurn, navigate };

  const report = useCallback((title: string, description: string) => {
    toastManager.add({ type: "error", title, description });
  }, []);

  const reportResult = useCallback(
    (result: AtomCommandResult<unknown, unknown>, title: string): boolean => {
      if (result._tag === "Success") return true;
      if (!isAtomCommandInterrupted(result)) {
        report(title, failureText(squashAtomCommandFailure(result), "Please try again."));
      }
      return false;
    },
    [report],
  );

  const sectionProjectId = useCallback((task: TaskView): ProjectId | null => {
    const { projects } = latest.current.input;
    return projects.find((project) => project.slug === task.section)?.projectId ?? null;
  }, []);

  const track = useCallback(async (taskId: string, work: () => Promise<void>) => {
    setBusy((current) => new Set(current).add(taskId));
    try {
      await work();
    } finally {
      setBusy((current) => {
        const next = new Set(current);
        next.delete(taskId);
        return next;
      });
      latest.current.input.refresh();
    }
  }, []);

  const updateCard = useCallback(
    (task: TaskView, patch: CardPatch, failureTitle: string) => {
      const { input: current, runCardUpdate: run } = latest.current;
      if (!current.environmentId) return Promise.resolve(false);
      const environmentId = current.environmentId;
      const projectId = sectionProjectId(task);
      return run({
        environmentId,
        input: {
          taskId: task.id,
          actor: current.member,
          ...(projectId ? { projectId } : {}),
          ...patch,
        },
      }).then((result) => reportResult(result, failureTitle));
    },
    [reportResult, sectionProjectId],
  );

  const patchAction = useCallback(
    (task: TaskView, patch: CardPatch, failureTitle: string) =>
      track(task.id, async () => {
        await updateCard(task, patch, failureTitle);
      }),
    [track, updateCard],
  );

  const sendToAgent = useCallback(
    (task: TaskView) =>
      track(task.id, async () => {
        const { input: current, startThreadTurn: startTurn, navigate: go } = latest.current;
        const targetEnvironment = current.environmentId;
        if (!targetEnvironment) return;
        const projects = readProjects().filter(
          (project) => project.environmentId === targetEnvironment,
        );
        const sectionProject = current.projects.find((project) => project.slug === task.section);
        const selectedProject =
          current.selectedSlug === null
            ? null
            : (current.projects.find((project) => project.slug === current.selectedSlug) ?? null);
        const project = pickLaunchProject({
          projects,
          taskProjectId: sectionProject?.projectId ?? null,
          selectedProjectId: selectedProject?.projectId ?? null,
          aiosRoot: current.aiosRoot,
        });
        if (!project) {
          report("No project to start the agent in", "Add a project to Leonidas Code first.");
          return;
        }
        const settings =
          appAtomRegistry.get(environmentServerConfigsAtom).get(targetEnvironment)?.settings ??
          DEFAULT_SERVER_SETTINGS;
        const resolved = resolveProjectSettings(settings, project.id, project).settings;
        const modelSelection = resolved.defaultModelSelection;
        if (!modelSelection) {
          report(
            "Pick a default model first",
            `Choose a default model for ${project.title} in Settings, then send the task again.`,
          );
          return;
        }

        const threadId = newThreadId();
        const createdAt = new Date().toISOString();
        const runtimeMode = resolved.defaultRuntimeMode;
        const launch = await startTurn({
          environmentId: targetEnvironment,
          input: {
            threadId,
            message: {
              messageId: newMessageId(),
              role: "user",
              text: buildTaskPrompt(task, { aiosRoot: current.aiosRoot, member: current.member }),
              attachments: [],
            },
            modelSelection,
            titleSeed: task.title,
            runtimeMode,
            interactionMode: DEFAULT_INTERACTION_MODE,
            bootstrap: {
              createThread: {
                projectId: project.id,
                title: task.title,
                modelSelection,
                runtimeMode,
                interactionMode: DEFAULT_INTERACTION_MODE,
                branch: null,
                worktreePath: null,
                createdAt,
              },
            },
            createdAt,
          },
        });
        if (!reportResult(launch, "Could not start the agent")) return;

        const claimed = await updateCard(
          task,
          {
            status: "in_progress",
            claimedBy: current.member,
            agent: {
              providerInstanceId: modelSelection.instanceId,
              model: modelSelection.model,
              threadId,
            },
            note: "Sent to agent",
          },
          "The agent started, but the task was not updated",
        );
        if (claimed) {
          toastManager.add({ type: "success", title: "Sent to agent", description: task.title });
        }
        void go({
          to: "/$environmentId/$threadId",
          params: buildThreadRouteParams(scopeThreadRef(targetEnvironment, threadId)),
        });
      }),
    [report, reportResult, track, updateCard],
  );

  const setShared = useCallback(
    (task: TaskView, shared: boolean) =>
      track(task.id, async () => {
        const { input: current, runShare: run } = latest.current;
        const projectId = sectionProjectId(task);
        if (!current.environmentId || !projectId) {
          report("Sharing is unavailable", "Link this task to a project with a GitHub repository.");
          return;
        }
        const result = await run({
          environmentId: current.environmentId,
          input: { projectId, taskIds: [task.id], shared, actor: current.member },
        });
        reportResult(result, shared ? "Could not share the task" : "Could not stop sharing");
      }),
    [report, reportResult, sectionProjectId, track],
  );

  const shareSection = useCallback(
    (projectId: ProjectId) => {
      const { input: current, runShare: run } = latest.current;
      if (!current.environmentId) return;
      const environmentId = current.environmentId;
      setSharingSection(true);
      void run({
        environmentId,
        input: { projectId, shared: true, actor: current.member },
      })
        .then((result) => reportResult(result, "Could not share the open tasks"))
        .finally(() => {
          setSharingSection(false);
          latest.current.input.refresh();
        });
    },
    [reportResult],
  );

  const actions = useMemo<TaskActions>(
    () => ({
      canEdit,
      setStatus: (task, status) => void patchAction(task, { status }, "Could not change status"),
      setDue: (task, due) => void patchAction(task, { due }, "Could not change due date"),
      setMilestone: (task, milestone) =>
        void patchAction(task, { milestone }, "Could not change milestone"),
      setPriority: (task, priority) =>
        void patchAction(task, { priority }, "Could not change priority"),
      claim: (task) =>
        void patchAction(
          task,
          claimPatch(task, latest.current.input.member),
          "Could not claim the task",
        ),
      release: (task) => void patchAction(task, { claimedBy: null }, "Could not release the task"),
      linkProject: (task, slug) =>
        void patchAction(task, { projectSlug: slug }, "Could not change the project"),
      setShared: (task, shared) => void setShared(task, shared),
      sendToAgent: (task) => void sendToAgent(task),
      addNote: (task, note) => void patchAction(task, { note }, "Could not add the note"),
      isBusy: (taskId) => busy.has(taskId),
      canShare: (task) => {
        const project = sections.find((item) => item.slug === task.section);
        return Boolean(project?.projectId && project.repository);
      },
      canSendToAgent: () => hasLaunchProject,
    }),
    [busy, canEdit, hasLaunchProject, patchAction, sections, sendToAgent, setShared],
  );

  return { actions, shareSection, isSharingSection };
}
