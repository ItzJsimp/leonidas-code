import { useMemo, useRef } from "react";
import * as DateTime from "effect/DateTime";
import type { HandoffTimelineRun } from "@t3tools/client-runtime/handoff";
export type TimelineRun = HandoffTimelineRun & {
  workStartedAt?: DateTime.Utc | null | undefined;
  startedAt?: DateTime.Utc | null | undefined;
  completedAt?: DateTime.Utc | null | undefined;
};

/** Content-stable projection of the runs the handoff rows read. The incoming
 *  array is rebuilt on every projection event (status/timestamp churn), but
 *  the returned reference only changes when a run's identity-relevant fields
 *  (id, ordinal, instance, model) do — keeping TimelineRowCtx stable. */
export function useStableHandoffRuns(runs: ReadonlyArray<TimelineRun>): ReadonlyArray<TimelineRun> {
  const prev = useRef<{
    signature: string;
    value: ReadonlyArray<TimelineRun>;
  }>({ signature: "", value: [] });
  return useMemo(() => {
    const signature = runs
      .map(
        (run) =>
          `${run.id}\0${run.providerInstanceId}\0${run.ordinal}\0${run.modelSelection.instanceId}\0${run.modelSelection.model}\0${run.workStartedAt ? DateTime.toEpochMillis(run.workStartedAt) : ""}\0${run.startedAt ? DateTime.toEpochMillis(run.startedAt) : ""}\0${run.completedAt ? DateTime.toEpochMillis(run.completedAt) : ""}`,
      )
      .join("\n");
    if (signature === prev.current.signature) {
      return prev.current.value;
    }
    const value = runs.map((run) => ({
      id: run.id,
      ordinal: run.ordinal,
      providerInstanceId: run.providerInstanceId,
      modelSelection: run.modelSelection,
      workStartedAt: run.workStartedAt,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
    }));
    prev.current = { signature, value };
    return value;
  }, [runs]);
}
