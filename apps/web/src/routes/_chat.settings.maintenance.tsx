import { createFileRoute } from "@tanstack/react-router";

import { MaintenanceSettingsPanel } from "../components/settings/SettingsPanels";

function SettingsMaintenanceRoute() {
  return <MaintenanceSettingsPanel />;
}

export const Route = createFileRoute("/_chat/settings/maintenance")({
  component: SettingsMaintenanceRoute,
});
