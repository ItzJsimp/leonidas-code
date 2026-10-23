import { useLocalStorage } from "~/hooks/useLocalStorage";
import {
  EMPTY_SETUP_STATE,
  SETUP_STATE_STORAGE_KEY,
  SetupStateSchema,
} from "~/onboarding/setupState.logic";

/** True when the builder flag is on, read the same way the rail reads it. Builder words show only then. */
export function useBuilderMode(): boolean {
  const [setup] = useLocalStorage(SETUP_STATE_STORAGE_KEY, EMPTY_SETUP_STATE, SetupStateSchema);
  return setup.coder === true;
}
