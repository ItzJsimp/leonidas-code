import { useState } from "react";

import { useVisibleInterval } from "~/hooks/useVisibleInterval";

import { formatElapsed } from "./images.logic";

/**
 * Counts the seconds since `startedAt` (server time). `clockSkew` is server time minus
 * this device's time, so the count is right on a remote device too.
 */
export function ElapsedText({
  startedAt,
  clockSkew,
}: {
  readonly startedAt: number;
  readonly clockSkew: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useVisibleInterval(() => setNow(Date.now()), 1_000);
  return <span className="tabular-nums">{formatElapsed(startedAt, now + clockSkew)}</span>;
}
