import { createEnvironmentRpcQueryAtomFamily } from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";
import { connectionAtomRuntime } from "../connection/runtime";

export const layaSetupQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:laya:setup",
  tag: WS_METHODS.layaSetup,
  staleTimeMs: 0,
  idleTtlMs: 30_000,
});
