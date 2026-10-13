import { describe, expect, it } from "vite-plus/test";
import { readSettingsDockHref, SETTINGS_DOCK_MESSAGE } from "./settingsWindow";

describe("moving settings back", () => {
  it("preserves the settings page, scope and highlighted control", () => {
    expect(
      readSettingsDockHref(
        {
          type: SETTINGS_DOCK_MESSAGE,
          href: "https://code.example/settings/appearance?machine=local#theme",
        },
        "https://code.example",
        "https://code.example/chat",
      ),
    ).toBe("/settings/appearance?machine=local#theme");
    expect(
      readSettingsDockHref(
        { type: SETTINGS_DOCK_MESSAGE, href: "t3code://app/settings/general" },
        "null",
        "t3code://app/",
      ),
    ).toBe("/settings/general");
  });
  it("rejects other origins, non-settings navigation and malformed messages", () => {
    for (const href of ["https://evil.example/settings", "https://code.example/chat", "invalid"]) {
      expect(
        readSettingsDockHref(
          { type: SETTINGS_DOCK_MESSAGE, href },
          "https://code.example",
          "https://code.example/",
        ),
      ).toBeNull();
    }
    expect(
      readSettingsDockHref(
        { type: SETTINGS_DOCK_MESSAGE, href: "https://code.example/settings" },
        "https://evil.example",
        "https://code.example/",
      ),
    ).toBeNull();
    expect(readSettingsDockHref(null, "null", "t3code://app/")).toBeNull();
    expect(
      readSettingsDockHref(
        { type: SETTINGS_DOCK_MESSAGE, href: "t3code://other/settings" },
        "null",
        "t3code://app/",
      ),
    ).toBeNull();
  });
});
