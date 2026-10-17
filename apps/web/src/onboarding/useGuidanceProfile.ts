import type { EnvironmentId } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { AIOS_FOLDER_STORAGE_KEY, DEFAULT_AIOS_FOLDER } from "./leonidasSetup.logic";
import { guidanceProfileKey, GuidanceProfileSchema } from "./guidance.logic";

const StoredGuidance = Schema.NullOr(GuidanceProfileSchema);

/** Browser profiles provide the local user boundary; environment and folder separate AIOS progress. */
export function useGuidanceProfile(environmentId: EnvironmentId | undefined) {
  const [folder] = useLocalStorage(AIOS_FOLDER_STORAGE_KEY, DEFAULT_AIOS_FOLDER, Schema.String);
  return useLocalStorage(
    guidanceProfileKey(environmentId ?? "unconnected", folder),
    null,
    StoredGuidance,
  );
}
