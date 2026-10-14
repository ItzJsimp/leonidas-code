import type { DesktopUpdateState } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { reduceDesktopUpdateStateOnDownloadProgress } from "./updateMachine.ts";

const DownloadProgressInfo = Schema.Struct({
  percent: Schema.Number,
  transferred: Schema.optionalKey(Schema.Number),
  total: Schema.optionalKey(Schema.Number),
  bytesPerSecond: Schema.optionalKey(Schema.Number),
});
export const decodeDownloadProgressInfo = Schema.decodeUnknownEffect(DownloadProgressInfo);

export function applyDownloadProgress(
  state: DesktopUpdateState,
  progress: typeof DownloadProgressInfo.Type,
  now: number,
): DesktopUpdateState | null {
  const previous = state.status === "downloading" ? state.downloadProgress : null;
  const startedAt =
    previous?.startedAt ??
    (state.status === "available" && state.checkedAt ? Date.parse(state.checkedAt) : now);
  const telemetry = measureDownloadProgress(progress, startedAt, now);
  const percent = Math.max(0, Math.min(100, progress.percent));
  if (
    state.status === "downloading" &&
    state.message === null &&
    Math.floor(state.downloadPercent ?? -1) === Math.floor(percent) &&
    percent !== 100 &&
    telemetry.elapsedSeconds - (previous?.elapsedSeconds ?? -1) < 1
  )
    return null;
  return {
    ...reduceDesktopUpdateStateOnDownloadProgress(state, percent),
    downloadProgress: telemetry,
  };
}

export function measureDownloadProgress(
  progress: { transferred?: number; total?: number; bytesPerSecond?: number },
  startedAt: number,
  now: number,
): NonNullable<DesktopUpdateState["downloadProgress"]> {
  const positive = (value: number | undefined) =>
    value !== undefined && Number.isFinite(value) ? Math.max(0, value) : 0;
  const transferred = positive(progress.transferred);
  const total = positive(progress.total);
  const bytesPerSecond = positive(progress.bytesPerSecond);
  return {
    startedAt,
    elapsedSeconds: Math.max(0, (now - startedAt) / 1000),
    transferred,
    total,
    bytesPerSecond,
    remainingSeconds:
      total > 0 && bytesPerSecond > 0 ? Math.max(0, (total - transferred) / bytesPerSecond) : null,
  };
}
