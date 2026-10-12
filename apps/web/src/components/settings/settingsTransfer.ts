import { ClientSettingsSchema, type ClientSettings } from "@t3tools/contracts/settings";
import * as Schema from "effect/Schema";

/** Per-machine or account-linked values that must never travel in a settings file. */
const EXCLUDED_KEYS: ReadonlySet<string> = new Set([
  "browserProfiles",
  "browserDefaultProfileId",
  "onboardingCompletedAt",
  "favorites",
  "providerModelPreferences",
  "pullRequestMergeMethodOverrides",
  "sidebarProjectGroupingOverrides",
  "dismissedProviderUpdateNotificationKeys",
  "loadBalancingEnabled",
  "loadBalancingWeights",
]);

const FILE_KIND = "leonidas-code-device-settings";

export function exportDeviceSettings(settings: ClientSettings): string {
  const preferences = Object.fromEntries(
    Object.entries(settings).filter(([key]) => !EXCLUDED_KEYS.has(key)),
  );
  return JSON.stringify({ kind: FILE_KIND, version: 1, settings: preferences }, null, 2);
}

/**
 * Reads an exported file into a patch of known, shareable keys. Unknown keys, excluded keys and
 * keys whose value fails validation are dropped, so an old or edited file cannot break the app.
 */
export function parseDeviceSettings(
  text: string,
): { readonly patch: Partial<ClientSettings>; readonly skipped: number } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const file = parsed as { kind?: unknown; settings?: unknown };
  if (file.kind !== FILE_KIND || typeof file.settings !== "object" || file.settings === null) {
    return null;
  }
  const decode = Schema.decodeUnknownOption(ClientSettingsSchema);
  const patch: Record<string, unknown> = {};
  let skipped = 0;
  for (const [key, value] of Object.entries(file.settings)) {
    if (EXCLUDED_KEYS.has(key)) {
      skipped += 1;
      continue;
    }
    // Decode one key at a time over the defaults, so one bad value only drops itself.
    const decoded = decode({ [key]: value });
    const accepted =
      decoded._tag === "Some" && key in decoded.value
        ? (decoded.value as Record<string, unknown>)[key]
        : undefined;
    if (accepted === undefined || JSON.stringify(accepted) !== JSON.stringify(value)) {
      skipped += 1;
      continue;
    }
    patch[key] = accepted;
  }
  return { patch: patch as Partial<ClientSettings>, skipped };
}
