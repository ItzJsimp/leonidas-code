import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";

import { connectionAtomRuntime } from "~/connection/runtime";

/** One page of stored files. The hook asks with `refresh`, so a stale answer never shows. */
export const filesListQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:files:list",
  tag: WS_METHODS.filesList,
  staleTimeMs: 0,
  idleTtlMs: 60_000,
});

export const filesDelete = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:files:delete",
  tag: WS_METHODS.filesDelete,
});
