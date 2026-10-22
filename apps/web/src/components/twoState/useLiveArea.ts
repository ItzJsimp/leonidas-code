import {
  deriveThreadActivityRun,
  deriveThreadRuntime,
} from "@t3tools/client-runtime/state/thread-execution";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useEffect, useMemo, useRef } from "react";

import { deriveAgentActivity } from "~/agentActivity";
import { isLatestRunSettled } from "~/session-logic";
import { useThreadProjection } from "~/state/entities";

import { type LiveArea, liveArea } from "./liveArea";
import { useTwoStateStore } from "./twoStateStore";

export const IDLE: LiveArea = { area: null, path: null, written: [] };

const same = (a: LiveArea, b: LiveArea) =>
  a.area === b.area && a.path === b.path && a.written.join() === b.written.join();

/**
 * The live area of the open chat's current turn. It reads the projection the chat already
 * holds, and returns the same object until the area or file changes, so the rails do not
 * render again for each streamed word.
 */
export function useLiveArea(place: ScopedThreadRef | null): LiveArea {
  const projection = useThreadProjection(place)?.projection ?? null;
  const markTouched = useTwoStateStore((state) => state.markTouched);
  const last = useRef(IDLE);
  const wasRunning = useRef(false);

  const { live, running } = useMemo(() => {
    const run = projection === null ? null : deriveThreadActivityRun(projection);
    if (projection === null || run === null) return { live: IDLE, running: false };
    const running = !isLatestRunSettled(run, deriveThreadRuntime(projection));
    const files = deriveAgentActivity({
      runId: run.runId,
      items: projection.turnItems,
      plan: null,
    }).aios;
    const next = liveArea(files, running);
    if (!same(next, last.current)) last.current = next;
    return { live: last.current, running };
  }, [projection]);

  useEffect(() => {
    // The turn just ended: its written areas say "updated just now".
    if (wasRunning.current && !running && live.written.length > 0) {
      markTouched(live.written, Date.now());
    }
    wasRunning.current = running;
  }, [live, markTouched, running]);

  return live;
}
