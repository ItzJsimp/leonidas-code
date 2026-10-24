import { BUILT_IN_THEMES, getThemeColorsForAppearance } from "@t3tools/shared/themePalettes";
import { describe, expect, it } from "vite-plus/test";

import { themeColorToHex } from "~/themePalette";

import {
  clampSlider,
  contrastRatio,
  DEFAULT_WALLPAPER_SETTINGS,
  filterImageRange,
  fitWidth,
  hexToRgb,
  measureImageRange,
  MIN_SCRIM,
  mixRgb,
  MUTED_TEXT_LIFT,
  parseWallpaperSettings,
  resolveWallpaperUrl,
  solveScrimOpacity,
  UNKNOWN_IMAGE_RANGE,
  validateWallpaperFile,
  WALLPAPER_BLUR,
  WALLPAPER_BRIGHTNESS,
  wallpaperFilter,
  type Rgb,
} from "./wallpaper.logic";

const rgbOf = (color: string): Rgb => hexToRgb(themeColorToHex(color)!)!;

describe("parseWallpaperSettings", () => {
  it("falls back to defaults for junk", () => {
    expect(parseWallpaperSettings(null)).toEqual(DEFAULT_WALLPAPER_SETTINGS);
    expect(parseWallpaperSettings("x")).toEqual(DEFAULT_WALLPAPER_SETTINGS);
    expect(parseWallpaperSettings({ choice: "nope", blur: "a" })).toEqual(
      DEFAULT_WALLPAPER_SETTINGS,
    );
  });

  it("keeps known choices and clamps sliders", () => {
    expect(
      parseWallpaperSettings({ choice: "ocean", blur: 99, brightness: 3, contrast: 101 }),
    ).toEqual({ choice: "ocean", blur: 40, brightness: 30, contrast: 100 });
    expect(parseWallpaperSettings({ choice: "custom" }).choice).toBe("custom");
  });
});

describe("clampSlider", () => {
  it("snaps to the step and stays in range", () => {
    expect(clampSlider(57, WALLPAPER_BRIGHTNESS)).toBe(55);
    expect(clampSlider(-5, WALLPAPER_BLUR)).toBe(0);
    expect(clampSlider(Number.NaN, WALLPAPER_BRIGHTNESS)).toBe(100);
  });
});

describe("resolveWallpaperUrl", () => {
  it("follows the theme and falls back to Leonidas art for a user theme", () => {
    const base = { customUrl: null } as const;
    expect(resolveWallpaperUrl({ ...base, choice: "none", themeId: "grove" })).toBeNull();
    expect(resolveWallpaperUrl({ ...base, choice: "theme", themeId: "grove" })).toBe(
      "/wallpapers/grove.webp",
    );
    expect(resolveWallpaperUrl({ ...base, choice: "theme", themeId: "my-theme" })).toBe(
      "/wallpapers/leonidas.webp",
    );
    expect(resolveWallpaperUrl({ choice: "custom", themeId: "grove", customUrl: "blob:x" })).toBe(
      "blob:x",
    );
    expect(resolveWallpaperUrl({ ...base, choice: "custom", themeId: "grove" })).toBeNull();
  });
});

it("orders the filter so contrast cannot exceed the brightness cap", () => {
  expect(wallpaperFilter({ choice: "theme", blur: 4, brightness: 80, contrast: 120 })).toBe(
    "blur(4px) contrast(120%) brightness(80%)",
  );
  const range = filterImageRange(UNKNOWN_IMAGE_RANGE, {
    ...DEFAULT_WALLPAPER_SETTINGS,
    brightness: 50,
    contrast: 150,
  });
  expect(range.high).toEqual([0.5, 0.5, 0.5]);
  expect(range.low).toEqual([0, 0, 0]);
});

it("measures the componentwise channel range", () => {
  const pixels = [10, 200, 30, 255, 250, 20, 90, 255];
  const range = measureImageRange(pixels);
  expect(range.low.map((value) => Math.round(value * 255))).toEqual([10, 20, 30]);
  expect(range.high.map((value) => Math.round(value * 255))).toEqual([250, 200, 90]);
  expect(measureImageRange([])).toBe(UNKNOWN_IMAGE_RANGE);
});

describe("solveScrimOpacity", () => {
  it("keeps every built-in theme at WCAG AA over any image", () => {
    for (const theme of BUILT_IN_THEMES) {
      for (const appearance of ["light", "dark"] as const) {
        const colors = getThemeColorsForAppearance(theme, appearance);
        if (!colors) continue;
        const canvas = rgbOf(colors.canvas);
        const text = rgbOf(colors.text);
        const muted = mixRgb(text, rgbOf(colors.mutedForeground), MUTED_TEXT_LIFT);
        const surface = rgbOf(colors.surface);
        const scrim = solveScrimOpacity(
          { canvas, texts: [text, muted], tints: [{ color: surface, alpha: 0.4 }] },
          UNKNOWN_IMAGE_RANGE,
        );
        expect(scrim, `${theme.id} ${appearance}`).toBeLessThan(1);
        for (const backdrop of [
          [0, 0, 0],
          [1, 1, 1],
        ] as const) {
          const page = mixRgb(canvas, backdrop, scrim);
          expect(contrastRatio(text, page)).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(muted, page)).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(muted, mixRgb(surface, page, 0.4))).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("lets a dark image show more on a dark theme", () => {
    const canvas: Rgb = [0.03, 0.03, 0.04];
    const texts: Rgb[] = [[0.93, 0.93, 0.93]];
    const dim = { low: [0, 0, 0], high: [0.3, 0.2, 0.2] } as const;
    expect(solveScrimOpacity({ canvas, texts }, dim)).toBe(MIN_SCRIM);
    expect(solveScrimOpacity({ canvas, texts }, UNKNOWN_IMAGE_RANGE)).toBeGreaterThan(MIN_SCRIM);
  });

  it("returns a solid scrim when text cannot pass at all", () => {
    const gray: Rgb = [0.5, 0.5, 0.5];
    expect(solveScrimOpacity({ canvas: gray, texts: [gray] }, UNKNOWN_IMAGE_RANGE)).toBe(1);
  });
});

describe("uploads", () => {
  it("accepts common image types only", () => {
    expect(validateWallpaperFile({ type: "image/png", size: 10 })).toBeNull();
    expect(validateWallpaperFile({ type: "image/svg+xml", size: 10 })).toMatch(/PNG/);
    expect(validateWallpaperFile({ type: "image/jpeg", size: 0 })).toMatch(/empty/);
    expect(validateWallpaperFile({ type: "image/jpeg", size: 41 * 1024 * 1024 })).toMatch(/40 MB/);
  });

  it("fits wide images to 2560 px and never upscales", () => {
    expect(fitWidth(5120, 2880, 2560)).toEqual({ width: 2560, height: 1440 });
    expect(fitWidth(800, 600, 2560)).toEqual({ width: 800, height: 600 });
  });
});
