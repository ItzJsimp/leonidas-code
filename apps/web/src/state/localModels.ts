import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcSubscriptionAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS } from "@t3tools/contracts";
import { connectionAtomRuntime } from "../connection/runtime";

/** Live Models tab state: Ollama status, this PC's capacity and one row per model. */
export const localModelsLive = createEnvironmentRpcSubscriptionAtomFamily(connectionAtomRuntime, {
  label: "environment-data:local-models:live",
  tag: WS_METHODS.localModelsSubscribe,
  // Polling stops as soon as the tab closes.
  idleTtlMs: 0,
});

export const localModelsPull = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:local-models:pull",
  tag: WS_METHODS.localModelsPull,
});

export const localModelsCancelPull = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:local-models:cancel-pull",
  tag: WS_METHODS.localModelsCancelPull,
});

export const localModelsRun = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:local-models:run",
  tag: WS_METHODS.localModelsRun,
});

export const localModelsStop = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:local-models:stop",
  tag: WS_METHODS.localModelsStop,
});

export const localModelsSpeedTest = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:local-models:speed-test",
  tag: WS_METHODS.localModelsSpeedTest,
});

export const localModelsStartOllama = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:local-models:start-ollama",
  tag: WS_METHODS.localModelsStartOllama,
});

export const localModelsAdvice = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:local-models:advice",
  tag: WS_METHODS.localModelsAdvice,
});

export const localModelsDelete = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:local-models:delete",
  tag: WS_METHODS.localModelsDelete,
});
