import { isAgentActive } from "@t3tools/client-runtime/state/activeAgentCounts";
import type { ThreadRuntimeSummary } from "@t3tools/client-runtime/state/models";
import { DESKTOP_RENDERER_RELOAD_SAFE_CHECK } from "@t3tools/contracts";
import { useEffect, useRef } from "react";

import { isConfirmDialogActive } from "./confirmDialog";
import { useThreadShells } from "./state/entities";

interface ReloadGuardThread {
  readonly runtime: ThreadRuntimeSummary | null;
  readonly archivedAt?: string | null;
}

/** A reload is safe when no agent runs or waits for the user and no dialog is open. */
export function isRendererReloadSafe(input: {
  readonly threads: Iterable<ReloadGuardThread>;
  readonly confirmDialogActive: boolean;
}): boolean {
  if (input.confirmDialogActive) return false;
  for (const thread of input.threads) {
    if (!thread.archivedAt && isAgentActive(thread.runtime)) return false;
  }
  return true;
}

/**
 * Answers the desktop memory watchdog. Electron calls the global only when
 * the user is away and the renderer is over its memory limit.
 */
export function useRendererReloadGuard(): void {
  const threads = useThreadShells();
  const threadsRef = useRef(threads);
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);
  useEffect(() => {
    const check = () =>
      isRendererReloadSafe({
        threads: threadsRef.current,
        confirmDialogActive: isConfirmDialogActive(),
      });
    const target = globalThis as Record<string, unknown>;
    target[DESKTOP_RENDERER_RELOAD_SAFE_CHECK] = check;
    return () => {
      if (target[DESKTOP_RENDERER_RELOAD_SAFE_CHECK] === check) {
        delete target[DESKTOP_RENDERER_RELOAD_SAFE_CHECK];
      }
    };
  }, []);
}

/** Mount point that keeps thread updates from re-rendering the root view. */
export function RendererReloadGuard(): null {
  useRendererReloadGuard();
  return null;
}
