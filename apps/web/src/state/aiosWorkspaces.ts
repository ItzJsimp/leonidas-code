import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";
import { connectionAtomRuntime } from "../connection/runtime";

/** Every AIOS folder the server found, with its workspace file state (ADR-0080). */
export const aiosWorkspacesQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:aios-workspaces",
  tag: WS_METHODS.aiosWorkspacesList,
  staleTimeMs: 10_000,
  idleTtlMs: 60_000,
});

/** The setup prompt: writes workspace.json into a listed folder. */
export const aiosWorkspaceInit = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:aios-workspaces:init",
  tag: WS_METHODS.aiosWorkspacesInit,
});
