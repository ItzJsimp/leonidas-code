import { sendUsageEvent } from "./sendUsageEvent";

/** One event per changed setting name. The value is never passed in. */
export function reportSettingsChanged(patch: Readonly<Record<string, unknown>>): void {
  for (const key of Object.keys(patch)) sendUsageEvent("settings_changed", { key });
}
