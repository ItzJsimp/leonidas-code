import { executeAtomQuery } from "@t3tools/client-runtime/state/runtime";
import { scribeStatusLabel, startScribeStatusPolling } from "@t3tools/client-runtime/state/server";
import type { ScribeStatusResult } from "@t3tools/contracts";
import { MicIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { appAtomRegistry } from "../rpc/atomRegistry";
import type { EnvironmentPresentation } from "../state/environments";
import { serverEnvironment } from "../state/server";
import { cn } from "../lib/utils";

export function ScribeStatusCard({ environment }: { environment: EnvironmentPresentation }) {
  const connected = environment.connection.phase === "connected";
  const [result, setResult] = useState<ScribeStatusResult | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  useEffect(() => {
    if (!connected) return;
    const query = serverEnvironment.scribeStatus({
      environmentId: environment.environmentId,
      input: {},
    });
    return startScribeStatusPolling(document, async (signal) => {
      const response = await executeAtomQuery(appAtomRegistry, query, {
        refresh: true,
        signal,
        reportFailure: false,
        reportDefect: false,
      });
      if (signal.aborted) return;
      setReadFailed(response._tag !== "Success");
      setResult(response._tag === "Success" ? response.value : null);
    });
  }, [connected, environment.environmentId]);

  const notRunning = connected && !readFailed && result?.status === "unavailable";
  const label = notRunning
    ? "Not running"
    : connected && readFailed
      ? "Offline"
      : scribeStatusLabel(connected, result);
  const available = connected && !readFailed && result?.status === "available";
  const description = !connected
    ? "Reconnect this computer in Settings, then Connections."
    : readFailed
      ? "Status unavailable. Check computer access and update Leonidas if needed."
      : result?.status === "unavailable"
        ? "Scribe is not running. Start it from the tray, or install it."
        : available && result.snapshot.state === "mic_error"
          ? "Check the microphone in Scribe on this computer."
          : "Dictation status on this computer.";
  return (
    <div className="rounded-lg border border-border/70 bg-card/35 p-4">
      <div className="flex items-center gap-2">
        <MicIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium">
          Scribe · {environment.label}
        </h3>
        <span
          role="status"
          className={cn(
            "text-xs font-medium",
            available && result.snapshot.state !== "mic_error"
              ? "text-success-foreground"
              : "text-muted-foreground",
          )}
        >
          {label}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      {available ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Updated{" "}
          <time dateTime={result.snapshot.sampledAt}>
            {result.snapshot.sampledAt.slice(11, 19)} UTC
          </time>
        </p>
      ) : null}
    </div>
  );
}
