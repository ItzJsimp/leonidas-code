import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcSubscriptionAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";
import { connectionAtomRuntime } from "../connection/runtime";

/** Live Images state of one project: connection, models, queue and finished images. */
export const imagesLive = createEnvironmentRpcSubscriptionAtomFamily(connectionAtomRuntime, {
  label: "environment-data:images:live",
  tag: WS_METHODS.imagesSubscribe,
  idleTtlMs: 0,
});

export const imagesGenerate = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:images:generate",
  tag: WS_METHODS.imagesGenerate,
});

export const imagesCancel = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:images:cancel",
  tag: WS_METHODS.imagesCancel,
});

export const imagesKeep = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:images:keep",
  tag: WS_METHODS.imagesKeep,
});

export const imagesSetBaseUrl = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:images:set-base-url",
  tag: WS_METHODS.imagesSetBaseUrl,
});
