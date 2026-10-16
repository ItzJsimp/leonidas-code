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
