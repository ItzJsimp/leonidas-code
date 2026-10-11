import { createEnvironmentRpcQueryAtomFamily } from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";
import { connectionAtomRuntime } from "../connection/runtime";

export const taskBoardQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:task-board",
  tag: WS_METHODS.taskBoardList,
  staleTimeMs: 5_000,
  idleTtlMs: 30_000,
});
