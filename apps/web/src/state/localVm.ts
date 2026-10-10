import { WS_METHODS } from "@t3tools/contracts";
import {
  createEnvironmentRpcCommand,
  createAtomCommandScheduler,
} from "@t3tools/client-runtime/state/runtime";
import { connectionAtomRuntime } from "../connection/runtime";

const scheduler = createAtomCommandScheduler();
const concurrency = {
  mode: "serial" as const,
  key: ({ environmentId }: { environmentId: string }) => environmentId,
};
export const localVmEnvironment = {
  list: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "local-vm:list",
    tag: WS_METHODS.localVmList,
    scheduler,
    concurrency,
  }),
  connect: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "local-vm:connect",
    tag: WS_METHODS.localVmConnect,
    scheduler,
    concurrency,
  }),
  pause: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "local-vm:pause",
    tag: WS_METHODS.localVmPause,
    scheduler,
    concurrency,
  }),
  release: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "local-vm:release",
    tag: WS_METHODS.localVmRelease,
    scheduler,
    concurrency,
  }),
  screenshot: createEnvironmentRpcCommand(connectionAtomRuntime, {
    label: "local-vm:screenshot",
    tag: WS_METHODS.localVmScreenshot,
    scheduler,
    concurrency,
  }),
};
