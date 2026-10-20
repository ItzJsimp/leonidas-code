import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";
import { connectionAtomRuntime } from "../connection/runtime";

export const voiceLogMemoryReviewQuery = createEnvironmentRpcQueryAtomFamily(
  connectionAtomRuntime,
  {
    label: "environment-data:voice-log-memory:review",
    tag: WS_METHODS.voiceLogMemoryReview,
    staleTimeMs: 30_000,
    idleTtlMs: 60_000,
  },
);
export const voiceLogMemoryApprove = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:voice-log-memory:approve",
  tag: WS_METHODS.voiceLogMemoryApprove,
});
