import type { DesktopUpdateState } from "@t3tools/contracts";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import { userErrorToastFields } from "~/lib/userErrorToast";

function duration(seconds: number) {
  const rounded = Math.max(0, Math.ceil(seconds));
  return rounded < 60 ? `${rounded}s` : `${Math.floor(rounded / 60)}m ${rounded % 60}s`;
}

function bytes(value: number) {
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

/** Mounted for every desktop download, regardless of the current route or sidebar. */
export function DesktopUpdateProgress({ state }: { state: DesktopUpdateState | null }) {
  const [now, setNow] = useState(Date.now);
  const downloading =
    state?.status === "downloading" || (state?.status === "available" && state.message === null);
  useEffect(() => {
    if (!downloading) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [downloading]);
  const failed = state?.errorContext === "download" && state.message !== null;
  if (!state || (!downloading && !failed)) return null;
  const progress = state.downloadProgress;
  const percent = Math.max(0, Math.min(100, state.downloadPercent ?? 0));
  const elapsed = progress
    ? Math.max(progress.elapsedSeconds, (now - progress.startedAt) / 1000)
    : state.checkedAt
      ? Math.max(0, (now - Date.parse(state.checkedAt)) / 1000)
      : 0;
  const stale = progress && elapsed - progress.elapsedSeconds > 5;
  return (
    <section
      aria-label="Leonidas update"
      className="fixed top-16 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg"
    >
      <p role="status" className="text-sm font-semibold">
        {failed
          ? "The update download failed"
          : `Downloading Leonidas ${state.availableVersion ?? "update"}`}
      </p>
      {failed ? (
        <>
          <p role="alert" className="mt-2 text-sm">
            {state.message}
          </p>
          {state.canRetry ? (
            <div className="mt-3">
              <Button
                size="sm"
                onClick={() => {
                  void window.desktopBridge?.downloadUpdate().catch((error: unknown) => {
                    toastManager.add({
                      type: "error",
                      title: "Could not retry update",
                      ...userErrorToastFields(error),
                    });
                  });
                }}
              >
                Try download again
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="mt-3 flex justify-between text-xs text-muted-foreground">
            <span>
              {progress?.total
                ? `${bytes(progress.transferred)} / ${bytes(progress.total)}`
                : "Preparing download"}
            </span>
            <span>{Math.floor(percent)}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Update download"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.floor(percent)}
            className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full origin-left bg-primary"
              style={{ transform: `scaleX(${percent / 100})` }}
            />
          </div>
          <div className="mt-3 flex justify-between gap-3 text-xs text-muted-foreground">
            <span>{duration(elapsed)} elapsed</span>
            <span>
              {!stale && progress?.remainingSeconds != null
                ? `About ${duration(progress.remainingSeconds)} left`
                : "Estimating time remaining"}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {stale
              ? "Waiting for download data…"
              : progress?.bytesPerSecond
                ? `${bytes(progress.bytesPerSecond)}/s`
                : "Connecting…"}{" "}
            · You can keep working.
          </p>
        </>
      )}
    </section>
  );
}
