import { useEffect, useState } from "react";

import { Switch } from "../ui/switch";
import { SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

type LoginItemState = { supported: boolean; openAtLogin: boolean };

/** Settings → start with the computer. Hidden on the web and in unpackaged desktop runs. */
export function LoginItemSettings() {
  const bridge = typeof window === "undefined" ? undefined : window.desktopBridge?.loginItem;
  const [state, setState] = useState<LoginItemState | null>(null);

  useEffect(() => {
    if (!bridge) return;
    let cancelled = false;
    void bridge
      .getState()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  if (!bridge || !state?.supported) return null;
  return (
    <SettingsRow
      {...searchableSetting("start-with-computer")}
      description="Open Leonidas when you sign in to your computer."
      control={
        <Switch
          checked={state.openAtLogin}
          onCheckedChange={(checked) => {
            void bridge
              .setOpenAtLogin(checked)
              .then(setState)
              .catch(() => undefined);
          }}
          aria-label="Start with computer"
        />
      }
    />
  );
}
