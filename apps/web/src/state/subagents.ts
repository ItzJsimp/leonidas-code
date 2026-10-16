import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
  createEnvironmentRpcSubscriptionAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";
import { connectionAtomRuntime } from "../connection/runtime";

/** Confirm-tier subagent spawns waiting for the user: the open list, then each change. */
export const subagentSpawnApprovalsLive = createEnvironmentRpcSubscriptionAtomFamily(
  connectionAtomRuntime,
  {
    label: "environment-data:subagents:spawn-approvals",
    tag: WS_METHODS.subagentsSubscribeSpawnApprovals,
  },
);

export const subagentRespondSpawnApproval = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:subagents:respond-spawn-approval",
  tag: WS_METHODS.subagentsRespondSpawnApproval,
});

/** Every subagent spec with today's spawn counts; refreshed so the KPI strip stays live. */
export const subagentsCatalogQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:subagents:list",
  tag: WS_METHODS.subagentsList,
  staleTimeMs: 5_000,
  refreshIntervalMs: 10_000,
});

/**
 * The same list for the composer's attach button and @ menu. It does not poll:
 * a chat only needs names that were on when it opened, and the Studio view keeps
 * its own live copy.
 */
export const subagentsComposerQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:subagents:list-composer",
  tag: WS_METHODS.subagentsList,
  staleTimeMs: 60_000,
});

/** Studio writes: change a listed spec, or create one from a starter. */
export const subagentUpdate = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:subagents:update",
  tag: WS_METHODS.subagentsUpdate,
});

export const subagentCreate = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:subagents:create",
  tag: WS_METHODS.subagentsCreate,
});
