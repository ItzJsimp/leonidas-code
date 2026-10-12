import { describe, expect, it } from "vite-plus/test";

import { shouldShowLeonidasThemeNotice } from "./leonidasThemeNotice";

describe("Leonidas theme adoption notice", () => {
  it("offers T3 Original once to users who were following the old default", () => {
    expect(
      shouldShowLeonidasThemeNotice({
        alreadySeen: false,
        storedTheme: "system",
        hasThemeHalves: false,
      }),
    ).toBe(true);
    expect(
      shouldShowLeonidasThemeNotice({
        alreadySeen: false,
        storedTheme: "dark",
        hasThemeHalves: false,
      }),
    ).toBe(true);
  });

  it("skips new installs, chosen themes, saved halves, and previously dismissed notices", () => {
    expect(
      shouldShowLeonidasThemeNotice({
        alreadySeen: false,
        storedTheme: null,
        hasThemeHalves: false,
      }),
    ).toBe(false);
    expect(
      shouldShowLeonidasThemeNotice({
        alreadySeen: false,
        storedTheme: "t3-original",
        hasThemeHalves: false,
      }),
    ).toBe(false);
    expect(
      shouldShowLeonidasThemeNotice({
        alreadySeen: false,
        storedTheme: "system",
        hasThemeHalves: true,
      }),
    ).toBe(false);
    expect(
      shouldShowLeonidasThemeNotice({
        alreadySeen: true,
        storedTheme: "system",
        hasThemeHalves: false,
      }),
    ).toBe(false);
  });
});
