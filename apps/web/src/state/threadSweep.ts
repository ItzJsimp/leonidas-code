import { createEnvironmentRpcQueryAtomFamily } from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";
import { connectionAtomRuntime } from "../connection/runtime";

export const threadSweepQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:thread-sweep:run",
  tag: WS_METHODS.threadSweepRun,
  staleTimeMs: 0,
  idleTtlMs: 30_000,
});

export const threadHandoffQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:thread-sweep:handoff",
  tag: WS_METHODS.threadSweepHandoff,
  staleTimeMs: 0,
  idleTtlMs: 30_000,
});
