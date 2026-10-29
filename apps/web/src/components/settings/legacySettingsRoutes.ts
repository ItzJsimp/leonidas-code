import { SETTINGS_SEARCH_ITEMS, type SettingsPath } from "./settingsSearch";

/** Old settings pages that were split by concern, and the page that now holds most of them. */
const LEGACY_SETTINGS_PAGES: Readonly<Record<string, SettingsPath>> = {
  "/settings/integrations": "/settings/browser",
  "/settings/storage": "/settings/maintenance",
  "/settings/connections": "/settings/environments",
};

/** Section anchors from the old pages that are not search items. */
const LEGACY_SETTINGS_ANCHORS: Readonly<Record<string, SettingsPath>> = {
  devices: "/settings/devices",
  "browser-access": "/settings/browser",
  "storage-cleanup": "/settings/maintenance",
};

/**
 * The page an old settings link should open, or null when the path is not an old page.
 * A link with a hash goes to the page that now owns that row.
 */
export function resolveLegacySettingsRedirect(pathname: string, hash: string): SettingsPath | null {
  const fallback = LEGACY_SETTINGS_PAGES[pathname.replace(/\/$/, "")];
  if (!fallback) return null;
  const anchor = hash.replace(/^#/, "");
  if (anchor === "") return fallback;
  const item = SETTINGS_SEARCH_ITEMS.find(
    (candidate) =>
      candidate.id === anchor || ("targetId" in candidate && candidate.targetId === anchor),
  );
  return item?.to ?? LEGACY_SETTINGS_ANCHORS[anchor] ?? fallback;
}
