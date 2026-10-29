import { createFileRoute } from "@tanstack/react-router";

import { LabsSettingsPanel } from "../components/settings/SettingsPanels";

function SettingsLabsRoute() {
  return <LabsSettingsPanel />;
}

export const Route = createFileRoute("/_chat/settings/labs")({
  component: SettingsLabsRoute,
});
