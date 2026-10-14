import { describe, expect, it } from "vite-plus/test";
import { measureDownloadProgress } from "./downloadProgress.ts";

describe("download progress", () => {
  it("reports actual bytes, elapsed time and remaining transfer time", () => {
    expect(
      measureDownloadProgress({ transferred: 200, total: 1000, bytesPerSecond: 100 }, 1000, 3000),
    ).toEqual({
      startedAt: 1000,
      elapsedSeconds: 2,
      transferred: 200,
      total: 1000,
      bytesPerSecond: 100,
      remainingSeconds: 8,
    });
  });
  it("does not invent an ETA for stalled or unknown transfers", () => {
    expect(
      measureDownloadProgress({ transferred: 0, total: 0, bytesPerSecond: 0 }, 1000, 3000)
        .remainingSeconds,
    ).toBeNull();
    expect(
      measureDownloadProgress({ transferred: 200, total: 1000, bytesPerSecond: 0 }, 1000, 3000)
        .remainingSeconds,
    ).toBeNull();
  });
  it("clamps completion and invalid telemetry", () => {
    expect(
      measureDownloadProgress({ transferred: 1200, total: 1000, bytesPerSecond: 100 }, 1000, 3000)
        .remainingSeconds,
    ).toBe(0);
    const progress = measureDownloadProgress(
      { transferred: NaN, total: -1, bytesPerSecond: Infinity },
      3000,
      1000,
    );
    expect(progress.elapsedSeconds).toBe(0);
    expect(progress.transferred).toBe(0);
    expect(progress.remainingSeconds).toBeNull();
  });
});
