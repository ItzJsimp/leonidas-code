import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";

import { connectionAtomRuntime } from "../connection/runtime";

/** Every AIOS workspace picture the server keeps, as data URLs keyed by workspace id. */
export const workspacePicturesQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:aios-workspace-pictures",
  tag: WS_METHODS.aiosWorkspacePicturesList,
  // Pictures change only through this client or another one by hand; a long stale time keeps the
  // few kilobytes off the socket.
  staleTimeMs: 5 * 60_000,
  idleTtlMs: 10 * 60_000,
});

export const workspacePictureSet = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:aios-workspace-pictures:set",
  tag: WS_METHODS.aiosWorkspacePictureSet,
});

export const workspacePictureRemove = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:aios-workspace-pictures:remove",
  tag: WS_METHODS.aiosWorkspacePictureRemove,
});
