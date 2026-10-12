import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";
import { describe, expect, it } from "vite-plus/test";

import { exportDeviceSettings, parseDeviceSettings } from "./settingsTransfer";

describe("device settings transfer", () => {
  it("round-trips preferences and leaves machine values out", () => {
    const exported = exportDeviceSettings({
      ...DEFAULT_CLIENT_SETTINGS,
      notificationVolume: 40,
    });
    expect(exported).not.toContain("browserProfiles");
    expect(exported).not.toContain("onboardingCompletedAt");
    const imported = parseDeviceSettings(exported);
    expect(imported?.patch.notificationVolume).toBe(40);
    expect(imported?.patch).not.toHaveProperty("browserProfiles");
  });

  it("drops invalid, unknown and excluded entries and rejects other files", () => {
    const text = JSON.stringify({
      kind: "leonidas-code-device-settings",
      version: 1,
      settings: { notificationVolume: 500, notFound: 1, browserProfiles: [], wordWrap: false },
    });
    const imported = parseDeviceSettings(text);
    expect(imported?.patch).toEqual({ wordWrap: false });
    expect(imported?.skipped).toBe(3);
    expect(parseDeviceSettings("{}")).toBeNull();
    expect(parseDeviceSettings("not json")).toBeNull();
  });
});
