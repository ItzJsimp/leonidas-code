import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import {
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import type { HardwareHistoryRange, HardwareSample } from "@t3tools/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

import { useComposerDraftStore } from "~/composerDraftStore";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { writeTextToClipboard } from "~/hooks/useCopyToClipboard";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useEnvironmentQuery } from "~/state/query";
import { serverEnvironment } from "~/state/server";
import { useAtomCommand } from "~/state/use-atom-command";
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
  const acknowledge = useAtomCommand(serverEnvironment.hardwareAcknowledgeAlert, {
    reportFailure: false,
  });
  const deepSensors = useAtomCommand(serverEnvironment.hardwareSetDeepSensors, {
    reportFailure: false,
  });
  const prepareAgent = useAtomCommand(serverEnvironment.hardwarePrepareAgent, {
    reportFailure: false,
  });
  const openNewThread = useNewThreadHandler();
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

  /**
   * Builds the agent prompt, copies it, and puts it in a new unsent draft. Nothing is ever sent:
   * the person reads it and presses send themselves.
   */
  const preparePrompt = useCallback(
    (kind: "investigate" | "checkup" | "tune", alertId?: string) =>
      run("Could not prepare the prompt", async () => {
        if (environmentId === null || starting.current) return;
        starting.current = true;
        setBusy(true);
        try {
          const result = unwrap(
            await prepareAgent({
              environmentId,
              input: { kind, ...(alertId ? { alertId } : {}) },
            }),
          );
          const copied = await writeTextToClipboard(result.prompt, "PC Tuning prompt").then(
            () => true,
            () => false,
          );
          const opened = await openNewThread(scopeProjectRef(environmentId, result.projectId));
          if (opened) {
            useComposerDraftStore.getState().setPrompt(opened.draftId, result.prompt);
          }
          toastManager.add({
            type: "success",
            title: opened ? "Prompt ready, not sent" : "Prompt copied, not sent",
            description: opened
              ? `${copied ? "It is also copied. " : ""}Read it, then press send when you are ready.`
              : "Open a new thread in the PC Tuning project and paste it.",
          });
        } finally {
          starting.current = false;
          setBusy(false);
        }
      }),
    [environmentId, openNewThread, prepareAgent, run],
  );

  return { busy, setAcknowledged, setDeepSensors, preparePrompt };
}
