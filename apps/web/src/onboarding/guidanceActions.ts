import type { EnvironmentId } from "@t3tools/contracts";
import type { GuidanceAction } from "./guidance.logic";

const EVENT = "leonidas:guidance-action";
interface GuidanceActionDetail {
  environmentId: EnvironmentId;
  action: GuidanceAction;
}

/** Only successful app actions emit this event. It contains no prompt or user content. */
export function emitGuidanceAction(environmentId: EnvironmentId, action: GuidanceAction) {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent<GuidanceActionDetail>(EVENT, { detail: { environmentId, action } }),
    );
}
export function subscribeGuidanceActions(
  listener: (detail: GuidanceActionDetail) => void,
): () => void {
  const handle = (event: Event) => listener((event as CustomEvent<GuidanceActionDetail>).detail);
  window.addEventListener(EVENT, handle);
  return () => window.removeEventListener(EVENT, handle);
}
