import { useEffect, useRef } from "react";

import type { AgentActivity } from "../agentActivity";
import { useClientSettings } from "../hooks/useSettings";
import {
  derivePetSignal,
  finishedPetSignal,
  IDLE_PET_SIGNAL,
  usePetSignalStore,
} from "./petSignal";

const REACTION_MS = 3000;

/**
 * Feeds the active chat's agent activity to the pet. When the activity ends, the pet reacts
 * for a few seconds (celebrate or grimace) before settling to idle. Does nothing while the
 * pet is off.
 */
export function usePetActivityPublisher(
  activity: Pick<AgentActivity, "now" | "waiting"> | null,
  runFailed: boolean,
) {
  const petEnabled = useClientSettings((settings) => settings.petEnabled);
  const publish = usePetSignalStore((store) => store.publish);
  const wasActive = useRef(false);

  useEffect(() => {
    if (!petEnabled) return;
    if (activity) {
      wasActive.current = true;
      publish(derivePetSignal(activity));
      return;
    }
    if (!wasActive.current) {
      publish(IDLE_PET_SIGNAL);
      return;
    }
    wasActive.current = false;
    publish(finishedPetSignal(runFailed));
    const timer = setTimeout(() => publish(IDLE_PET_SIGNAL), REACTION_MS);
    return () => clearTimeout(timer);
  }, [activity, petEnabled, publish, runFailed]);
}
