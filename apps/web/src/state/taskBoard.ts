import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";
import { connectionAtomRuntime } from "../connection/runtime";

export const taskBoardQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:task-board",
  tag: WS_METHODS.taskBoardList,
  staleTimeMs: 5_000,
  idleTtlMs: 30_000,
});

export const taskBoardCreate = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:task-board:create",
  tag: WS_METHODS.taskBoardCreate,
});

export const taskBoardClaim = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:task-board:claim",
  tag: WS_METHODS.taskBoardClaim,
});

export const taskBoardRelease = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:task-board:release",
  tag: WS_METHODS.taskBoardRelease,
});

export const taskBoardComplete = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:task-board:complete",
  tag: WS_METHODS.taskBoardComplete,
});

export const taskBoardUpdate = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:task-board:update",
  tag: WS_METHODS.taskBoardUpdate,
});

export const taskBoardSync = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:task-board:sync",
  tag: WS_METHODS.taskBoardSync,
});
