import { createFileRoute } from "@tanstack/react-router";

import { IntegrationsSettingsPanel } from "../components/settings/IntegrationsSettings";

function SettingsBrowserRoute() {
  return <IntegrationsSettingsPanel view="browser" />;
}

export const Route = createFileRoute("/_chat/settings/browser")({
  component: SettingsBrowserRoute,
});
