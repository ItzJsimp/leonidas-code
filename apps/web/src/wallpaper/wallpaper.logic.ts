import { BUILT_IN_THEME_IDS } from "@t3tools/shared/themePalettes";

/** Every built-in theme ships one wallpaper, named after the theme id. */
export const BUILT_IN_WALLPAPER_IDS = BUILT_IN_THEME_IDS;
export type BuiltInWallpaperId = (typeof BUILT_IN_WALLPAPER_IDS)[number];

/** `theme` follows the active theme's own wallpaper; `custom` is the image the user uploaded. */
export type WallpaperChoice = "none" | "theme" | "custom" | BuiltInWallpaperId;

export const WALLPAPER_BLUR = { min: 0, max: 40, step: 1, initial: 0 } as const;
export const WALLPAPER_BRIGHTNESS = { min: 30, max: 130, step: 5, initial: 100 } as const;
export const WALLPAPER_CONTRAST = { min: 50, max: 150, step: 5, initial: 100 } as const;

export type WallpaperSettings = Readonly<{
  choice: WallpaperChoice;
  blur: number;
  brightness: number;
  contrast: number;
}>;

export const DEFAULT_WALLPAPER_SETTINGS: WallpaperSettings = {
  choice: "none",
  blur: WALLPAPER_BLUR.initial,
  brightness: WALLPAPER_BRIGHTNESS.initial,
  contrast: WALLPAPER_CONTRAST.initial,
};

type SliderRange = Readonly<{ min: number; max: number; step: number; initial: number }>;

/** Snaps a slider value to its step inside its range; junk falls back to the default. */
export function clampSlider(value: unknown, range: SliderRange): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return range.initial;
  const stepped = Math.round((value - range.min) / range.step) * range.step + range.min;
  return Math.min(range.max, Math.max(range.min, stepped));
}

function isBuiltInWallpaperId(value: string): value is BuiltInWallpaperId {
  return (BUILT_IN_WALLPAPER_IDS as ReadonlyArray<string>).includes(value);
}

/** Reads stored settings leniently: an unknown choice or a hand-edited slider never breaks the shell. */
export function parseWallpaperSettings(value: unknown): WallpaperSettings {
  if (typeof value !== "object" || value === null) return DEFAULT_WALLPAPER_SETTINGS;
  const record = value as Record<string, unknown>;
  const choice =
    typeof record.choice === "string" &&
    (record.choice === "none" ||
      record.choice === "theme" ||
      record.choice === "custom" ||
      isBuiltInWallpaperId(record.choice))
      ? (record.choice as WallpaperChoice)
      : "none";
  return {
    choice,
    blur: clampSlider(record.blur, WALLPAPER_BLUR),
    brightness: clampSlider(record.brightness, WALLPAPER_BRIGHTNESS),
    contrast: clampSlider(record.contrast, WALLPAPER_CONTRAST),
  };
}

export function builtInWallpaperUrl(id: BuiltInWallpaperId): string {
  return `/wallpapers/${id}.webp`;
}

export function builtInWallpaperThumbUrl(id: BuiltInWallpaperId): string {
  return `/wallpapers/thumbs/${id}.webp`;
}

/** The wallpaper of a theme, or null for a user theme that has none. */
export function themeWallpaperId(themeId: string | undefined): BuiltInWallpaperId | null {
  return themeId !== undefined && isBuiltInWallpaperId(themeId) ? themeId : null;
}

/**
 * The image to paint, or null for no wallpaper. A user theme has no wallpaper of its own,
 * so `theme` falls back to the Leonidas art instead of turning the wallpaper off.
 */
export function resolveWallpaperUrl(input: {
  readonly choice: WallpaperChoice;
  readonly themeId: string | undefined;
  readonly customUrl: string | null;
}): string | null {
  switch (input.choice) {
    case "none":
      return null;
    case "custom":
      return input.customUrl;
    case "theme":
      return builtInWallpaperUrl(themeWallpaperId(input.themeId) ?? "leonidas");
    default:
      return builtInWallpaperUrl(input.choice);
  }
}

/** Contrast before brightness, so a high contrast can never push a pixel past the brightness cap. */
export function wallpaperFilter(settings: WallpaperSettings): string {
  return `blur(${settings.blur}px) contrast(${settings.contrast}%) brightness(${settings.brightness}%)`;
}

// ---- Text contrast: the scrim is solved so text on any part of the image stays at WCAG AA ----

export type Rgb = readonly [number, number, number];

/** Componentwise darkest and brightest channels of the image, 0 to 1. */
export type ImageRange = Readonly<{ low: Rgb; high: Rgb }>;

/** A full black-to-white range: the safe answer before an image is measured. */
export const UNKNOWN_IMAGE_RANGE: ImageRange = { low: [0, 0, 0], high: [1, 1, 1] };

const WCAG_AA_TEXT = 4.5;
/** The scrim never drops below this, so even a dark image stays calm behind the panes. */
export const MIN_SCRIM = 0.45;
/**
 * How far muted text moves toward body text while a wallpaper is on. Keep in sync with the
 * `--muted-foreground` mix in index.css (`html[data-wallpaper]`).
 */
export const MUTED_TEXT_LIFT = 0.4;

export function hexToRgb(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1]!, 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function linear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: Rgb): number {
  return 0.2126 * linear(color[0]) + 0.7152 * linear(color[1]) + 0.0722 * linear(color[2]);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `top` at `alpha` over `bottom`, in sRGB like the browser composites. */
export function mixRgb(top: Rgb, bottom: Rgb, alpha: number): Rgb {
  return [
    top[0] * alpha + bottom[0] * (1 - alpha),
    top[1] * alpha + bottom[1] * (1 - alpha),
    top[2] * alpha + bottom[2] * (1 - alpha),
  ];
}

/** The same per-channel transfer as `wallpaperFilter`, applied to the measured range. */
export function filterImageRange(range: ImageRange, settings: WallpaperSettings): ImageRange {
  const apply = (channel: number) => {
    const contrasted = Math.min(1, Math.max(0, (channel - 0.5) * (settings.contrast / 100) + 0.5));
    return Math.min(1, Math.max(0, contrasted * (settings.brightness / 100)));
  };
  const map = (color: Rgb): Rgb => [apply(color[0]), apply(color[1]), apply(color[2])];
  return { low: map(range.low), high: map(range.high) };
}

/**
 * Worst contrast of `text` over every backdrop between the two extremes. Luminance is
 * monotonic between them, so the extremes bound it, unless the text sits inside that band.
 */
function worstContrast(text: Rgb, darkest: Rgb, brightest: Rgb): number {
  const lt = relativeLuminance(text);
  const lo = relativeLuminance(darkest);
  const hi = relativeLuminance(brightest);
  if (lt > lo && lt < hi) return 1;
  return lt >= hi ? (lt + 0.05) / (hi + 0.05) : (lo + 0.05) / (lt + 0.05);
}

export type ScrimColors = Readonly<{
  canvas: Rgb;
  /** Every text color that sits straight on the page while a wallpaper is on. */
  texts: ReadonlyArray<Rgb>;
  /** Translucent fills over the page (such as `bg-card/40` groups) that text also sits on. */
  tints?: ReadonlyArray<Readonly<{ color: Rgb; alpha: number }>>;
}>;

/**
 * The lowest scrim opacity that keeps every page text color at WCAG AA over the darkest and
 * the brightest part of the (filtered) image, bare or under each tint. Returns 1 when nothing
 * lower is safe.
 */
export function solveScrimOpacity(colors: ScrimColors, range: ImageRange): number {
  const tints = [{ color: colors.canvas, alpha: 0 }, ...(colors.tints ?? [])];
  for (let scrim = MIN_SCRIM; scrim < 1; scrim += 0.01) {
    const darkest = mixRgb(colors.canvas, range.low, scrim);
    const brightest = mixRgb(colors.canvas, range.high, scrim);
    const readable = tints.every((tint) => {
      const low = mixRgb(tint.color, darkest, tint.alpha);
      const high = mixRgb(tint.color, brightest, tint.alpha);
      return colors.texts.every((text) => worstContrast(text, low, high) >= WCAG_AA_TEXT);
    });
    if (readable) return Math.round(scrim * 100) / 100;
  }
  return 1;
}

/** Componentwise channel range of RGBA pixel data (alpha ignored). */
export function measureImageRange(pixels: ArrayLike<number>): ImageRange {
  const low = [255, 255, 255];
  const high = [0, 0, 0];
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = pixels[index + channel]!;
      if (value < low[channel]!) low[channel] = value;
      if (value > high[channel]!) high[channel] = value;
    }
  }
  if (low[0]! > high[0]!) return UNKNOWN_IMAGE_RANGE;
  return {
    low: [low[0]! / 255, low[1]! / 255, low[2]! / 255],
    high: [high[0]! / 255, high[1]! / 255, high[2]! / 255],
  };
}

// ---- Uploads ----

export const WALLPAPER_UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
/** Larger files are refused before decode; the stored copy is re-encoded far smaller. */
export const WALLPAPER_UPLOAD_MAX_BYTES = 40 * 1024 * 1024;
export const WALLPAPER_MAX_WIDTH = 2560;

export function validateWallpaperFile(file: {
  readonly type: string;
  readonly size: number;
}): string | null {
  if (!WALLPAPER_UPLOAD_TYPES.includes(file.type)) {
    return "Choose a PNG, JPEG, WebP or GIF image.";
  }
  if (file.size > WALLPAPER_UPLOAD_MAX_BYTES) return "Choose an image smaller than 40 MB.";
  if (file.size === 0) return "This file is empty.";
  return null;
}

/** Fits an image inside `maxWidth`, keeping its aspect ratio. Never upscales. */
export function fitWidth(
  width: number,
  height: number,
  maxWidth: number,
): { width: number; height: number } {
  if (width <= maxWidth) return { width, height };
  return { width: maxWidth, height: Math.max(1, Math.round((height * maxWidth) / width)) };
}
