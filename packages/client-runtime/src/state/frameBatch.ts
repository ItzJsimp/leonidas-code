// @effect-diagnostics globalTimers:off - Frame fallback for hidden documents, outside an Effect runtime.
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";

/** Runs `flush` on a later frame and returns a function that cancels it. */
export type FrameScheduler = (flush: () => void) => () => void;

/** Hidden documents do not run requestAnimationFrame, so they flush on a timer. */
export const HIDDEN_DOCUMENT_FLUSH_MS = 50;

/**
 * Frame scheduler for environments with requestAnimationFrame (browsers, React
 * Native). Undefined elsewhere, so callers apply every value synchronously.
 */
export function browserFrameScheduler(): FrameScheduler | undefined {
  if (typeof requestAnimationFrame !== "function") return undefined;
  return (flush) => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      const timer = setTimeout(flush, HIDDEN_DOCUMENT_FLUSH_MS);
      return () => clearTimeout(timer);
    }
    const frame = requestAnimationFrame(() => flush());
    return () => cancelAnimationFrame(frame);
  };
}

/**
 * Emits the latest value at most once per frame. Values are snapshots, so a
 * newer value supersedes any pending one. The first value, and any value that
 * `isBoundary` marks against the last emitted value, emit immediately and drop
 * the pending value.
 */
export function createFrameBatch<A>(options: {
  readonly emit: (value: A) => void;
  readonly isBoundary: (previous: A, next: A) => boolean;
  readonly schedule: FrameScheduler;
}) {
  let shown: { readonly value: A } | undefined;
  let pending: { readonly value: A } | undefined;
  let cancelFrame: (() => void) | undefined;

  const show = (value: A) => {
    cancelFrame?.();
    cancelFrame = undefined;
    pending = undefined;
    shown = { value };
    options.emit(value);
  };

  const flush = () => {
    cancelFrame = undefined;
    if (pending !== undefined) show(pending.value);
  };

  return {
    push(value: A) {
      if (shown === undefined || options.isBoundary(shown.value, value)) {
        show(value);
        return;
      }
      pending = { value };
      cancelFrame ??= options.schedule(flush);
    },
    /** Emits any pending value now. */
    flush,
    /** Drops any pending value. Used when the consumer is gone. */
    dispose() {
      cancelFrame?.();
      cancelFrame = undefined;
      pending = undefined;
    },
  };
}

/**
 * Batches a stream to one emission per frame. Boundary values and the end of the
 * stream emit immediately. Without a frame scheduler the source is returned
 * unchanged.
 */
export function batchStreamByFrame<A, E, R>(
  source: Stream.Stream<A, E, R>,
  isBoundary: (previous: A, next: A) => boolean,
  schedule: FrameScheduler | undefined = browserFrameScheduler(),
): Stream.Stream<A, E, R> {
  if (schedule === undefined) return source;
  // The default callback queue is unbounded, so no emitted value is dropped.
  return Stream.callback<A, E, R>((queue) =>
    Effect.gen(function* () {
      const batch = createFrameBatch<A>({
        emit: (value) => Queue.offerUnsafe(queue, value),
        isBoundary,
        schedule,
      });
      yield* Effect.addFinalizer(() => Effect.sync(() => batch.dispose()));
      yield* Stream.runForEach(source, (value) => Effect.sync(() => batch.push(value)));
      batch.flush();
      yield* Queue.end(queue);
    }),
  );
}
