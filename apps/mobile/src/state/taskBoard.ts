import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";
import { connectionAtomRuntime } from "../connection/runtime";

/** The environment's own task cards (AIOS and native), read from disk with no GitHub round trip. */
export const taskBoardWorkspaceQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "mobile:task-board:workspace",
  tag: WS_METHODS.taskBoardWorkspace,
  staleTimeMs: 3_000,
  idleTtlMs: 30_000,
});

export const taskBoardCardCreate = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "mobile:task-board:card-create",
  tag: WS_METHODS.taskBoardCardCreate,
});

export const taskBoardCardUpdate = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "mobile:task-board:card-update",
  tag: WS_METHODS.taskBoardCardUpdate,
});
