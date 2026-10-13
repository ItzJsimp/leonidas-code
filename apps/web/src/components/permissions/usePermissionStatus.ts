import { useEffect, useRef, useState } from "react";

import { useVisibleInterval } from "~/hooks/useVisibleInterval";

/** Grants change only when the person acts in System Settings, so a short poll is enough while one is missing. */
const PERMISSION_POLL_MS = 1500;

export function usePermissionStatus<Id extends string>(
  check: () => Promise<Record<Id, boolean>>,
  initialStatus: Record<Id, boolean>,
  enabled = true,
) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const latestCheck = useRef(check);
  latestCheck.current = check;
  const checking = useRef(false);
  const mounted = useRef(false);
  // Once every permission passes there is nothing left to wait for, so polling stops.
  const polling = enabled && !Object.values<boolean>(status).every(Boolean);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = () => {
    if (checking.current || document.visibilityState === "hidden") return;
    checking.current = true;
    latestCheck
      .current()
      .then((next) => {
        if (!mounted.current) return;
        setStatus(next);
        setError(null);
      })
      .catch(() => {
        if (mounted.current)
          setError("Could not check permissions. We'll try again automatically.");
      })
      .finally(() => {
        checking.current = false;
      });
  };

  useVisibleInterval(refresh, PERMISSION_POLL_MS, polling);
  useEffect(() => {
    if (polling) refresh();
  }, [polling]);

  return {
    status,
    error,
    isReady: (required: readonly Id[]) => error === null && required.every((id) => status[id]),
  };
}
