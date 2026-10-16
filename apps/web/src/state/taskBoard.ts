import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
  createEnvironmentRpcSubscriptionAtomFamily,
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

export const aiosUsageShapeQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:task-board:aios-usage-shape",
  tag: WS_METHODS.aiosUsageShape,
  staleTimeMs: 10 * 60_000,
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

/** Recent task completions: the current list on subscribe, then a new list after each one. */
export const taskBoardCompletionsLive = createEnvironmentRpcSubscriptionAtomFamily(
  connectionAtomRuntime,
  {
    label: "environment-data:task-board:completions",
    tag: WS_METHODS.taskBoardSubscribeCompletions,
  },
);

/** The focus list: the file on subscribe, then a fresh list after each change made in the app or by an agent. */
export const focusLive = createEnvironmentRpcSubscriptionAtomFamily(connectionAtomRuntime, {
  label: "environment-data:focus",
  tag: WS_METHODS.focusSubscribe,
});

export const focusUpdate = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:focus:update",
  tag: WS_METHODS.focusUpdate,
});
