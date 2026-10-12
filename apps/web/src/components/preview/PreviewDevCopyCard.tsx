import type { ScopedThreadRef } from "@t3tools/contracts";
import { MousePointerClick, Square } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import { Spinner } from "~/components/ui/spinner";
import { toastManager } from "~/components/ui/toast";
import { useVisibleInterval } from "~/hooks/useVisibleInterval";
import { devPreviewStart, devPreviewStatusQuery, devPreviewStop } from "~/state/devPreview";
import { useThreadShell } from "~/state/entities";
import { useEnvironmentQuery } from "~/state/query";
import { useAtomCommand } from "~/state/use-atom-command";

import { DiscoveryList, DiscoveryListRow } from "../ui/discovery-list";

const STARTING_POLL_MS = 1_500;
const IDLE_POLL_MS = 5_000;

interface Props {
  threadRef: ScopedThreadRef;
  onOpenUrl: (url: string) => void;
}

/**
 * Starts the project's isolated preview copy of the app and opens it in this
 * browser, where the element picker can send a clicked element to the chat.
 * Renders nothing for projects that cannot start one.
 */
export function PreviewDevCopyCard({ threadRef, onOpenUrl }: Props) {
  const environmentId = threadRef.environmentId;
  const projectId = useThreadShell(threadRef)?.projectId ?? null;
  const input = projectId === null ? null : { projectId };
  const status = useEnvironmentQuery(
    input === null ? null : devPreviewStatusQuery({ environmentId, input }),
  );
  const runStart = useAtomCommand(devPreviewStart, { reportFailure: false });
  const runStop = useAtomCommand(devPreviewStop, { reportFailure: false });
  const state = status.data;
  const { refresh } = status;

  useVisibleInterval(
    refresh,
    state?.status === "starting" ? STARTING_POLL_MS : IDLE_POLL_MS,
    input !== null && state?.supported === true,
  );

  // Open the copy once, when a start the user asked for finishes.
  const openWhenReady = useRef(false);
  useEffect(() => {
    if (!openWhenReady.current || state === null) return;
    if (state.status === "running" && state.url !== null) {
      openWhenReady.current = false;
      onOpenUrl(state.url);
    } else if (state.status === "failed") {
      openWhenReady.current = false;
    }
  }, [onOpenUrl, state]);

  const run = useCallback(
    async (command: typeof runStart) => {
      if (input === null) return;
      const result = await command({ environmentId, input });
      if (result._tag !== "Success") {
        toastManager.add({
          type: "error",
          title: "Preview copy failed",
          description: "Try again.",
        });
      }
      refresh();
    },
    [environmentId, input, refresh],
  );

  if (state === null || !state.supported) return null;

  const onClick = () => {
    if (state.status === "running" && state.url !== null) {
      onOpenUrl(state.url);
      return;
    }
    if (state.status === "starting") return;
    openWhenReady.current = true;
    void run(runStart);
  };

  const description =
    state.status === "starting"
      ? (state.message ?? "Starting…")
      : state.status === "running"
        ? "Running. Click to open, then use the picker to send an element to the chat."
        : state.status === "failed"
          ? (state.message ?? "Could not start. Click to try again.")
          : "Starts a separate copy so you can change it without touching this app.";

  const showStop = state.status !== "stopped";

  return (
    <DiscoveryList>
      <DiscoveryListRow
        onClick={onClick}
        icon={
          state.status === "starting" ? (
            <Spinner size="md" tone="muted" />
          ) : (
            <MousePointerClick className="size-4 text-muted-foreground" />
          )
        }
        title={state.status === "running" ? "Open the preview copy" : "Preview this app"}
        description={description}
      />
      {showStop ? (
        <DiscoveryListRow
          onClick={() => {
            openWhenReady.current = false;
            void run(runStop);
          }}
          icon={<Square className="size-4 text-muted-foreground" />}
          title="Stop the preview copy"
          description="Closes the separate copy. This app keeps running."
        />
      ) : null}
    </DiscoveryList>
  );
}
