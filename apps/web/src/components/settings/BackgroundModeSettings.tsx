import { useEffect, useState } from "react";

import { Switch } from "../ui/switch";
import { SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

/** Settings → keep scheduled tasks running after the window closes. Hidden on the web. */
export function BackgroundModeSettings() {
  const bridge = typeof window === "undefined" ? undefined : window.desktopBridge?.backgroundMode;
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!bridge) return;
    let cancelled = false;
    void bridge
      .get()
      .then((next) => {
        if (!cancelled) setEnabled(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  if (!bridge || enabled === null) return null;
  return (
    <SettingsRow
      {...searchableSetting("keep-running-in-background")}
      title="Keep running in the background"
      description="Closing the window hides the app to the tray, so scheduled tasks keep running. Use Quit in the tray menu to stop it."
      control={
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => {
            void bridge
              .set(checked)
              .then(setEnabled)
              .catch(() => undefined);
          }}
          aria-label="Keep running in the background"
        />
      }
    />
  );
}
