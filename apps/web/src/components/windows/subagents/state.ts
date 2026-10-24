import { createEnvironmentRpcQueryAtomFamily } from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";

import { connectionAtomRuntime } from "~/connection/runtime";

/** One page of subagent runs. The hooks ask with `refresh`, so a stale answer never shows. */
export const subagentRunsQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:subagent-runs:list",
  tag: WS_METHODS.subagentRunsList,
  staleTimeMs: 0,
  idleTtlMs: 30_000,
});
