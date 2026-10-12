import { DEFAULT_UNIFIED_SETTINGS, type UnifiedSettings } from "@t3tools/contracts/settings";
import { RotateCcwIcon } from "lucide-react";

import { Button } from "../ui/button";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";

/** Puts one folded section's device settings back to the shipped defaults. */
export function ResetSectionButton<Key extends keyof UnifiedSettings>({
  keys,
  label,
}: {
  readonly keys: ReadonlyArray<Key>;
  readonly label: string;
}) {
  const updateSettings = useUpdateScopedSettings();
  const isModified = useScopedSettings((settings) =>
    keys.some(
      (key) => JSON.stringify(settings[key]) !== JSON.stringify(DEFAULT_UNIFIED_SETTINGS[key]),
    ),
  );
  if (!isModified) return null;
  return (
    <Button
      type="button"
      size="compact"
      variant="ghost"
      aria-label={`Reset ${label} settings to defaults`}
      onClick={() =>
        updateSettings(Object.fromEntries(keys.map((key) => [key, DEFAULT_UNIFIED_SETTINGS[key]])))
      }
    >
      <RotateCcwIcon />
      Reset
    </Button>
  );
}
