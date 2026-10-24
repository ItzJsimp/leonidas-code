import * as Schema from "effect/Schema";
import { useCallback, useMemo } from "react";

import { useLocalStorage } from "~/hooks/useLocalStorage";

import {
  DEFAULT_WALLPAPER_SETTINGS,
  parseWallpaperSettings,
  type WallpaperSettings,
} from "./wallpaper.logic";

const WALLPAPER_STORAGE_KEY = "leonidas-code:appearance-wallpaper:v1";
const STORED_DEFAULT: unknown = DEFAULT_WALLPAPER_SETTINGS;

/** The wallpaper choice and sliders for this device. Every caller sees each change live. */
export function useWallpaperSettings() {
  const [stored, setStored] = useLocalStorage(
    WALLPAPER_STORAGE_KEY,
    STORED_DEFAULT,
    Schema.Unknown,
  );
  const settings = useMemo(() => parseWallpaperSettings(stored), [stored]);
  const update = useCallback(
    (patch: Partial<WallpaperSettings>) =>
      setStored((previous: unknown) =>
        parseWallpaperSettings({ ...parseWallpaperSettings(previous), ...patch }),
      ),
    [setStored],
  );
  return { settings, update };
}
