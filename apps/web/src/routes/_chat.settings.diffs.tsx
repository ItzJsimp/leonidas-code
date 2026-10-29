import { createFileRoute } from "@tanstack/react-router";

import { DiffsSettingsPanel } from "../components/settings/SettingsPanels";

function SettingsDiffsRoute() {
  return <DiffsSettingsPanel />;
}

export const Route = createFileRoute("/_chat/settings/diffs")({
  component: SettingsDiffsRoute,
});
