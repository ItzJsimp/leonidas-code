import { useCallback, useLayoutEffect, useMemo, useRef } from "react";

import type { ContextWindowSnapshot } from "../../lib/contextWindow";
import type { VelocitySummary } from "./AgentVelocityMeter.logic";

/** Everything the composer needs to show context usage and offer compaction. */
export interface ComposerContextSlice {
  readonly contextWindow: ContextWindowSnapshot | null;
  readonly velocity: VelocitySummary | null | undefined;
  /** Compaction cannot run now. The composer layers its own gates on top. */
  readonly compactUnavailable: boolean;
  readonly compactDisabledReason: string | null;
  readonly onCompact: () => void;
}

export interface ComposerContextSliceInput {
  readonly contextWindow: ContextWindowSnapshot | null;
  readonly velocity: VelocitySummary | null | undefined;
  readonly compactUnavailable: boolean;
  readonly compactDisabledReason: string | null;
  readonly onCompact: () => void;
}

/**
 * Keeps the slice and `onCompact` referentially stable until a value changes, so a memoized
 * composer does not re-render because `ChatView` made a fresh callback.
 */
export function useComposerContextSlice(input: ComposerContextSliceInput): ComposerContextSlice {
  const onCompactRef = useRef(input.onCompact);
  useLayoutEffect(() => {
    onCompactRef.current = input.onCompact;
  });
  const onCompact = useCallback(() => onCompactRef.current(), []);
  const { contextWindow, velocity, compactUnavailable, compactDisabledReason } = input;
  return useMemo(
    () => ({ contextWindow, velocity, compactUnavailable, compactDisabledReason, onCompact }),
    [contextWindow, velocity, compactUnavailable, compactDisabledReason, onCompact],
  );
}
