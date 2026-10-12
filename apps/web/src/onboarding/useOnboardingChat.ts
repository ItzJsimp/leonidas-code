import { useAtomValue } from "@effect/atom-react";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import {
  type AtomCommandResult,
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import {
  AuthOrchestrationOperateScope,
  type EnvironmentId,
  type ProjectId,
  type ThreadId,
} from "@t3tools/contracts";
import { createModelSelection } from "@t3tools/shared/model";
import { useCallback } from "react";

import { newMessageId, newProjectId, newThreadId } from "../lib/utils";
import { getDefaultProviderInstanceModel } from "../providerInstances";
import { readProjects, waitForProject } from "../state/entities";
import { projectEnvironment } from "../state/projects";
import { serverEnvironment } from "../state/server";
import { useEnvironmentScope } from "../state/session";
import { threadEnvironment } from "../state/threads";
import { useAtomCommand } from "../state/use-atom-command";
import { useOrchestrationCommand } from "../state/use-orchestration-command";
import { DEFAULT_RUNTIME_MODE } from "../types";
import { resolveOnboardingProjectId } from "./projectImport.logic";
import { getOnboardingProviderState } from "./providerReadiness.logic";

type EnsureFolderProjectResult =
  | { readonly ok: true; readonly projectId: ProjectId; readonly workspaceRoot: string }
  | { readonly ok: false; readonly message: string };

type StartChatResult =
  | { readonly ok: true; readonly threadId: ThreadId }
  | { readonly ok: false; readonly message: string };

const NO_PERMISSION_MESSAGE = "This computer does not allow creating chats.";

function folderTitle(folder: string): string {
  const segments = folder.split(/[\\/]+/).filter((segment) => segment.length > 0);
  const last = segments.at(-1);
  return last === undefined || last === "~" ? "AIOS" : last;
}

/**
 * Project and chat creation for the onboarding flow. Callers navigate to the
 * returned thread themselves; nothing here throws.
 */
export function useOnboardingChat(environmentId: EnvironmentId | undefined) {
  const canOperate = useEnvironmentScope(environmentId ?? null, AuthOrchestrationOperateScope);
  const createProject = useAtomCommand(projectEnvironment.create, { reportFailure: false });
  const createThread = useOrchestrationCommand(threadEnvironment.create, { reportFailure: false });
  const deleteThread = useOrchestrationCommand(threadEnvironment.delete, { reportFailure: false });
  const startThreadTurn = useOrchestrationCommand(threadEnvironment.startTurn, {
    reportFailure: false,
  });
  const providers = useAtomValue(
    serverEnvironment.providersValueAtom(environmentId ?? ("" as EnvironmentId)),
  );

  const ensureFolderProject = useCallback(
    async (folder: string): Promise<EnsureFolderProjectResult> => {
      if (environmentId === undefined || !canOperate) {
        return { ok: false, message: NO_PERMISSION_MESSAGE };
      }
      try {
        const existingId = resolveOnboardingProjectId(readProjects(), environmentId, {
          path: folder,
        });
        if (existingId !== null) {
          const existing = readProjects().find(
            (project) => project.environmentId === environmentId && project.id === existingId,
          );
          if (existing !== undefined) {
            return { ok: true, projectId: existing.id, workspaceRoot: existing.workspaceRoot };
          }
        }
        const projectId = newProjectId();
        const result = await createProject({
          environmentId,
          input: {
            projectId,
            title: folderTitle(folder),
            workspaceRoot: folder,
            createWorkspaceRootIfMissing: true,
            defaultModelSelection: null,
          },
        });
        if (result._tag !== "Success") {
          if (isAtomCommandInterrupted(result)) {
            return { ok: false, message: "Folder setup was interrupted. Try again." };
          }
          const error = squashAtomCommandFailure(result);
          return {
            ok: false,
            message: error instanceof Error ? error.message : "Could not set up that folder.",
          };
        }
        const created = await waitForProject(scopeProjectRef(environmentId, projectId));
        return { ok: true, projectId: created.id, workspaceRoot: created.workspaceRoot };
      } catch {
        return { ok: false, message: "Could not set up that folder." };
      }
    },
    [canOperate, createProject, environmentId],
  );

  const startChat = useCallback(
    async (args: {
      readonly projectId: ProjectId;
      readonly title: string;
      readonly prompt: string;
    }): Promise<StartChatResult> => {
      if (environmentId === undefined || !canOperate) {
        return { ok: false, message: NO_PERMISSION_MESSAGE };
      }
      const provider = providers?.find(
        (candidate) => getOnboardingProviderState(candidate) === "ready",
      );
      const model =
        provider === undefined || providers === null || providers === undefined
          ? undefined
          : getDefaultProviderInstanceModel(providers, provider.instanceId);
      if (provider === undefined || model === undefined) {
        return { ok: false, message: "Connect an agent first." };
      }
      const modelSelection = createModelSelection(provider.instanceId, model);
      const threadId = newThreadId();
      const createdAt = new Date().toISOString();
      try {
        const createResult = await createThread({
          environmentId,
          input: {
            threadId,
            projectId: args.projectId,
            title: args.title,
            modelSelection,
            runtimeMode: DEFAULT_RUNTIME_MODE,
            interactionMode: "default",
            branch: null,
            worktreePath: null,
            createdAt,
          },
        });
        let failure: AtomCommandResult<unknown, unknown> | null =
          createResult._tag === "Failure" ? createResult : null;
        if (failure === null) {
          const startResult = await startThreadTurn({
            environmentId,
            input: {
              threadId,
              message: {
                messageId: newMessageId(),
                role: "user",
                text: args.prompt,
                attachments: [],
              },
              modelSelection,
              titleSeed: args.title,
              runtimeMode: DEFAULT_RUNTIME_MODE,
              interactionMode: "default",
              createdAt,
            },
          });
          failure = startResult._tag === "Failure" ? startResult : null;
          if (failure !== null) {
            const cleanup = await deleteThread({ environmentId, input: { threadId } });
            if (cleanup._tag === "Failure" && !isAtomCommandInterrupted(cleanup)) {
              console.warn(
                "Failed to clean up onboarding thread after start failure.",
                squashAtomCommandFailure(cleanup),
              );
            }
          }
        }
        if (failure === null) return { ok: true, threadId };
        if (isAtomCommandInterrupted(failure)) {
          return { ok: false, message: "Starting the chat was interrupted. Try again." };
        }
        const error = squashAtomCommandFailure(failure);
        return {
          ok: false,
          message: error instanceof Error ? error.message : "Could not start the chat.",
        };
      } catch {
        return { ok: false, message: "Could not start the chat." };
      }
    },
    [canOperate, createThread, deleteThread, environmentId, providers, startThreadTurn],
  );

  return { canOperate, ensureFolderProject, startChat };
}
