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

export const taskBoardWorkspaceQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:task-board:workspace",
  tag: WS_METHODS.taskBoardWorkspace,
  staleTimeMs: 3_000,
  idleTtlMs: 30_000,
});

export const taskBoardCardUpdate = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:task-board:card-update",
  tag: WS_METHODS.taskBoardCardUpdate,
});

export const taskBoardCardCreate = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:task-board:card-create",
  tag: WS_METHODS.taskBoardCardCreate,
});

export const taskBoardShare = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:task-board:share",
  tag: WS_METHODS.taskBoardShare,
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

export const inboxDrop = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:inbox:drop",
  tag: WS_METHODS.inboxDrop,
});

export const inboxUndo = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:inbox:undo",
  tag: WS_METHODS.inboxUndo,
});

export const taskBoardAiosDetectQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:task-board:aios-detect",
  tag: WS_METHODS.taskBoardAiosDetect,
  staleTimeMs: 30_000,
  idleTtlMs: 30_000,
});

export const taskBoardHomeQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:task-board:home",
  tag: WS_METHODS.taskBoardHome,
  staleTimeMs: 30_000,
  idleTtlMs: 60_000,
});

export const taskBoardHomeWeatherQuery = createEnvironmentRpcQueryAtomFamily(
  connectionAtomRuntime,
  {
    label: "environment-data:task-board:home-weather",
    tag: WS_METHODS.taskBoardHomeWeather,
    staleTimeMs: 10 * 60_000,
    idleTtlMs: 10 * 60_000,
  },
);

export const taskBoardHomeNewsQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:task-board:home-news",
  tag: WS_METHODS.taskBoardHomeNews,
  staleTimeMs: 15 * 60_000,
  idleTtlMs: 15 * 60_000,
});

export const taskBoardAiosConfirm = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:task-board:aios-confirm",
  tag: WS_METHODS.taskBoardAiosConfirm,
});
