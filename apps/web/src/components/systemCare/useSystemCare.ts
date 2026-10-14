import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import {
  CommandId,
  DEFAULT_SERVER_SETTINGS,
  type HardwareHistoryRange,
  type HardwareSample,
} from "@t3tools/contracts";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { randomUUID } from "~/lib/utils";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { environmentServerConfigsAtom, serverEnvironment } from "~/state/server";
import { useAtomCommand } from "~/state/use-atom-command";
import { buildThreadRouteParams } from "~/threadRoutes";
import { DEFAULT_INTERACTION_MODE } from "~/types";
import { toastManager } from "~/components/ui/toast";

import { appendSample } from "./systemCare.logic";

function unwrap<A, E>(result: AtomCommandResult<A, E>): A {
  if (result._tag === "Failure") throw squashAtomCommandFailure(result);
  return result.value;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Live status, alerts and a rolling sample buffer; the stream only runs while the page is mounted. */
export function useSystemCareLive() {
  const environmentId = usePrimaryEnvironmentId();
  const live = useEnvironmentQuery(
    environmentId === null
      ? null
      : serverEnvironment.hardware({ environmentId, input: { live: true } }),
  );
  const [samples, setSamples] = useState<ReadonlyArray<HardwareSample>>([]);
  const sample = live.data?.sample ?? null;
  useEffect(() => {
    setSamples((buffer) => appendSample(buffer, sample));
  }, [sample]);
  return {
    environmentId,
    status: live.data?.status ?? null,
    alerts: live.data?.alerts ?? [],
    sample,
    samples,
    error: live.error,
    isPending: live.isPending && live.data === null,
  };
}

export function useSystemCareInventory() {
  const environmentId = usePrimaryEnvironmentId();
  return useEnvironmentQuery(
    environmentId === null
      ? null
      : serverEnvironment.hardwareInventory({ environmentId, input: {} }),
  );
}

export function useSystemCareHistory(range: HardwareHistoryRange) {
  const environmentId = usePrimaryEnvironmentId();
  return useEnvironmentQuery(
    environmentId === null
      ? null
      : serverEnvironment.hardwareHistory({ environmentId, input: { range } }),
  );
}

export function useSystemCareLimits() {
  const environmentId = usePrimaryEnvironmentId();
  const query = useEnvironmentQuery(
    environmentId === null ? null : serverEnvironment.hardwareLimits({ environmentId, input: {} }),
  );
  const setLimit = useAtomCommand(serverEnvironment.hardwareSetLimit, { reportFailure: false });
  const save = useCallback(
    async (metric: string, warn: number | null, critical: number | null) => {
      if (environmentId === null) return;
      try {
        unwrap(await setLimit({ environmentId, input: { metric, warn, critical } }));
        query.refresh();
      } catch (error) {
        toastManager.add({
          type: "error",
          title: "Could not save the limit",
          description: errorText(error),
        });
      }
    },
    [environmentId, query, setLimit],
  );
  return { ...query, save };
}

export function useSystemCareActions() {
  const environmentId = usePrimaryEnvironmentId();
  const navigate = useNavigate();
  const acknowledge = useAtomCommand(serverEnvironment.hardwareAcknowledgeAlert, {
    reportFailure: false,
  });
  const deepSensors = useAtomCommand(serverEnvironment.hardwareSetDeepSensors, {
    reportFailure: false,
  });
  const startAgent = useAtomCommand(serverEnvironment.hardwareStartAgent, {
    reportFailure: false,
  });
  const [busy, setBusy] = useState(false);
  const starting = useRef(false);

  const run = useCallback(async (title: string, action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      toastManager.add({ type: "error", title, description: errorText(error) });
    }
  }, []);

  const setAcknowledged = useCallback(
    (alertId: string, acknowledged: boolean) =>
      run("Could not update the alert", async () => {
        if (environmentId === null) return;
        unwrap(await acknowledge({ environmentId, input: { alertId, acknowledged } }));
      }),
    [acknowledge, environmentId, run],
  );

  const setDeepSensors = useCallback(
    (enabled: boolean) =>
      run("Could not change Deep sensors", async () => {
        if (environmentId === null) return;
        unwrap(await deepSensors({ environmentId, input: { enabled } }));
      }),
    [deepSensors, environmentId, run],
  );

  /** Starts an approve-first agent in a new thread, then opens it. */
  const start = useCallback(
    (kind: "investigate" | "checkup", alertId?: string) =>
      run("Could not start the agent", async () => {
        if (environmentId === null || starting.current) return;
        const settings =
          appAtomRegistry.get(environmentServerConfigsAtom).get(environmentId)?.settings ??
          DEFAULT_SERVER_SETTINGS;
        const resolved = resolveProjectSettings(settings, null).settings;
        const modelSelection = resolved.defaultModelSelection;
        if (!modelSelection) {
          toastManager.add({
            type: "warning",
            title: "Pick a default model first",
            description: "Choose a default model in Settings, then start the agent again.",
          });
          return;
        }
        starting.current = true;
        setBusy(true);
        try {
          const result = unwrap(
            await startAgent({
              environmentId,
              input: {
                commandId: CommandId.make(randomUUID()),
                kind,
                ...(alertId ? { alertId } : {}),
                modelSelection,
                runtimeMode: resolved.defaultRuntimeMode,
                interactionMode: DEFAULT_INTERACTION_MODE,
              },
            }),
          );
          void navigate({
            to: "/$environmentId/$threadId",
            params: buildThreadRouteParams(scopeThreadRef(environmentId, result.threadId)),
          });
        } finally {
          starting.current = false;
          setBusy(false);
        }
      }),
    [environmentId, navigate, run, startAgent],
  );

  return { busy, setAcknowledged, setDeepSensors, start };
}
