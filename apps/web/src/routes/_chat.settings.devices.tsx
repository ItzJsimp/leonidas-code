import { createFileRoute } from "@tanstack/react-router";

import { IntegrationsSettingsPanel } from "../components/settings/IntegrationsSettings";

function SettingsDevicesRoute() {
  return <IntegrationsSettingsPanel view="devices" />;
}

export const Route = createFileRoute("/_chat/settings/devices")({
  component: SettingsDevicesRoute,
});
