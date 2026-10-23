import { useRef } from "react";

import { useClientSettings } from "../../hooks/useSettings";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import { SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { exportDeviceSettings, parseDeviceSettings } from "./settingsTransfer";
import { useUpdateScopedSettings } from "./useScopedSettings";

/** Moves this device's preferences to another machine. Accounts, tokens and paths stay behind. */
export function SettingsBackupSettings() {
  const settings = useClientSettings();
  const updateSettings = useUpdateScopedSettings();
  const fileInput = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const url = URL.createObjectURL(
      new Blob([exportDeviceSettings(settings)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "leonidas-code-settings.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    const imported = parseDeviceSettings(await file.text());
    if (imported === null) {
      toastManager.add({
        type: "error",
        title: "Not a settings file",
        description: "This is not a settings file. Choose a file that you saved from Leonidas.",
      });
      return;
    }
    updateSettings(imported.patch);
    toastManager.add({
      type: "success",
      title: "Settings imported",
      description:
        imported.skipped > 0
          ? `${Object.keys(imported.patch).length} applied, ${imported.skipped} skipped.`
          : `${Object.keys(imported.patch).length} applied.`,
    });
  };

  return (
    <SettingsRow
      {...searchableSetting("settings-backup")}
      description="Save the settings of this device to a file, or load a file from another computer. The file never has accounts, tokens or folder paths."
      control={
        <div className="flex items-center gap-2">
          <Button type="button" size="compact" onClick={handleExport}>
            Export
          </Button>
          <Button
            type="button"
            size="compact"

            onClick={() => fileInput.current?.click()}
          >
            Import
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Import settings file"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void handleImport(file);
            }}
          />
        </div>
      }
    />
  );
}
