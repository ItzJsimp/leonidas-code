import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useVisibleInterval } from "../../hooks/useVisibleInterval";

export function usePermissionStatus<Id extends string>(
  check: () => Promise<Record<Id, boolean>>,
  initialStatus: Record<Id, boolean>,
  enabled = true,
) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const checkLatest = useEffectEvent(check);
  const refreshRef = useRef<(() => void) | null>(null);
  // Polling is only for waiting on a grant; once every permission passes, focus and visibility
  // changes are enough to notice a revocation.
  const settled = error === null && Object.values(status).every(Boolean);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let checking = false;
    const refresh = async () => {
      if (disposed || checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const next = await checkLatest();
        if (!disposed) {
          setStatus(next);
          setError(null);
        }
      } catch {
        if (!disposed) setError("Could not check permissions. We'll try again automatically.");
      }
      checking = false;
    };
    refreshRef.current = () => void refresh();
    void refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      refreshRef.current = null;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled]);
  useVisibleInterval(() => refreshRef.current?.(), 1500, enabled && !settled);
  return {
    status,
    error,
    isReady: (required: readonly Id[]) => error === null && required.every((id) => status[id]),
  };
}
