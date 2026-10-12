import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";
import { connectionAtomRuntime } from "../connection/runtime";

export const devPreviewStatusQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:dev-preview:status",
  tag: WS_METHODS.devPreviewStatus,
  staleTimeMs: 1_000,
  idleTtlMs: 10_000,
});

export const devPreviewStart = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:dev-preview:start",
  tag: WS_METHODS.devPreviewStart,
});

export const devPreviewStop = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:dev-preview:stop",
  tag: WS_METHODS.devPreviewStop,
});
