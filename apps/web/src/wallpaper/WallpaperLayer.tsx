import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { themeColorToHex } from "~/themePalette";

import { useCustomWallpaperUrl } from "./customWallpaperStore";
import { useWallpaperSettings } from "./useWallpaperSettings";
import {
  filterImageRange,
  hexToRgb,
  measureImageRange,
  mixRgb,
  MUTED_TEXT_LIFT,
  resolveWallpaperUrl,
  solveScrimOpacity,
  UNKNOWN_IMAGE_RANGE,
  wallpaperFilter,
  type ImageRange,
  type Rgb,
  type ScrimColors,
} from "./wallpaper.logic";

// Coarse enough to be free, fine enough that a bright patch the size of a word still counts.
const MEASURE_WIDTH = 160;
const MEASURE_HEIGHT = 90;
const SURFACE_TINT_ALPHA = 0.4;

/** Reads the darkest and brightest channels of an image from a small downscaled copy. */
async function measureImage(url: string): Promise<ImageRange> {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = MEASURE_WIDTH;
  canvas.height = MEASURE_HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return UNKNOWN_IMAGE_RANGE;
  // Same crop as `background-size: cover` on a wide screen is not knowable here; the whole image
  // is a superset, so measuring all of it stays on the safe side.
  context.drawImage(image, 0, 0, MEASURE_WIDTH, MEASURE_HEIGHT);
  return measureImageRange(context.getImageData(0, 0, MEASURE_WIDTH, MEASURE_HEIGHT).data);
}

function readThemeColor(style: CSSStyleDeclaration, variable: string): Rgb | null {
  const value = style.getPropertyValue(variable).trim();
  const hex = value ? themeColorToHex(value) : null;
  return hex ? hexToRgb(hex) : null;
}

/** The theme colors the scrim must keep readable, read from the live palette. */
function readScrimColors(): ScrimColors | null {
  const style = getComputedStyle(document.documentElement);
  const canvas = readThemeColor(style, "--app-theme-canvas");
  const text = readThemeColor(style, "--app-theme-text");
  if (!canvas || !text) return null;
  const lifted = ["--app-theme-muted-foreground", "--app-theme-secondary-label"]
    .map((variable) => readThemeColor(style, variable))
    .filter((color): color is Rgb => color !== null)
    .map((muted) => mixRgb(text, muted, MUTED_TEXT_LIFT));
  const surface = readThemeColor(style, "--app-theme-surface");
  // Settings groups and other quiet panels draw `bg-card/40` over the page.
  const tints = surface ? [{ color: surface, alpha: SURFACE_TINT_ALPHA }] : [];
  return { canvas, texts: [text, ...lifted], tints };
}

/** Re-reads the palette whenever the theme repaints the root element. */
export function useThemeSnapshot(): { themeId: string | undefined; colors: ScrimColors | null } {
  const [snapshot, setSnapshot] = useState(() => ({
    themeId: document.documentElement.dataset.themeId,
    colors: readScrimColors(),
  }));
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setSnapshot({ themeId: root.dataset.themeId, colors: readScrimColors() });
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["style", "class", "data-theme-id"],
    });
    return () => observer.disconnect();
  }, []);
  return snapshot;
}

/**
 * One fixed layer behind the whole shell: the image with its filters, then a theme-colored scrim
 * solved so page text stays at WCAG AA. Static, so scrolling never repaints it.
 */
export function WallpaperLayer() {
  const { settings } = useWallpaperSettings();
  const customUrl = useCustomWallpaperUrl();
  const { themeId, colors } = useThemeSnapshot();
  const url = resolveWallpaperUrl({ choice: settings.choice, themeId, customUrl });
  const [range, setRange] = useState<{ url: string; range: ImageRange } | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    measureImage(url)
      .then((measured) => {
        if (!cancelled) setRange({ url, range: measured });
      })
      .catch(() => {
        if (!cancelled) setRange({ url, range: UNKNOWN_IMAGE_RANGE });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    const root = document.documentElement;
    if (url) root.dataset.wallpaper = "on";
    else delete root.dataset.wallpaper;
    return () => {
      delete root.dataset.wallpaper;
    };
  }, [url]);

  if (!url) return null;
  // Until the image is measured, assume the worst: a full black-to-white range.
  const measured = range?.url === url ? range.range : UNKNOWN_IMAGE_RANGE;
  const scrim = colors ? solveScrimOpacity(colors, filterImageRange(measured, settings)) : 1;

  return createPortal(
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url("${url}")`,
          filter: wallpaperFilter(settings),
          // Blur pulls transparent edge pixels inward; the overscan hides that soft rim.
          inset: `${settings.blur * -2}px`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "var(--app-theme-canvas, var(--background))", opacity: scrim }}
      />
    </div>,
    document.body,
  );
}
