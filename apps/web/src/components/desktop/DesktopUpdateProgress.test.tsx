// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { DesktopUpdateState } from "@t3tools/contracts";
import { expect, it, vi } from "vite-plus/test";
import { DesktopUpdateProgress } from "./DesktopUpdateProgress";

it("shows live timing, drops a stale ETA, and releases its timer after completion", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(10000);
  const container = document.createElement("div");
  const root = createRoot(container);
  const state: DesktopUpdateState = {
    enabled: true,
    status: "downloading",
    channel: "latest",
    currentVersion: "0.1.0",
    hostArch: "x64",
    appArch: "x64",
    runningUnderArm64Translation: false,
    availableVersion: "0.2.0",
    downloadedVersion: null,
    releaseNotes: [],
    omittedReleaseCount: 0,
    downloadPercent: 20,
    checkedAt: null,
    message: null,
    errorContext: null,
    canRetry: false,
    downloadProgress: {
      startedAt: 8000,
      elapsedSeconds: 2,
      transferred: 200,
      total: 1000,
      bytesPerSecond: 100,
      remainingSeconds: 8,
    },
  };
  try {
    await act(async () => root.render(<DesktopUpdateProgress state={state} />));
    expect(container.textContent).toContain("2s elapsed");
    expect(container.textContent).toContain("About 8s left");
    await act(async () => vi.advanceTimersByTime(6000));
    expect(container.textContent).toContain("8s elapsed");
    expect(container.textContent).toContain("Waiting for download data");
    expect(container.textContent).not.toContain("About 8s left");
    await act(async () =>
      root.render(<DesktopUpdateProgress state={{ ...state, status: "downloaded" }} />),
    );
    expect(container.textContent).toBe("");
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    await act(async () => root.unmount());
    vi.useRealTimers();
  }
});
